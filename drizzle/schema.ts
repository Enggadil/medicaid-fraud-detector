import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Providers table - stores aggregated provider information and risk scores
 */
export const providers = mysqlTable("providers", {
  id: int("id").autoincrement().primaryKey(),
  npi: varchar("npi", { length: 10 }).notNull().unique(),
  totalSpending: varchar("totalSpending", { length: 20 }).notNull().default("0"),
  totalClaims: int("totalClaims").notNull().default(0),
  totalBeneficiaries: int("totalBeneficiaries").notNull().default(0),
  uniqueProcedures: int("uniqueProcedures").notNull().default(0),
  avgRiskScore: int("avgRiskScore").notNull().default(0),
  avgCostPerClaim: varchar("avgCostPerClaim", { length: 20 }).notNull().default("0"),
  avgClaimsPerBeneficiary: varchar("avgClaimsPerBeneficiary", { length: 20 }).notNull().default("0"),
  // External enrichment data
  specialty: varchar("specialty", { length: 255 }),
  location: varchar("location", { length: 255 }),
  practiceSize: varchar("practiceSize", { length: 50 }),
  complianceHistory: text("complianceHistory"),
  lastAnalyzed: timestamp("lastAnalyzed").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Provider = typeof providers.$inferSelect;
export type InsertProvider = typeof providers.$inferInsert;

/**
 * Transactions table - stores individual provider-procedure-month records
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  billingProviderNpi: varchar("billingProviderNpi", { length: 10 }).notNull(),
  servicingProviderNpi: varchar("servicingProviderNpi", { length: 10 }).notNull(),
  hcpcsCode: varchar("hcpcsCode", { length: 10 }).notNull(),
  claimFromMonth: varchar("claimFromMonth", { length: 10 }).notNull(),
  totalUniqueBeneficiaries: int("totalUniqueBeneficiaries").notNull(),
  totalClaims: int("totalClaims").notNull(),
  totalPaid: varchar("totalPaid", { length: 20 }).notNull(),
  // Calculated fraud indicators
  costPerClaim: varchar("costPerClaim", { length: 20 }).notNull(),
  claimsPerBeneficiary: varchar("claimsPerBeneficiary", { length: 20 }).notNull(),
  costZScore: varchar("costZScore", { length: 20 }).notNull().default("0"),
  claimsPerBenZScore: varchar("claimsPerBenZScore", { length: 20 }).notNull().default("0"),
  fraudRiskScore: int("fraudRiskScore").notNull().default(0),
  anomalyFlag: int("anomalyFlag").notNull().default(0), // 1 for anomaly, 0 for normal
  analysisId: int("analysisId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * Alerts table - stores fraud alerts and notifications
 */
export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  providerNpi: varchar("providerNpi", { length: 10 }).notNull(),
  alertType: mysqlEnum("alertType", [
    "excessive_billing",
    "sudden_spike",
    "overcharging",
    "unbundling",
    "critical_risk"
  ]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  riskScore: int("riskScore").notNull(),
  totalSpending: varchar("totalSpending", { length: 20 }).notNull(),
  status: mysqlEnum("status", ["new", "investigating", "resolved", "dismissed"]).notNull().default("new"),
  notificationSent: int("notificationSent").notNull().default(0), // 0 = not sent, 1 = sent
  analysisId: int("analysisId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

/**
 * Analysis runs table - tracks each data upload and analysis session
 */
export const analysisRuns = mysqlTable("analysisRuns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileSize: int("fileSize").notNull(),
  fileUrl: text("fileUrl").notNull(),
  status: mysqlEnum("status", ["uploading", "processing", "analyzing", "completed", "failed"]).notNull().default("uploading"),
  progress: int("progress").notNull().default(0),
  totalRecords: int("totalRecords").notNull().default(0),
  anomalousRecords: int("anomalousRecords").notNull().default(0),
  highRiskProviders: int("highRiskProviders").notNull().default(0),
  totalSpending: varchar("totalSpending", { length: 20 }).notNull().default("0"),
  dateRangeStart: varchar("dateRangeStart", { length: 10 }),
  dateRangeEnd: varchar("dateRangeEnd", { length: 10 }),
  resultsUrl: text("resultsUrl"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type AnalysisRun = typeof analysisRuns.$inferSelect;
export type InsertAnalysisRun = typeof analysisRuns.$inferInsert;

/**
 * Procedure benchmarks table - stores average costs and patterns for each HCPCS code
 */
export const procedureBenchmarks = mysqlTable("procedureBenchmarks", {
  id: int("id").autoincrement().primaryKey(),
  hcpcsCode: varchar("hcpcsCode", { length: 10 }).notNull().unique(),
  avgCost: varchar("avgCost", { length: 20 }).notNull(),
  stdCost: varchar("stdCost", { length: 20 }).notNull(),
  medianCost: varchar("medianCost", { length: 20 }).notNull(),
  avgClaimsPerBen: varchar("avgClaimsPerBen", { length: 20 }).notNull(),
  stdClaimsPerBen: varchar("stdClaimsPerBen", { length: 20 }).notNull(),
  medianClaimsPerBen: varchar("medianClaimsPerBen", { length: 20 }).notNull(),
  sampleSize: int("sampleSize").notNull(),
  analysisId: int("analysisId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProcedureBenchmark = typeof procedureBenchmarks.$inferSelect;
export type InsertProcedureBenchmark = typeof procedureBenchmarks.$inferInsert;