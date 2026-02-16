import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { processUploadedFile } from "./dataProcessor";
import {
  getRecentAnalysisRuns,
  getAnalysisRun,
  getProviderByNpi,
  getHighRiskProviders,
  getTransactionsByProvider,
  getAnomalousTransactions,
  getHighRiskTransactions,
  getAlertsByAnalysis,
  updateAlertStatus,
  getAnalysisStatistics,
  getProvidersByAnalysis,
} from "./fraudDb";

export const fraudRouter = router({
  /**
   * Upload and analyze data file
   */
  uploadData: publicProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileContent: z.string(),
        fileSize: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Use user ID if authenticated, otherwise use 0 for anonymous uploads
      const userId = ctx.user?.id || 0;
      const analysisId = await processUploadedFile(
        userId,
        input.fileName,
        input.fileContent,
        input.fileSize
      );
      
      return { analysisId };
    }),

  /**
   * Get analysis run status and progress
   */
  getAnalysisStatus: protectedProcedure
    .input(z.object({ analysisId: z.number() }))
    .query(async ({ input }) => {
      const analysis = await getAnalysisRun(input.analysisId);
      return analysis;
    }),

  /**
   * Get recent analysis runs for current user
   */
  getRecentAnalyses: protectedProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const analyses = await getRecentAnalysisRuns(ctx.user.id, input.limit);
      return analyses;
    }),

  /**
   * Get dashboard statistics for an analysis
   */
  getDashboardStats: protectedProcedure
    .input(z.object({ analysisId: z.number() }))
    .query(async ({ input }) => {
      const stats = await getAnalysisStatistics(input.analysisId);
      return stats;
    }),

  /**
   * Search provider by NPI
   */
  searchProvider: protectedProcedure
    .input(z.object({ npi: z.string() }))
    .query(async ({ input }) => {
      const provider = await getProviderByNpi(input.npi);
      return provider;
    }),

  /**
   * Get provider risk profile with transaction history
   */
  getProviderProfile: protectedProcedure
    .input(
      z.object({
        npi: z.string(),
        analysisId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const provider = await getProviderByNpi(input.npi);
      const transactions = await getTransactionsByProvider(input.npi, input.analysisId);
      
      return {
        provider,
        transactions,
      };
    }),

  /**
   * Get high-risk providers list
   */
  getHighRiskProviders: protectedProcedure
    .input(
      z.object({
        minRiskScore: z.number().optional(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const providers = await getHighRiskProviders(input.minRiskScore, input.limit);
      return providers;
    }),

  /**
   * Get providers for a specific analysis
   */
  getProvidersByAnalysis: protectedProcedure
    .input(z.object({ analysisId: z.number() }))
    .query(async ({ input }) => {
      const providers = await getProvidersByAnalysis(input.analysisId);
      return providers;
    }),

  /**
   * Get anomalous transactions
   */
  getAnomalousTransactions: protectedProcedure
    .input(
      z.object({
        analysisId: z.number(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const transactions = await getAnomalousTransactions(input.analysisId, input.limit);
      return transactions;
    }),

  /**
   * Get high-risk transactions (risk score > threshold)
   */
  getHighRiskTransactions: protectedProcedure
    .input(
      z.object({
        analysisId: z.number(),
        minRiskScore: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const transactions = await getHighRiskTransactions(
        input.analysisId,
        input.minRiskScore
      );
      return transactions;
    }),

  /**
   * Get alerts for an analysis
   */
  getAlerts: protectedProcedure
    .input(z.object({ analysisId: z.number() }))
    .query(async ({ input }) => {
      const alerts = await getAlertsByAnalysis(input.analysisId);
      return alerts;
    }),

  /**
   * Update alert status
   */
  updateAlertStatus: protectedProcedure
    .input(
      z.object({
        alertId: z.number(),
        status: z.enum(["new", "investigating", "resolved", "dismissed"]),
      })
    )
    .mutation(async ({ input }) => {
      await updateAlertStatus(input.alertId, input.status);
      return { success: true };
    }),

  /**
   * Export analysis results as CSV
   */
  exportResults: protectedProcedure
    .input(
      z.object({
        analysisId: z.number(),
        exportType: z.enum(["providers", "transactions", "alerts"]),
      })
    )
    .query(async ({ input }) => {
      // This will return data that the frontend can convert to CSV
      if (input.exportType === "providers") {
        const providers = await getProvidersByAnalysis(input.analysisId);
        return { data: providers, type: "providers" };
      } else if (input.exportType === "transactions") {
        const transactions = await getHighRiskTransactions(input.analysisId, 0);
        return { data: transactions, type: "transactions" };
      } else {
        const alerts = await getAlertsByAnalysis(input.analysisId);
        return { data: alerts, type: "alerts" };
      }
    }),
});
