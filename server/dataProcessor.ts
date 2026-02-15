import Papa from 'papaparse';
import { storagePut } from './storage';
import {
  calculateProcedureBenchmarks,
  processTransactions,
  detectAnomaliesML,
  calculateFraudRiskScore,
  calculateProviderStats,
  detectTemporalSpikes,
} from './fraudDetection';
import {
  createAnalysisRun,
  updateAnalysisRun,
  insertTransactions,
  upsertProvider,
  upsertProcedureBenchmark,
  createAlert,
} from './fraudDb';
import { notifyOwner } from './_core/notification';

interface RawDataRow {
  BILLING_PROVIDER_NPI_NUM?: string;
  SERVICING_PROVIDER_NPI_NUM?: string;
  HCPCS_CODE?: string;
  CLAIM_FROM_MONTH?: string;
  TOTAL_UNIQUE_BENEFICIARIES?: string;
  TOTAL_CLAIMS?: string;
  TOTAL_PAID?: string;
}

interface TransactionRecord {
  billingProviderNpi: string;
  servicingProviderNpi: string;
  hcpcsCode: string;
  claimFromMonth: string;
  totalUniqueBeneficiaries: number;
  totalClaims: number;
  totalPaid: string;
}

/**
 * Parse CSV data and validate schema
 */
export async function parseCSVData(csvContent: string): Promise<TransactionRecord[]> {
  return new Promise((resolve, reject) => {
    const transactions: TransactionRecord[] = [];
    
    Papa.parse<RawDataRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        for (const row of results.data) {
          // Validate required fields
          if (
            !row.BILLING_PROVIDER_NPI_NUM ||
            !row.SERVICING_PROVIDER_NPI_NUM ||
            !row.HCPCS_CODE ||
            !row.CLAIM_FROM_MONTH ||
            !row.TOTAL_UNIQUE_BENEFICIARIES ||
            !row.TOTAL_CLAIMS ||
            !row.TOTAL_PAID
          ) {
            continue; // Skip invalid rows
          }
          
          transactions.push({
            billingProviderNpi: row.BILLING_PROVIDER_NPI_NUM,
            servicingProviderNpi: row.SERVICING_PROVIDER_NPI_NUM,
            hcpcsCode: row.HCPCS_CODE,
            claimFromMonth: row.CLAIM_FROM_MONTH,
            totalUniqueBeneficiaries: parseInt(row.TOTAL_UNIQUE_BENEFICIARIES),
            totalClaims: parseInt(row.TOTAL_CLAIMS),
            totalPaid: row.TOTAL_PAID,
          });
        }
        
        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      },
    });
  });
}

/**
 * Process uploaded file and run fraud detection analysis
 */
