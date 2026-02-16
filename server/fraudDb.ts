import { eq, desc, and, gte, sql } from "drizzle-orm";
import { 
  providers, 
  transactions, 
  alerts, 
  analysisRuns, 
  procedureBenchmarks,
  InsertProvider,
  InsertTransaction,
  InsertAlert,
  InsertAnalysisRun,
  InsertProcedureBenchmark
} from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Analysis Runs Operations
 */
export async function createAnalysisRun(data: InsertAnalysisRun) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(analysisRuns).values(data);
  return result[0].insertId;
}

export async function updateAnalysisRun(id: number, data: Partial<InsertAnalysisRun>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(analysisRuns).set(data).where(eq(analysisRuns.id, id));
}

export async function getAnalysisRun(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(analysisRuns).where(eq(analysisRuns.id, id)).limit(1);
  return result[0];
}

export async function getRecentAnalysisRuns(userId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(analysisRuns)
    .where(eq(analysisRuns.userId, userId))
    .orderBy(desc(analysisRuns.createdAt))
    .limit(limit);
}

/**
 * Provider Operations
 */
export async function upsertProvider(data: InsertProvider) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(providers).values(data).onDuplicateKeyUpdate({
    set: {
      totalSpending: data.totalSpending,
      totalClaims: data.totalClaims,
      totalBeneficiaries: data.totalBeneficiaries,
      uniqueProcedures: data.uniqueProcedures,
      avgRiskScore: data.avgRiskScore,
      avgCostPerClaim: data.avgCostPerClaim,
      avgClaimsPerBeneficiary: data.avgClaimsPerBeneficiary,
      specialty: data.specialty,
      location: data.location,
      practiceSize: data.practiceSize,
      complianceHistory: data.complianceHistory,
      lastAnalyzed: data.lastAnalyzed,
    }
  });
}

export async function insertProviders(data: InsertProvider[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Insert in batches to avoid query size limits
  const batchSize = 100;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    await db.insert(providers).values(batch).onDuplicateKeyUpdate({
      set: {
        name: sql`VALUES(name)`,
        specialty: sql`VALUES(specialty)`,
      }
    });
  }
}

export async function getProviderByNpi(npi: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(providers).where(eq(providers.npi, npi)).limit(1);
  return result[0];
}

export async function getHighRiskProviders(minRiskScore: number = 50, limit: number = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(providers)
    .where(gte(providers.avgRiskScore, minRiskScore))
    .orderBy(desc(providers.avgRiskScore))
    .limit(limit);
}

export async function getProvidersByAnalysis(analysisId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get all unique providers from transactions for this analysis
  const result = await db
    .select({
      npi: transactions.billingProviderNpi,
    })
    .from(transactions)
    .where(eq(transactions.analysisId, analysisId))
    .groupBy(transactions.billingProviderNpi);
  
  const npis = result.map(r => r.npi);
  
  if (npis.length === 0) return [];
  
  return await db
    .select()
    .from(providers)
    .where(sql`${providers.npi} IN (${sql.join(npis.map(n => sql`${n}`), sql`, `)})`);
}

/**
 * Transaction Operations
 */
export async function insertTransactions(data: InsertTransaction[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Insert in batches to avoid query size limits
  const batchSize = 1000;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    await db.insert(transactions).values(batch);
  }
}

export async function getTransactionsByProvider(npi: string, analysisId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.billingProviderNpi, npi),
        eq(transactions.analysisId, analysisId)
      )
    )
    .orderBy(desc(transactions.fraudRiskScore));
}

export async function getAnomalousTransactions(analysisId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.analysisId, analysisId),
        eq(transactions.anomalyFlag, 1)
      )
    )
    .orderBy(desc(transactions.fraudRiskScore))
    .limit(limit);
}

export async function getHighRiskTransactions(analysisId: number, minRiskScore: number = 75) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.analysisId, analysisId),
        gte(transactions.fraudRiskScore, minRiskScore)
      )
    )
    .orderBy(desc(transactions.fraudRiskScore));
}

/**
 * Alert Operations
 */
export async function createAlert(data: InsertAlert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(alerts).values(data);
  return result[0].insertId;
}

export async function insertAlerts(data: InsertAlert[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (data.length === 0) return;
  
  // Insert in batches
  const batchSize = 100;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    await db.insert(alerts).values(batch);
  }
}

export async function getAlertsByAnalysis(analysisId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(alerts)
    .where(eq(alerts.analysisId, analysisId))
    .orderBy(desc(alerts.createdAt));
}

export async function getUnsentAlerts() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(alerts)
    .where(eq(alerts.notificationSent, 0))
    .orderBy(desc(alerts.riskScore));
}

export async function markAlertAsSent(alertId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(alerts).set({ notificationSent: 1 }).where(eq(alerts.id, alertId));
}

export async function updateAlertStatus(
  alertId: number, 
  status: "new" | "investigating" | "resolved" | "dismissed"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(alerts).set({ status }).where(eq(alerts.id, alertId));
}

/**
 * Procedure Benchmark Operations
 */
export async function upsertProcedureBenchmark(data: InsertProcedureBenchmark) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(procedureBenchmarks).values(data).onDuplicateKeyUpdate({
    set: {
      avgCost: data.avgCost,
      stdCost: data.stdCost,
      medianCost: data.medianCost,
      avgClaimsPerBen: data.avgClaimsPerBen,
      stdClaimsPerBen: data.stdClaimsPerBen,
      medianClaimsPerBen: data.medianClaimsPerBen,
      sampleSize: data.sampleSize,
      analysisId: data.analysisId,
    }
  });
}

export async function getProcedureBenchmark(hcpcsCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(procedureBenchmarks)
    .where(eq(procedureBenchmarks.hcpcsCode, hcpcsCode))
    .limit(1);
  
  return result[0];
}

export async function getAllProcedureBenchmarks(analysisId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(procedureBenchmarks)
    .where(eq(procedureBenchmarks.analysisId, analysisId));
}

/**
 * Analytics and Statistics
 */
export async function getAnalysisStatistics(analysisId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const analysis = await getAnalysisRun(analysisId);
  
  const highRiskCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(providers)
    .where(gte(providers.avgRiskScore, 50));
  
  const criticalAlertsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(alerts)
    .where(
      and(
        eq(alerts.analysisId, analysisId),
        eq(alerts.severity, "critical")
      )
    );
  
  return {
    totalRecords: analysis?.totalRecords || 0,
    anomalousRecords: analysis?.anomalousRecords || 0,
    highRiskProviders: highRiskCount[0]?.count || 0,
    totalSpending: analysis?.totalSpending || "0",
    dateRangeStart: analysis?.dateRangeStart,
    dateRangeEnd: analysis?.dateRangeEnd,
    criticalAlerts: criticalAlertsCount[0]?.count || 0,
  };
}
