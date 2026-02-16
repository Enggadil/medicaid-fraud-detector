import { Readable } from "stream";
import Papa from "papaparse";
import { detectFraudPatterns, type TransactionRecord } from "./fraudDetection";
import {
  createAnalysisRun,
  updateAnalysisRun,
  insertProviders,
  insertTransactions,
  insertAlerts,
} from "./fraudDb";
import { notifyOwner } from "./_core/notification";

interface ProcessingProgress {
  analysisId: number;
  status: "processing" | "completed" | "failed";
  progress: number;
  rowsProcessed: number;
  totalRows?: number;
  error?: string;
}

const activeJobs = new Map<number, ProcessingProgress>();

/**
 * Process large CSV file from S3 URL using streaming
 */
export async function processLargeFile(
  userId: number,
  fileName: string,
  s3Url: string,
  fileSize: number
): Promise<number> {
  // Create analysis run record
  const analysisId = await createAnalysisRun({
    userId,
    fileName,
    fileSize,
    fileUrl: s3Url,
    status: "processing",
    totalRecords: 0,
  });

  // Start background processing
  processFileInBackground(analysisId, s3Url, fileName).catch((error) => {
    console.error(`[LargeFileProcessor] Error processing analysis ${analysisId}:`, error);
    updateAnalysisRun(analysisId, "failed", 0, error.message);
  });

  return analysisId;
}

/**
 * Process file in background with streaming and chunking
 */
async function processFileInBackground(
  analysisId: number,
  s3Url: string,
  fileName: string
): Promise<void> {
  console.log(`[LargeFileProcessor] Starting background processing for analysis ${analysisId}`);

  // Initialize progress tracking
  activeJobs.set(analysisId, {
    analysisId,
    status: "processing",
    progress: 0,
    rowsProcessed: 0,
  });

  try {
    await updateAnalysisRun(analysisId, { status: "processing", totalRecords: 0 });

    // Fetch file from S3
    const response = await fetch(s3Url);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to fetch file from S3: ${response.statusText}`);
    }

    // Convert ReadableStream to Node.js Readable
    const nodeStream = Readable.from(response.body as any);

    const transactions: TransactionRecord[] = [];
    let rowCount = 0;
    const BATCH_SIZE = 10000; // Process in batches of 10k rows

    // Parse CSV with streaming
    await new Promise<void>((resolve, reject) => {
      Papa.parse(nodeStream, {
        header: true,
        skipEmptyLines: true,
        chunk: async (results: Papa.ParseResult<any>) => {
          try {
            rowCount += results.data.length;

            // Convert to transaction records
            for (const row of results.data) {
              const transaction: TransactionRecord = {
                billingNpi: row.BILLING_PROVIDER_NPI_NUM || row.billing_provider_npi_num,
                servicingNpi: row.SERVICING_PROVIDER_NPI_NUM || row.servicing_provider_npi_num,
                procedureCode: row.HCPCS_CODE || row.hcpcs_code,
                claimMonth: row.CLAIM_FROM_MONTH || row.claim_from_month,
                beneficiaries: parseInt(row.TOTAL_UNIQUE_BENEFICIARIES || row.total_unique_beneficiaries) || 0,
                claims: parseInt(row.TOTAL_CLAIMS || row.total_claims) || 0,
                totalPaid: parseFloat(row.TOTAL_PAID || row.total_paid) || 0,
              };

              if (transaction.billingNpi && transaction.totalPaid > 0) {
                transactions.push(transaction);
              }
            }

            // Process batch when we hit the batch size
            if (transactions.length >= BATCH_SIZE) {
              const batch = transactions.splice(0, BATCH_SIZE);
              await processBatch(analysisId, batch, rowCount);
            }

            // Update progress
            const progress = Math.min(95, Math.floor((rowCount / 100000) * 50)); // Estimate progress
            activeJobs.set(analysisId, {
              analysisId,
              status: "processing",
              progress,
              rowsProcessed: rowCount,
            });

            console.log(`[LargeFileProcessor] Processed ${rowCount} rows for analysis ${analysisId}`);
          } catch (error) {
            reject(error);
          }
        },
        complete: () => resolve(),
        error: (error: Error) => reject(error),
      });
    });

    // Process remaining transactions
    if (transactions.length > 0) {
      await processBatch(analysisId, transactions, rowCount);
    }

    // Mark as completed
    await updateAnalysisRun(analysisId, { status: "completed", totalRecords: rowCount });
    activeJobs.set(analysisId, {
      analysisId,
      status: "completed",
      progress: 100,
      rowsProcessed: rowCount,
    });

    console.log(`[LargeFileProcessor] Completed analysis ${analysisId} with ${rowCount} rows`);

    // Send notification to owner
    await notifyOwner({
      title: "Fraud Detection Analysis Complete",
      content: `Analysis of ${fileName} completed successfully. Processed ${rowCount} records. View results in the dashboard.`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[LargeFileProcessor] Failed to process analysis ${analysisId}:`, errorMessage);

    await updateAnalysisRun(analysisId, { status: "failed", totalRecords: 0, errorMessage: errorMessage });
    activeJobs.set(analysisId, {
      analysisId,
      status: "failed",
      progress: 0,
      rowsProcessed: 0,
      error: errorMessage,
    });

    // Notify owner of failure
    await notifyOwner({
      title: "Fraud Detection Analysis Failed",
      content: `Analysis of ${fileName} failed: ${errorMessage}`,
    });
  }
}