export async function processUploadedFile(
  userId: number,
  fileName: string,
  fileContent: string,
  fileSize: number,
  onProgress?: (progress: number, status: string) => void
): Promise<number> {
  try {
    // Upload file to S3
    onProgress?.(5, 'uploading');
    const fileKey = `fraud-detection/${userId}/${Date.now()}-${fileName}`;
    const { url: fileUrl } = await storagePut(fileKey, fileContent, 'text/csv');
    
    // Create analysis run record
    const analysisId = await createAnalysisRun({
      userId,
      fileName,
      fileSize,
      fileUrl,
      status: 'processing',
      progress: 10,
    });
    
    // Parse CSV data
    onProgress?.(15, 'processing');
    await updateAnalysisRun(analysisId, { status: 'processing', progress: 15 });
    
    const rawTransactions = await parseCSVData(fileContent);
    
    if (rawTransactions.length === 0) {
      throw new Error('No valid transactions found in the uploaded file');
    }
    
    // Calculate procedure benchmarks
    onProgress?.(25, 'analyzing');
    await updateAnalysisRun(analysisId, { status: 'analyzing', progress: 25 });
    
    const benchmarks = calculateProcedureBenchmarks(rawTransactions);
    
    // Store benchmarks in database
    for (const [hcpcsCode, benchmark] of Array.from(benchmarks.entries())) {
      await upsertProcedureBenchmark({
        hcpcsCode,
        avgCost: benchmark.avgCost.toString(),
        stdCost: benchmark.stdCost.toString(),
        medianCost: benchmark.medianCost.toString(),
        avgClaimsPerBen: benchmark.avgClaimsPerBen.toString(),
        stdClaimsPerBen: benchmark.stdClaimsPerBen.toString(),
        medianClaimsPerBen: benchmark.medianClaimsPerBen.toString(),
        sampleSize: benchmark.sampleSize,
        analysisId,
      });
    }
    
    // Process transactions and calculate z-scores
    onProgress?.(40, 'analyzing');
    await updateAnalysisRun(analysisId, { progress: 40 });
    
    const processedTransactions = processTransactions(rawTransactions, benchmarks);
    
    // Run ML anomaly detection
    onProgress?.(55, 'analyzing');
    await updateAnalysisRun(analysisId, { progress: 55 });
    
    const anomalyMap = detectAnomaliesML(processedTransactions);
    
    // Calculate volume percentiles
    const claimVolumes = processedTransactions.map(tx => tx.totalClaims);
    claimVolumes.sort((a, b) => a - b);
    
    // Calculate fraud risk scores
    onProgress?.(70, 'analyzing');
    await updateAnalysisRun(analysisId, { progress: 70 });
    
    for (let i = 0; i < processedTransactions.length; i++) {
      const tx = processedTransactions[i];
      const anomalyFlag = anomalyMap.get(i) || 0;
      
      // Calculate percentile
      const rank = claimVolumes.filter(v => v <= tx.totalClaims).length;
      const percentile = (rank / claimVolumes.length) * 100;
      
      tx.anomalyFlag = anomalyFlag;
      tx.fraudRiskScore = calculateFraudRiskScore(tx, anomalyFlag, percentile);
    }
    
    // Store transactions in database
    onProgress?.(80, 'analyzing');
    await updateAnalysisRun(analysisId, { progress: 80 });
    
    const dbTransactions = processedTransactions.map(tx => ({
      billingProviderNpi: tx.billingProviderNpi,
      servicingProviderNpi: tx.servicingProviderNpi,
      hcpcsCode: tx.hcpcsCode,
      claimFromMonth: tx.claimFromMonth,
      totalUniqueBeneficiaries: tx.totalUniqueBeneficiaries,
      totalClaims: tx.totalClaims,
      totalPaid: tx.totalPaid,
      costPerClaim: tx.costPerClaim.toString(),
      claimsPerBeneficiary: tx.claimsPerBeneficiary.toString(),
      costZScore: tx.costZScore.toString(),
      claimsPerBenZScore: tx.claimsPerBenZScore.toString(),
      fraudRiskScore: tx.fraudRiskScore,
      anomalyFlag: tx.anomalyFlag,
      analysisId,
    }));
    
    await insertTransactions(dbTransactions);
    
    // Calculate provider-level statistics
    onProgress?.(90, 'analyzing');
    await updateAnalysisRun(analysisId, { progress: 90 });
    
    const providerStats = calculateProviderStats(processedTransactions);
    
    for (const [npi, stats] of Array.from(providerStats.entries())) {
      await upsertProvider({
        npi,
        totalSpending: stats.totalSpending.toString(),
        totalClaims: stats.totalClaims,
        totalBeneficiaries: stats.totalBeneficiaries,
        uniqueProcedures: stats.uniqueProcedures,
        avgRiskScore: stats.avgRiskScore,
        avgCostPerClaim: stats.avgCostPerClaim.toString(),
        avgClaimsPerBeneficiary: stats.avgClaimsPerBeneficiary.toString(),
        lastAnalyzed: new Date(),
      });
    }
    
    // Detect temporal spikes
    const temporalSpikes = detectTemporalSpikes(processedTransactions);
    
    // Generate alerts for high-risk providers
    onProgress?.(95, 'analyzing');
    await updateAnalysisRun(analysisId, { progress: 95 });
    
    let criticalAlertsCount = 0;
    
    for (const [npi, stats] of Array.from(providerStats.entries())) {
      // Critical risk alert (risk score > 75)
      if (stats.avgRiskScore > 75) {
        await createAlert({
          providerNpi: npi,
          alertType: 'critical_risk',
          severity: 'critical',
          title: `Critical Fraud Risk Detected`,
          description: `Provider ${npi} has an average risk score of ${stats.avgRiskScore} with total spending of $${stats.totalSpending.toLocaleString()}.`,
          riskScore: stats.avgRiskScore,
          totalSpending: stats.totalSpending.toString(),
          status: 'new',
          notificationSent: 0,
          analysisId,
        });
        criticalAlertsCount++;
      }
      
      // Excessive billing alert
      if (stats.totalClaims > claimVolumes[Math.floor(claimVolumes.length * 0.99)]) {
        await createAlert({
          providerNpi: npi,
          alertType: 'excessive_billing',
          severity: stats.avgRiskScore > 75 ? 'critical' : 'high',
          title: `Excessive Billing Volume Detected`,
          description: `Provider ${npi} submitted ${stats.totalClaims.toLocaleString()} claims, placing them in the top 1% of all providers.`,
          riskScore: stats.avgRiskScore,
          totalSpending: stats.totalSpending.toString(),
          status: 'new',
          notificationSent: 0,
          analysisId,
        });
      }
      
      // Temporal spike alert
      const spike = temporalSpikes.get(npi);
      if (spike) {
        await createAlert({
          providerNpi: npi,
          alertType: 'sudden_spike',
          severity: spike.maxChange > 500 ? 'critical' : 'high',
          title: `Sudden Billing Spike Detected`,
          description: `Provider ${npi} experienced a ${spike.maxChange.toFixed(0)}% increase in billing during ${spike.months.join(', ')}.`,
          riskScore: stats.avgRiskScore,
          totalSpending: stats.totalSpending.toString(),
          status: 'new',
          notificationSent: 0,
          analysisId,
        });
      }
    }
    
    // Calculate summary statistics
    const totalSpending = Array.from(providerStats.values())
      .reduce((sum: number, stats) => sum + stats.totalSpending, 0);
    
    const anomalousRecords = processedTransactions.filter(tx => tx.anomalyFlag === 1).length;
    const highRiskProviders = Array.from(providerStats.values())
      .filter(stats => stats.avgRiskScore > 50).length;
    
    // Get date range
    const dates = processedTransactions.map(tx => tx.claimFromMonth).sort();
    const dateRangeStart = dates[0];
    const dateRangeEnd = dates[dates.length - 1];
    
    // Update analysis run with final results
    await updateAnalysisRun(analysisId, {
      status: 'completed',
      progress: 100,
      totalRecords: processedTransactions.length,
      anomalousRecords,
      highRiskProviders,
      totalSpending: totalSpending.toString(),
      dateRangeStart,
      dateRangeEnd,
      completedAt: new Date(),
    });
    
    onProgress?.(100, 'completed');
    
    // Send notification if critical alerts were generated
    if (criticalAlertsCount > 0) {
      await notifyOwner({
        title: 'Critical Fraud Alerts Detected',
        content: `Analysis completed with ${criticalAlertsCount} critical fraud alerts. ${highRiskProviders} high-risk providers identified with total spending of $${totalSpending.toLocaleString()}.`,
      });
    }
    
    return analysisId;
  } catch (error) {
    console.error('Error processing file:', error);
    throw error;
  }
}
