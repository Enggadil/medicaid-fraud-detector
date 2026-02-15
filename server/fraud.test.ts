import { describe, expect, it } from "vitest";
import {
  calculateProcedureBenchmarks,
  processTransactions,
  calculateFraudRiskScore,
  calculateProviderStats,
  detectTemporalSpikes,
} from "./fraudDetection";

describe("Fraud Detection Algorithms", () => {
  const sampleTransactions = [
    {
      billingProviderNpi: "1000000001",
      servicingProviderNpi: "1000000001",
      hcpcsCode: "99213",
      claimFromMonth: "2024-01-01",
      totalUniqueBeneficiaries: 50,
      totalClaims: 100,
      totalPaid: "12000",
    },
    {
      billingProviderNpi: "1000000001",
      servicingProviderNpi: "1000000001",
      hcpcsCode: "99213",
      claimFromMonth: "2024-02-01",
      totalUniqueBeneficiaries: 60,
      totalClaims: 120,
      totalPaid: "14400",
    },
    {
      billingProviderNpi: "1000000002",
      servicingProviderNpi: "1000000002",
      hcpcsCode: "99213",
      claimFromMonth: "2024-01-01",
      totalUniqueBeneficiaries: 100,
      totalClaims: 200,
      totalPaid: "24000",
    },
    {
      billingProviderNpi: "1000000002",
      servicingProviderNpi: "1000000002",
      hcpcsCode: "99213",
      claimFromMonth: "2024-02-01",
      totalUniqueBeneficiaries: 110,
      totalClaims: 800, // Sudden spike
      totalPaid: "96000",
    },
  ];

  describe("calculateProcedureBenchmarks", () => {
    it("should calculate correct benchmarks for procedure codes", () => {
      const benchmarks = calculateProcedureBenchmarks(sampleTransactions);
      
      expect(benchmarks.has("99213")).toBe(true);
      
      const benchmark = benchmarks.get("99213");
      expect(benchmark).toBeDefined();
      expect(benchmark?.hcpcsCode).toBe("99213");
      expect(benchmark?.sampleSize).toBe(4);
      expect(benchmark?.avgCost).toBeGreaterThan(0);
      expect(benchmark?.stdCost).toBeGreaterThanOrEqual(0); // Can be 0 for uniform data
    });

    it("should handle empty transaction list", () => {
      const benchmarks = calculateProcedureBenchmarks([]);
      expect(benchmarks.size).toBe(0);
    });
  });

  describe("processTransactions", () => {
    it("should calculate derived metrics correctly", () => {
      const benchmarks = calculateProcedureBenchmarks(sampleTransactions);
      const processed = processTransactions(sampleTransactions, benchmarks);
      
      expect(processed.length).toBe(sampleTransactions.length);
      
      const first = processed[0];
      expect(first.costPerClaim).toBe(120); // 12000 / 100
      expect(first.claimsPerBeneficiary).toBe(2); // 100 / 50
      expect(first.costZScore).toBeDefined();
      expect(first.claimsPerBenZScore).toBeDefined();
    });

    it("should handle transactions without benchmarks", () => {
      const emptyBenchmarks = new Map();
      const processed = processTransactions(sampleTransactions, emptyBenchmarks);
      
      expect(processed.length).toBe(sampleTransactions.length);
      expect(processed[0].costZScore).toBe(0);
      expect(processed[0].claimsPerBenZScore).toBe(0);
    });
  });

  describe("calculateFraudRiskScore", () => {
    it("should return 0 for normal transactions", () => {
      const normalTx = {
        ...sampleTransactions[0],
        costPerClaim: 120,
        claimsPerBeneficiary: 2,
        costZScore: 0.5,
        claimsPerBenZScore: 0.5,
        fraudRiskScore: 0,
        anomalyFlag: 0,
      };
      
      const score = calculateFraudRiskScore(normalTx, 0, 50);
      expect(score).toBeLessThan(50);
    });

    it("should assign high risk score for extreme z-scores", () => {
      const anomalousTx = {
        ...sampleTransactions[0],
        costPerClaim: 500,
        claimsPerBeneficiary: 10,
        costZScore: 5, // Extreme
        claimsPerBenZScore: 4, // Extreme
        fraudRiskScore: 0,
        anomalyFlag: 1,
      };
      
      const score = calculateFraudRiskScore(anomalousTx, 1, 99);
      expect(score).toBeGreaterThan(75); // Critical threshold
    });

    it("should cap risk score at 100", () => {
      const extremeTx = {
        ...sampleTransactions[0],
        costPerClaim: 1000,
        claimsPerBeneficiary: 20,
        costZScore: 10,
        claimsPerBenZScore: 10,
        fraudRiskScore: 0,
        anomalyFlag: 1,
      };
      
      const score = calculateFraudRiskScore(extremeTx, 1, 99);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe("calculateProviderStats", () => {
    it("should aggregate provider-level statistics correctly", () => {
      const benchmarks = calculateProcedureBenchmarks(sampleTransactions);
      const processed = processTransactions(sampleTransactions, benchmarks);
      
      // Set fraud risk scores
      processed.forEach((tx, i) => {
        tx.fraudRiskScore = i * 10;
      });
      
      const stats = calculateProviderStats(processed);
      
      expect(stats.size).toBe(2); // Two unique providers
      
      const provider1 = stats.get("1000000001");
      expect(provider1).toBeDefined();
      expect(provider1?.totalClaims).toBe(220); // 100 + 120
      expect(provider1?.totalSpending).toBeCloseTo(26400); // 12000 + 14400
      expect(provider1?.uniqueProcedures).toBe(1);
    });

    it("should calculate average risk score correctly", () => {
      const benchmarks = calculateProcedureBenchmarks(sampleTransactions);
      const processed = processTransactions(sampleTransactions, benchmarks);
      
      processed[0].fraudRiskScore = 80;
      processed[1].fraudRiskScore = 60;
      
      const stats = calculateProviderStats(processed);
      const provider1 = stats.get("1000000001");
      
      expect(provider1?.avgRiskScore).toBe(70); // (80 + 60) / 2
    });
  });

  describe("detectTemporalSpikes", () => {
    it("should detect sudden billing increases", () => {
      const benchmarks = calculateProcedureBenchmarks(sampleTransactions);
      const processed = processTransactions(sampleTransactions, benchmarks);
      
      const spikes = detectTemporalSpikes(processed);
      
      // Provider 2 has a spike from 200 to 800 claims (300% increase)
      expect(spikes.has("1000000002")).toBe(true);
      
      const provider2Spike = spikes.get("1000000002");
      expect(provider2Spike?.maxChange).toBeGreaterThan(200);
      expect(provider2Spike?.months.length).toBeGreaterThan(0);
    });

    it("should not flag normal month-over-month changes", () => {
      const normalTransactions = [
        {
          billingProviderNpi: "1000000003",
          servicingProviderNpi: "1000000003",
          hcpcsCode: "99213",
          claimFromMonth: "2024-01-01",
          totalUniqueBeneficiaries: 50,
          totalClaims: 100,
          totalPaid: "12000",
        },
        {
          billingProviderNpi: "1000000003",
          servicingProviderNpi: "1000000003",
          hcpcsCode: "99213",
          claimFromMonth: "2024-02-01",
          totalUniqueBeneficiaries: 55,
          totalClaims: 110, // Only 10% increase
          totalPaid: "13200",
        },
      ];
      
      const benchmarks = calculateProcedureBenchmarks(normalTransactions);
      const processed = processTransactions(normalTransactions, benchmarks);
      
      const spikes = detectTemporalSpikes(processed);
      expect(spikes.has("1000000003")).toBe(false);
    });
  });
});
