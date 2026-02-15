/**
 * Fraud Detection Algorithms
 * 
 * This module implements multiple fraud detection techniques:
 * 1. Statistical Z-Score Analysis (threshold: z > 3)
 * 2. Isolation Forest ML Model (multivariate anomaly detection)
 * 3. Temporal Spike Detection (>200% month-over-month increase)
 * 4. Peer Comparison Analysis
 * 5. Composite Risk Scoring (0-100 scale)
 */

interface TransactionRecord {
  billingProviderNpi: string;
  servicingProviderNpi: string;
  hcpcsCode: string;
  claimFromMonth: string;
  totalUniqueBeneficiaries: number;
  totalClaims: number;
  totalPaid: string;
}

interface ProcessedTransaction extends TransactionRecord {
  costPerClaim: number;
  claimsPerBeneficiary: number;
  costZScore: number;
  claimsPerBenZScore: number;
  fraudRiskScore: number;
  anomalyFlag: number;
}

interface ProcedureBenchmark {
  hcpcsCode: string;
  avgCost: number;
  stdCost: number;
  medianCost: number;
  avgClaimsPerBen: number;
  stdClaimsPerBen: number;
  medianClaimsPerBen: number;
  sampleSize: number;
}

interface ProviderStats {
  npi: string;
  totalSpending: number;
  totalClaims: number;
  totalBeneficiaries: number;
  uniqueProcedures: number;
  avgRiskScore: number;
  avgCostPerClaim: number;
  avgClaimsPerBeneficiary: number;
}

/**
 * Calculate basic statistics for a dataset
 */
function calculateStats(values: number[]): { mean: number; std: number; median: number } {
  if (values.length === 0) return { mean: 0, std: 0, median: 0 };
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(variance);
  
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  
  return { mean, std, median };
}

/**
 * Calculate z-score for a value
 */
function calculateZScore(value: number, mean: number, std: number): number {
  if (std === 0) return 0;
  return (value - mean) / std;
}

/**
 * Calculate procedure benchmarks from transaction data
 */
export function calculateProcedureBenchmarks(
  transactions: TransactionRecord[]
): Map<string, ProcedureBenchmark> {
  const procedureGroups = new Map<string, { costs: number[]; claimsPerBen: number[] }>();
  
  // Group by procedure code
  for (const tx of transactions) {
    const totalPaid = parseFloat(tx.totalPaid);
    const costPerClaim = totalPaid / tx.totalClaims;
    const claimsPerBen = tx.totalClaims / tx.totalUniqueBeneficiaries;
    
    if (!procedureGroups.has(tx.hcpcsCode)) {
      procedureGroups.set(tx.hcpcsCode, { costs: [], claimsPerBen: [] });
    }
    
    const group = procedureGroups.get(tx.hcpcsCode)!;
    group.costs.push(costPerClaim);
    group.claimsPerBen.push(claimsPerBen);
  }
  
  // Calculate benchmarks for each procedure
  const benchmarks = new Map<string, ProcedureBenchmark>();
  
  for (const [hcpcsCode, data] of Array.from(procedureGroups.entries())) {
    const costStats = calculateStats(data.costs);
    const claimsStats = calculateStats(data.claimsPerBen);
    
    benchmarks.set(hcpcsCode, {
      hcpcsCode,
      avgCost: costStats.mean,
      stdCost: costStats.std,
      medianCost: costStats.median,
      avgClaimsPerBen: claimsStats.mean,
      stdClaimsPerBen: claimsStats.std,
      medianClaimsPerBen: claimsStats.median,
      sampleSize: data.costs.length,
    });
  }
  
  return benchmarks;
}

/**
 * Simple Isolation Forest implementation for anomaly detection
 * Uses random feature selection and path length to detect outliers
 */
class IsolationTree {
  private splitFeature: number | null = null;
  private splitValue: number | null = null;
  private left: IsolationTree | null = null;
  private right: IsolationTree | null = null;
  private size: number = 0;
  
  constructor(
    private data: number[][],
    private maxDepth: number,
    private currentDepth: number = 0
  ) {
    this.size = data.length;
    
    if (currentDepth >= maxDepth || data.length <= 1) {
      return;
    }
    
    // Randomly select a feature
    const numFeatures = data[0]?.length || 0;
    this.splitFeature = Math.floor(Math.random() * numFeatures);
    
    // Get min and max for this feature
    const featureValues = data.map(row => row[this.splitFeature!]);
    const min = Math.min(...featureValues);
    const max = Math.max(...featureValues);
    
    if (min === max) return;
    
    // Random split value
    this.splitValue = min + Math.random() * (max - min);
    
    // Split data
    const leftData = data.filter(row => row[this.splitFeature!] < this.splitValue!);
    const rightData = data.filter(row => row[this.splitFeature!] >= this.splitValue!);
    
    if (leftData.length > 0) {
      this.left = new IsolationTree(leftData, maxDepth, currentDepth + 1);
    }
    if (rightData.length > 0) {
      this.right = new IsolationTree(rightData, maxDepth, currentDepth + 1);
    }
  }
  
