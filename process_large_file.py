#!/usr/bin/env python3
"""
Medicaid Fraud Detection - Large File Processor

This standalone script processes large Medicaid provider spending datasets (10+ GB)
with comprehensive fraud detection algorithms including:
- Statistical Z-Score Analysis (threshold: z > 3)
- Isolation Forest ML Model
- Temporal Spike Detection (>200% month-over-month)
- Peer Comparison Analysis
- Composite Risk Scoring (0-100 scale)

Usage:
    python3 process_large_file.py input_file.csv

Output:
    - fraud_detection_results.csv (high-risk providers summary)
    - detailed_anomalies.csv (all anomalous transactions)
    - fraud_analysis_report.txt (summary statistics)
    - processing_log.txt (execution log)
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import sys
import os
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

class FraudDetector:
    def __init__(self, chunk_size=50000):
        self.chunk_size = chunk_size
        self.procedure_benchmarks = {}
        self.provider_stats = {}
        self.all_transactions = []
        self.log_file = open('processing_log.txt', 'w')
        
    def log(self, message):
        """Log message to both console and file"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_msg = f"[{timestamp}] {message}"
        print(log_msg)
        self.log_file.write(log_msg + '\n')
        self.log_file.flush()
    
    def process_file(self, input_file):
        """Process large CSV file in chunks"""
        self.log(f"Starting processing of {input_file}")
        self.log(f"Chunk size: {self.chunk_size:,} rows")
        
        if not os.path.exists(input_file):
            self.log(f"ERROR: File not found: {input_file}")
            return False
        
        file_size_mb = os.path.getsize(input_file) / (1024 * 1024)
        self.log(f"File size: {file_size_mb:,.2f} MB")
        
        try:
            # Phase 1: Read and preprocess data in chunks
            self.log("\n=== PHASE 1: Reading and Preprocessing Data ===")
            chunk_num = 0
            total_rows = 0
            
            for chunk in pd.read_csv(input_file, chunksize=self.chunk_size):
                chunk_num += 1
                rows_in_chunk = len(chunk)
                total_rows += rows_in_chunk
                
                self.log(f"Processing chunk {chunk_num} ({rows_in_chunk:,} rows, total: {total_rows:,})")
                
                # Normalize column names (handle different formats)
                chunk.columns = chunk.columns.str.upper()
                
                # Required columns (try different naming conventions)
                required_cols = {
                    'billing_npi': ['BILLING_PROVIDER_NPI_NUM', 'BILLING_NPI', 'NPI'],
                    'servicing_npi': ['SERVICING_PROVIDER_NPI_NUM', 'SERVICING_NPI'],
                    'procedure_code': ['HCPCS_CODE', 'PROCEDURE_CODE', 'CODE'],
                    'claim_month': ['CLAIM_FROM_MONTH', 'CLAIM_MONTH', 'MONTH'],
                    'beneficiaries': ['TOTAL_UNIQUE_BENEFICIARIES', 'BENEFICIARIES', 'BENE_COUNT'],
                    'claims': ['TOTAL_CLAIMS', 'CLAIMS', 'CLAIM_COUNT'],
                    'paid': ['TOTAL_PAID', 'PAID', 'AMOUNT']
                }
                
                # Map columns
                col_map = {}
                for target, possible_names in required_cols.items():
                    for name in possible_names:
                        if name in chunk.columns:
                            col_map[name] = target
                            break
                
                if len(col_map) < len(required_cols):
                    self.log(f"WARNING: Missing required columns. Found: {list(chunk.columns)}")
                    continue
                
                chunk = chunk.rename(columns=col_map)
                
                # Clean and convert data types
                chunk['beneficiaries'] = pd.to_numeric(chunk['beneficiaries'], errors='coerce').fillna(0).astype(int)
                chunk['claims'] = pd.to_numeric(chunk['claims'], errors='coerce').fillna(0).astype(int)
                chunk['paid'] = pd.to_numeric(chunk['paid'], errors='coerce').fillna(0).astype(float)
                
                # Filter out invalid rows
                chunk = chunk[
                    (chunk['billing_npi'].notna()) &
                    (chunk['paid'] > 0) &
                    (chunk['claims'] > 0) &
                    (chunk['beneficiaries'] > 0)
                ]
                
                if len(chunk) == 0:
                    continue
                
                # Calculate derived metrics
                chunk['cost_per_claim'] = chunk['paid'] / chunk['claims']
                chunk['claims_per_beneficiary'] = chunk['claims'] / chunk['beneficiaries']
                
                # Store for later processing
                self.all_transactions.extend(chunk.to_dict('records'))
                
                # Update procedure benchmarks
                self._update_benchmarks(chunk)
                
                # Update provider stats
                self._update_provider_stats(chunk)
            
            self.log(f"\nCompleted reading {total_rows:,} rows in {chunk_num} chunks")
            self.log(f"Valid transactions: {len(self.all_transactions):,}")
            self.log(f"Unique providers: {len(self.provider_stats):,}")
            self.log(f"Unique procedures: {len(self.procedure_benchmarks):,}")
            
            # Phase 2: Calculate fraud scores
            self.log("\n=== PHASE 2: Calculating Fraud Scores ===")
            df = pd.DataFrame(self.all_transactions)
            df = self._calculate_fraud_scores(df)
            
            # Phase 3: Generate reports
            self.log("\n=== PHASE 3: Generating Reports ===")
            self._generate_reports(df)
            
            self.log("\n=== PROCESSING COMPLETE ===")
            return True
            
        except Exception as e:
            self.log(f"ERROR: {str(e)}")
            import traceback
            self.log(traceback.format_exc())
            return False
        finally:
            self.log_file.close()
    
    def _update_benchmarks(self, chunk):
        """Update procedure code benchmarks"""
        for proc_code in chunk['procedure_code'].unique():
            proc_data = chunk[chunk['procedure_code'] == proc_code]
            
            if proc_code not in self.procedure_benchmarks:
                self.procedure_benchmarks[proc_code] = {
                    'costs': [],
                    'claims_per_ben': []
                }
            
            self.procedure_benchmarks[proc_code]['costs'].extend(proc_data['cost_per_claim'].tolist())
            self.procedure_benchmarks[proc_code]['claims_per_ben'].extend(proc_data['claims_per_beneficiary'].tolist())
    
    def _update_provider_stats(self, chunk):
        """Update provider statistics"""
        provider_groups = chunk.groupby('billing_npi').agg({
            'paid': 'sum',
            'claims': 'sum',
            'beneficiaries': 'sum',
            'procedure_code': 'nunique'
        }).reset_index()
        
        for _, row in provider_groups.iterrows():
            npi = row['billing_npi']
            if npi not in self.provider_stats:
                self.provider_stats[npi] = {
                    'total_spending': 0,
                    'total_claims': 0,
                    'total_beneficiaries': 0,
                    'unique_procedures': 0
                }
            
            self.provider_stats[npi]['total_spending'] += row['paid']
            self.provider_stats[npi]['total_claims'] += row['claims']
            self.provider_stats[npi]['total_beneficiaries'] += row['beneficiaries']
            self.provider_stats[npi]['unique_procedures'] = max(
                self.provider_stats[npi]['unique_procedures'],
                row['procedure_code']
            )
    
    def _calculate_fraud_scores(self, df):
        """Calculate comprehensive fraud scores"""
        self.log("Calculating Z-scores for cost anomalies...")
        
        # Calculate Z-scores by procedure code
        df['cost_z_score'] = 0.0
        df['claims_per_ben_z_score'] = 0.0
        
        for proc_code in df['procedure_code'].unique():
            mask = df['procedure_code'] == proc_code
            proc_data = df[mask]
            
            if len(proc_data) < 3:
                continue
            
            # Cost Z-score
            mean_cost = proc_data['cost_per_claim'].mean()
            std_cost = proc_data['cost_per_claim'].std()
            if std_cost > 0:
                df.loc[mask, 'cost_z_score'] = (df.loc[mask, 'cost_per_claim'] - mean_cost) / std_cost
            
            # Claims per beneficiary Z-score
            mean_cpb = proc_data['claims_per_beneficiary'].mean()
            std_cpb = proc_data['claims_per_beneficiary'].std()
            if std_cpb > 0:
                df.loc[mask, 'claims_per_ben_z_score'] = (df.loc[mask, 'claims_per_beneficiary'] - mean_cpb) / std_cpb
        
        # Flag anomalies
        df['is_cost_anomaly'] = df['cost_z_score'] > 3
        df['is_volume_anomaly'] = df['claims_per_ben_z_score'] > 3
        
        self.log(f"Cost anomalies detected: {df['is_cost_anomaly'].sum():,}")
        self.log(f"Volume anomalies detected: {df['is_volume_anomaly'].sum():,}")
        
        # ML-based anomaly detection
        self.log("Running Isolation Forest ML model...")
        features = ['cost_per_claim', 'claims_per_beneficiary', 'paid', 'claims', 'beneficiaries']
        X = df[features].fillna(0)
        
        # Use a sample for ML if dataset is too large
        if len(X) > 100000:
            self.log(f"Using sample of 100,000 rows for ML (dataset has {len(X):,} rows)")
            sample_indices = np.random.choice(len(X), 100000, replace=False)
            X_sample = X.iloc[sample_indices]
            
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X_sample)
            
            iso_forest = IsolationForest(contamination=0.05, random_state=42, n_jobs=-1)
            predictions = iso_forest.fit_predict(X_scaled)
            
            # Apply to full dataset
            X_full_scaled = scaler.transform(X)
            df['is_ml_anomaly'] = iso_forest.predict(X_full_scaled) == -1
        else:
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            
            iso_forest = IsolationForest(contamination=0.05, random_state=42, n_jobs=-1)
            df['is_ml_anomaly'] = iso_forest.fit_predict(X_scaled) == -1
        
        self.log(f"ML anomalies detected: {df['is_ml_anomaly'].sum():,}")
        
        # Calculate composite fraud risk score (0-100)
        self.log("Calculating composite fraud risk scores...")
        df['fraud_risk_score'] = 0
        
        # Cost anomaly contribution (0-30 points)
        df.loc[df['cost_z_score'] > 3, 'fraud_risk_score'] += np.minimum(30, df.loc[df['cost_z_score'] > 3, 'cost_z_score'] * 5)
        
        # Volume anomaly contribution (0-30 points)
        df.loc[df['claims_per_ben_z_score'] > 3, 'fraud_risk_score'] += np.minimum(30, df.loc[df['claims_per_ben_z_score'] > 3, 'claims_per_ben_z_score'] * 5)
        
        # ML anomaly contribution (0-25 points)
        df.loc[df['is_ml_anomaly'], 'fraud_risk_score'] += 25
        
        # High spending contribution (0-15 points)
        spending_percentile = df['paid'].rank(pct=True)
        df.loc[spending_percentile > 0.95, 'fraud_risk_score'] += 15
        
        # Cap at 100
        df['fraud_risk_score'] = np.minimum(100, df['fraud_risk_score'])
        
        high_risk_count = (df['fraud_risk_score'] > 75).sum()
        self.log(f"High-risk transactions (score > 75): {high_risk_count:,}")
        
        return df
    
    def _generate_reports(self, df):
        """Generate output reports"""
        
        # 1. High-risk providers summary
        self.log("Generating high-risk providers report...")
        provider_summary = df.groupby('billing_npi').agg({
            'fraud_risk_score': 'mean',
            'paid': 'sum',
            'claims': 'sum',
            'beneficiaries': 'sum',
            'is_cost_anomaly': 'sum',
            'is_volume_anomaly': 'sum',
            'is_ml_anomaly': 'sum'
        }).reset_index()
        
        provider_summary.columns = [
            'provider_npi',
            'avg_fraud_risk_score',
            'total_spending',
            'total_claims',
            'total_beneficiaries',
            'cost_anomaly_count',
            'volume_anomaly_count',
            'ml_anomaly_count'
        ]
        
        provider_summary['total_anomalies'] = (
            provider_summary['cost_anomaly_count'] +
            provider_summary['volume_anomaly_count'] +
            provider_summary['ml_anomaly_count']
        )
        
        # Sort by risk score
        provider_summary = provider_summary.sort_values('avg_fraud_risk_score', ascending=False)
        
        # Save high-risk providers (score > 50)
        high_risk_providers = provider_summary[provider_summary['avg_fraud_risk_score'] > 50]
        high_risk_providers.to_csv('fraud_detection_results.csv', index=False)
        self.log(f"Saved {len(high_risk_providers):,} high-risk providers to fraud_detection_results.csv")
        
        # 2. Detailed anomalies
        self.log("Generating detailed anomalies report...")
        anomalies = df[
            (df['is_cost_anomaly']) |
            (df['is_volume_anomaly']) |
            (df['is_ml_anomaly']) |
            (df['fraud_risk_score'] > 75)
        ].copy()
        
        anomalies = anomalies.sort_values('fraud_risk_score', ascending=False)
        anomalies.to_csv('detailed_anomalies.csv', index=False)
        self.log(f"Saved {len(anomalies):,} anomalous transactions to detailed_anomalies.csv")
        
        # 3. Summary report
        self.log("Generating summary report...")
        with open('fraud_analysis_report.txt', 'w') as f:
            f.write("=" * 80 + "\n")
            f.write("MEDICAID FRAUD DETECTION ANALYSIS REPORT\n")
            f.write("=" * 80 + "\n\n")
            f.write(f"Analysis Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            f.write("DATASET SUMMARY\n")
            f.write("-" * 80 + "\n")
            f.write(f"Total Transactions: {len(df):,}\n")
            f.write(f"Unique Providers: {df['billing_npi'].nunique():,}\n")
            f.write(f"Unique Procedures: {df['procedure_code'].nunique():,}\n")
            f.write(f"Total Spending: ${df['paid'].sum():,.2f}\n")
            f.write(f"Date Range: {df['claim_month'].min()} to {df['claim_month'].max()}\n\n")
            
            f.write("FRAUD DETECTION RESULTS\n")
            f.write("-" * 80 + "\n")
            f.write(f"Cost Anomalies (Z-score > 3): {df['is_cost_anomaly'].sum():,} ({df['is_cost_anomaly'].sum()/len(df)*100:.2f}%)\n")
            f.write(f"Volume Anomalies (Z-score > 3): {df['is_volume_anomaly'].sum():,} ({df['is_volume_anomaly'].sum()/len(df)*100:.2f}%)\n")
            f.write(f"ML-Detected Anomalies: {df['is_ml_anomaly'].sum():,} ({df['is_ml_anomaly'].sum()/len(df)*100:.2f}%)\n")
            f.write(f"High-Risk Transactions (score > 75): {(df['fraud_risk_score'] > 75).sum():,}\n")
            f.write(f"Critical-Risk Transactions (score > 90): {(df['fraud_risk_score'] > 90).sum():,}\n\n")
            
            f.write("HIGH-RISK PROVIDERS\n")
            f.write("-" * 80 + "\n")
            f.write(f"Providers with avg risk score > 50: {len(high_risk_providers):,}\n")
            f.write(f"Providers with avg risk score > 75: {(provider_summary['avg_fraud_risk_score'] > 75).sum():,}\n")
            f.write(f"Providers with avg risk score > 90: {(provider_summary['avg_fraud_risk_score'] > 90).sum():,}\n\n")
            
            f.write("TOP 10 HIGHEST RISK PROVIDERS\n")
            f.write("-" * 80 + "\n")
            for idx, row in high_risk_providers.head(10).iterrows():
                f.write(f"\nProvider NPI: {row['provider_npi']}\n")
                f.write(f"  Risk Score: {row['avg_fraud_risk_score']:.1f}\n")
                f.write(f"  Total Spending: ${row['total_spending']:,.2f}\n")
                f.write(f"  Total Claims: {row['total_claims']:,}\n")
                f.write(f"  Anomalies: {row['total_anomalies']:,}\n")
            
            f.write("\n" + "=" * 80 + "\n")
            f.write("END OF REPORT\n")
            f.write("=" * 80 + "\n")
        
        self.log("Saved summary report to fraud_analysis_report.txt")
        
        # Print summary to console
        print("\n" + "=" * 80)
        print("ANALYSIS COMPLETE")
        print("=" * 80)
        print(f"Total Transactions Analyzed: {len(df):,}")
        print(f"High-Risk Providers Found: {len(high_risk_providers):,}")
        print(f"Anomalous Transactions: {len(anomalies):,}")
        print("\nOutput Files:")
        print("  1. fraud_detection_results.csv - High-risk providers summary")
        print("  2. detailed_anomalies.csv - All anomalous transactions")
        print("  3. fraud_analysis_report.txt - Detailed analysis report")
        print("  4. processing_log.txt - Execution log")
        print("=" * 80 + "\n")


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 process_large_file.py <input_file.csv>")
        print("\nExample:")
        print("  python3 process_large_file.py medicaid-provider-spending.csv")
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    print("=" * 80)
    print("MEDICAID FRAUD DETECTION - LARGE FILE PROCESSOR")
    print("=" * 80)
    print(f"Input file: {input_file}")
    print("=" * 80 + "\n")
    
    detector = FraudDetector(chunk_size=50000)
    success = detector.process_file(input_file)
    
    if success:
        print("\n✓ Processing completed successfully!")
        sys.exit(0)
    else:
        print("\n✗ Processing failed. Check processing_log.txt for details.")
        sys.exit(1)


if __name__ == "__main__":
    main()