/**
 * Process a batch of transactions
 */
async function processBatch(
  analysisId: number,
  transactions: TransactionRecord[],
  totalProcessed: number
): Promise<void> {
  console.log(`[LargeFileProcessor] Processing batch of ${transactions.length} transactions`);

  // Run fraud detection on batch
  const results = detectFraudPatterns(transactions);

  // Extract unique providers
  const providerMap = new Map<string, any>();
  for (const tx of transactions) {
    if (!providerMap.has(tx.billingNpi)) {
      providerMap.set(tx.billingNpi, {
        npi: tx.billingNpi,
        name: `Provider ${tx.billingNpi}`,
        specialty: "Unknown",
      });
    }
  }

  // Insert providers
  await insertProviders(Array.from(providerMap.values()));

  // Insert transactions with fraud scores
  const transactionsWithScores = transactions.map((tx, idx) => ({
    ...tx,
    analysisId,
    fraudScore: results.providerRiskScores.get(tx.billingNpi) || 0,
    isCostAnomaly: results.costAnomalies.has(idx),
    isVolumeAnomaly: results.volumeAnomalies.has(idx),
    isMlAnomaly: results.mlAnomalies.has(idx),
  }));

  await insertTransactions(transactionsWithScores);

  // Generate and insert alerts for high-risk patterns
  const alerts = [];
  for (const [npi, score] of results.providerRiskScores.entries()) {
    if (score > 75) {
      const provider = providerMap.get(npi);
      alerts.push({
        analysisId,
        providerNpi: npi,
        alertType: "high_risk_provider",
        severity: score > 90 ? "critical" : "high",
        title: `High-Risk Provider Detected: ${provider?.name || npi}`,
        description: `Provider ${npi} has a fraud risk score of ${score.toFixed(1)}`,
        metadata: JSON.stringify({ riskScore: score }),
      });
    }
  }

  if (alerts.length > 0) {
    await insertAlerts(alerts);
    console.log(`[LargeFileProcessor] Generated ${alerts.length} alerts for batch`);
  }
}

/**
 * Get processing progress for an analysis
 */
export function getProcessingProgress(analysisId: number): ProcessingProgress | null {
  return activeJobs.get(analysisId) || null;
}

/**
 * Cancel a running analysis
 */
export function cancelAnalysis(analysisId: number): boolean {
  const job = activeJobs.get(analysisId);
  if (job && job.status === "processing") {
    activeJobs.delete(analysisId);
    updateAnalysisRun(analysisId, { status: "failed", totalRecords: job.rowsProcessed, errorMessage: "Cancelled by user" });
    return true;
  }
  return false;
}