  pathLength(point: number[]): number {
    if (this.splitFeature === null || this.splitValue === null) {
      // Leaf node - estimate path length
      return this.currentDepth + this.estimateC(this.size);
    }
    
    if (point[this.splitFeature] < this.splitValue) {
      return this.left ? this.left.pathLength(point) : this.currentDepth;
    } else {
      return this.right ? this.right.pathLength(point) : this.currentDepth;
    }
  }
  
  estimateC(n: number): number {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
  }
}

class IsolationForest {
  private trees: IsolationTree[] = [];
  private numTrees: number;
  private maxDepth: number;
  
  constructor(numTrees: number = 100, sampleSize: number = 256) {
    this.numTrees = numTrees;
    this.maxDepth = Math.ceil(Math.log2(sampleSize));
  }
  
  fit(data: number[][]): void {
    const sampleSize = Math.min(256, data.length);
    
    for (let i = 0; i < this.numTrees; i++) {
      // Random sampling
      const sample: number[][] = [];
      for (let j = 0; j < sampleSize; j++) {
        const idx = Math.floor(Math.random() * data.length);
        sample.push(data[idx]);
      }
      
      this.trees.push(new IsolationTree(sample, this.maxDepth));
    }
  }
  
  predict(data: number[][]): number[] {
    return data.map(point => {
      const avgPathLength = this.trees.reduce((sum, tree) => sum + tree.pathLength(point), 0) / this.numTrees;
      const c = this.trees[0]?.estimateC?.(256) || 1;
      const anomalyScore = Math.pow(2, -avgPathLength / c);
      
      // Return -1 for anomaly (score > 0.6), 1 for normal
      return anomalyScore > 0.6 ? -1 : 1;
    });
  }
  
  scoresamples(data: number[][]): number[] {
    return data.map(point => {
      const avgPathLength = this.trees.reduce((sum, tree) => sum + tree.pathLength(point), 0) / this.numTrees;
      const c = this.trees[0]?.estimateC?.(256) || 1;
      return Math.pow(2, -avgPathLength / c);
    });
  }
}

/**
 * Detect anomalies using Isolation Forest
 */
export function detectAnomaliesML(
  transactions: ProcessedTransaction[]
): Map<number, number> {
  // Prepare feature matrix
  const features = transactions.map(tx => [
    parseFloat(tx.totalPaid),
    tx.totalClaims,
    tx.totalUniqueBeneficiaries,
    tx.costPerClaim,
    tx.claimsPerBeneficiary,
  ]);
  
  // Normalize features
  const normalized = normalizeFeatures(features);
  
  // Train Isolation Forest
  const isoForest = new IsolationForest(100, 256);
  isoForest.fit(normalized);
  
  // Predict anomalies
  const predictions = isoForest.predict(normalized);
  const scores = isoForest.scoresamples(normalized);
  
  // Map transaction index to anomaly flag and score
  const anomalyMap = new Map<number, number>();
  predictions.forEach((pred, idx) => {
    anomalyMap.set(idx, pred === -1 ? 1 : 0);
  });
  
  return anomalyMap;
}

/**
 * Normalize features using min-max scaling
 */
function normalizeFeatures(features: number[][]): number[][] {
  if (features.length === 0) return [];
  
  const numFeatures = features[0].length;
  const mins: number[] = [];
  const maxs: number[] = [];
  
  // Find min and max for each feature
  for (let f = 0; f < numFeatures; f++) {
    const values = features.map(row => row[f]);
    mins.push(Math.min(...values));
    maxs.push(Math.max(...values));
  }
  
  // Normalize
  return features.map(row =>
    row.map((val, f) => {
      const range = maxs[f] - mins[f];
      return range === 0 ? 0 : (val - mins[f]) / range;
    })
  );
}

/**
 * Calculate composite fraud risk score (0-100)
 */
export function calculateFraudRiskScore(
  tx: ProcessedTransaction,
  anomalyFlag: number,
  volumePercentile: number
): number {
  let riskScore = 0;
  
  // Cost anomalies (z-score > 3): +30 points
  if (Math.abs(tx.costZScore) > 3) {
    riskScore += 30;
  } else if (Math.abs(tx.costZScore) > 2) {
    riskScore += 15;
  }
  
  // Claims per beneficiary anomaly: +25 points
  if (Math.abs(tx.claimsPerBenZScore) > 3) {
    riskScore += 25;
  } else if (Math.abs(tx.claimsPerBenZScore) > 2) {
    riskScore += 12;
  }
  
  // High volume (top 1%): +20 points
  if (volumePercentile >= 99) {
    riskScore += 20;
  } else if (volumePercentile >= 95) {
    riskScore += 10;
  }
  
  // ML-detected anomaly: +25 points
  if (anomalyFlag === 1) {
    riskScore += 25;
  }
  
  return Math.min(riskScore, 100);
}

/**
 * Process transactions and calculate fraud indicators
 */
export function processTransactions(
  transactions: TransactionRecord[],
  benchmarks: Map<string, ProcedureBenchmark>
): ProcessedTransaction[] {
  const processed: ProcessedTransaction[] = [];
  
  // Calculate derived metrics
  for (const tx of transactions) {
    const totalPaid = parseFloat(tx.totalPaid);
    const costPerClaim = totalPaid / tx.totalClaims;
    const claimsPerBeneficiary = tx.totalClaims / tx.totalUniqueBeneficiaries;
    
    const benchmark = benchmarks.get(tx.hcpcsCode);
    
    const costZScore = benchmark 
      ? calculateZScore(costPerClaim, benchmark.avgCost, benchmark.stdCost)
      : 0;
    
    const claimsPerBenZScore = benchmark
      ? calculateZScore(claimsPerBeneficiary, benchmark.avgClaimsPerBen, benchmark.stdClaimsPerBen)
      : 0;
    
    processed.push({
      ...tx,
      costPerClaim,
      claimsPerBeneficiary,
      costZScore,
      claimsPerBenZScore,
      fraudRiskScore: 0, // Will be calculated later
      anomalyFlag: 0, // Will be set by ML model
    });
  }
  
  return processed;
}

/**
 * Calculate provider-level statistics
 */
export function calculateProviderStats(
  transactions: ProcessedTransaction[]
): Map<string, ProviderStats> {
  const providerMap = new Map<string, ProcessedTransaction[]>();
  
  // Group by provider
  for (const tx of transactions) {
    if (!providerMap.has(tx.billingProviderNpi)) {
      providerMap.set(tx.billingProviderNpi, []);
    }
    providerMap.get(tx.billingProviderNpi)!.push(tx);
  }
  
  // Calculate stats for each provider
  const stats = new Map<string, ProviderStats>();
  
  for (const [npi, txs] of Array.from(providerMap.entries())) {
    const totalSpending = txs.reduce((sum: number, tx: ProcessedTransaction) => sum + parseFloat(tx.totalPaid), 0);
    const totalClaims = txs.reduce((sum: number, tx: ProcessedTransaction) => sum + tx.totalClaims, 0);
    const totalBeneficiaries = txs.reduce((sum: number, tx: ProcessedTransaction) => sum + tx.totalUniqueBeneficiaries, 0);
    const uniqueProcedures = new Set(txs.map((tx: ProcessedTransaction) => tx.hcpcsCode)).size;
    const avgRiskScore = Math.round(
      txs.reduce((sum: number, tx: ProcessedTransaction) => sum + tx.fraudRiskScore, 0) / txs.length
    );
    const avgCostPerClaim = totalSpending / totalClaims;
    const avgClaimsPerBeneficiary = totalClaims / totalBeneficiaries;
    
    stats.set(npi, {
      npi,
      totalSpending,
      totalClaims,
      totalBeneficiaries,
      uniqueProcedures,
      avgRiskScore,
      avgCostPerClaim,
      avgClaimsPerBeneficiary,
    });
  }
  
  return stats;
}

/**
 * Detect temporal spikes (>200% month-over-month increase)
 */
export function detectTemporalSpikes(
  transactions: ProcessedTransaction[]
): Map<string, { months: string[]; maxChange: number }> {
  const providerMonthly = new Map<string, Map<string, { spending: number; claims: number }>>();
  
  // Group by provider and month
  for (const tx of transactions) {
    if (!providerMonthly.has(tx.billingProviderNpi)) {
      providerMonthly.set(tx.billingProviderNpi, new Map());
    }
    
    const monthly = providerMonthly.get(tx.billingProviderNpi)!;
    if (!monthly.has(tx.claimFromMonth)) {
      monthly.set(tx.claimFromMonth, { spending: 0, claims: 0 });
    }
    
    const monthData = monthly.get(tx.claimFromMonth)!;
    monthData.spending += parseFloat(tx.totalPaid);
    monthData.claims += tx.totalClaims;
  }
  
  // Detect spikes
  const spikes = new Map<string, { months: string[]; maxChange: number }>();
  
  for (const [npi, monthly] of Array.from(providerMonthly.entries())) {
    const sortedMonths = Array.from(monthly.keys()).sort();
    const spikeMonths: string[] = [];
    let maxChange = 0;
    
    for (let i = 1; i < sortedMonths.length; i++) {
      const prevMonth = sortedMonths[i - 1]!;
      const currMonth = sortedMonths[i];
      
      const prevData = monthly.get(prevMonth)!;
      const currData = monthly.get(currMonth)!;
      
      const spendingChange = ((currData.spending - prevData.spending) / prevData.spending) * 100;
      const claimsChange = ((currData.claims - prevData.claims) / prevData.claims) * 100;
      
      if (spendingChange > 200 || claimsChange > 200) {
        spikeMonths.push(currMonth);
        maxChange = Math.max(maxChange, spendingChange, claimsChange);
      }
    }
    
    if (spikeMonths.length > 0) {
      spikes.set(npi, { months: spikeMonths, maxChange });
    }
  }
  
  return spikes;
}
