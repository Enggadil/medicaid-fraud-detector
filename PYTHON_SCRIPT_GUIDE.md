# Python Script Guide: Processing Large Medicaid Datasets

This guide explains how to use the standalone Python script to process your 10 GB Medicaid dataset locally.

## Quick Start

```bash
# 1. Install required Python packages
pip install pandas numpy scikit-learn

# 2. Run the script
python3 process_large_file.py your_medicaid_file.csv

# 3. Wait for processing to complete (10-30 minutes for 10 GB)

# 4. Review the output files
```

## Requirements

- **Python 3.7+**
- **RAM**: At least 8 GB (16 GB recommended for 10 GB files)
- **Disk Space**: 2x the size of your input file for output files
- **Time**: Approximately 10-30 minutes for a 10 GB file

### Installing Dependencies

```bash
# Option 1: Using pip
pip install pandas numpy scikit-learn

# Option 2: Using conda
conda install pandas numpy scikit-learn

# Option 3: Install specific versions
pip install pandas==2.0.0 numpy==1.24.0 scikit-learn==1.3.0
```

## Usage

### Basic Usage

```bash
python3 process_large_file.py medicaid-provider-spending.csv
```

### With ZIP Files

If your file is zipped:

```bash
# Extract first
unzip medicaid-provider-spending.csv.zip

# Then process
python3 process_large_file.py medicaid-provider-spending.csv
```

### Processing Multiple Files

```bash
# Process each file separately
python3 process_large_file.py file1.csv
python3 process_large_file.py file2.csv
python3 process_large_file.py file3.csv
```

## What the Script Does

### 1. Data Loading & Preprocessing
- Reads the CSV file in chunks (50,000 rows at a time) to avoid memory issues
- Normalizes column names (handles different formats)
- Cleans and validates data
- Calculates derived metrics (cost per claim, claims per beneficiary)

### 2. Fraud Detection Algorithms

**Statistical Z-Score Analysis**
- Calculates Z-scores for cost and volume by procedure code
- Flags anomalies where Z-score > 3 (99.7th percentile)

**Isolation Forest ML Model**
- Multivariate anomaly detection using 5 features
- Identifies complex fraud patterns
- Uses 5% contamination rate (adjustable)

**Composite Risk Scoring (0-100 scale)**
- Cost anomalies: 0-30 points
- Volume anomalies: 0-30 points
- ML anomalies: 0-25 points
- High spending: 0-15 points

### 3. Report Generation
- High-risk providers summary
- Detailed anomaly records
- Statistical analysis report

## Output Files

### 1. `fraud_detection_results.csv`
**High-risk providers summary** (providers with avg risk score > 50)

Columns:
- `provider_npi` - Provider NPI number
- `avg_fraud_risk_score` - Average fraud risk score (0-100)
- `total_spending` - Total amount billed
- `total_claims` - Total number of claims
- `total_beneficiaries` - Total unique beneficiaries
- `cost_anomaly_count` - Number of cost anomalies
- `volume_anomaly_count` - Number of volume anomalies
- `ml_anomaly_count` - Number of ML-detected anomalies
- `total_anomalies` - Sum of all anomalies

**Example:**
```csv
provider_npi,avg_fraud_risk_score,total_spending,total_claims,total_beneficiaries,cost_anomaly_count,volume_anomaly_count,ml_anomaly_count,total_anomalies
1234567890,87.5,2500000.00,1500,300,45,38,52,135
```

### 2. `detailed_anomalies.csv`
**All anomalous transactions** sorted by risk score

Includes all original columns plus:
- `cost_per_claim` - Calculated cost per claim
- `claims_per_beneficiary` - Calculated claims per beneficiary
- `cost_z_score` - Z-score for cost
- `claims_per_ben_z_score` - Z-score for claims per beneficiary
- `is_cost_anomaly` - Boolean flag for cost anomaly
- `is_volume_anomaly` - Boolean flag for volume anomaly
- `is_ml_anomaly` - Boolean flag for ML-detected anomaly
- `fraud_risk_score` - Composite fraud risk score (0-100)

### 3. `fraud_analysis_report.txt`
**Human-readable summary report**

Contains:
- Dataset statistics (total transactions, providers, procedures)
- Fraud detection results summary
- High-risk provider counts
- Top 10 highest risk providers with details

**Example:**
```
================================================================================
MEDICAID FRAUD DETECTION ANALYSIS REPORT
================================================================================

Analysis Date: 2026-02-16 18:30:45

DATASET SUMMARY
--------------------------------------------------------------------------------
Total Transactions: 5,234,891
Unique Providers: 45,678
Unique Procedures: 1,234
Total Spending: $12,456,789,012.34
Date Range: 2024-01 to 2024-12

FRAUD DETECTION RESULTS
--------------------------------------------------------------------------------
Cost Anomalies (Z-score > 3): 15,234 (0.29%)
Volume Anomalies (Z-score > 3): 23,456 (0.45%)
ML-Detected Anomalies: 261,745 (5.00%)
High-Risk Transactions (score > 75): 8,901
Critical-Risk Transactions (score > 90): 1,234

HIGH-RISK PROVIDERS
--------------------------------------------------------------------------------
Providers with avg risk score > 50: 2,345
Providers with avg risk score > 75: 456
Providers with avg risk score > 90: 89
```

### 4. `processing_log.txt`
**Detailed execution log** with timestamps

Useful for:
- Debugging errors
- Tracking progress
- Performance analysis

## Performance Tips

### For 10 GB Files

**Recommended Settings:**
- RAM: 16 GB
- Chunk size: 50,000 rows (default)
- Expected time: 15-25 minutes

**If You Have Less RAM (8 GB):**

Edit the script and change chunk size:
```python
detector = FraudDetector(chunk_size=25000)  # Smaller chunks
```

**If You Have More RAM (32+ GB):**

```python
detector = FraudDetector(chunk_size=100000)  # Larger chunks = faster
```

### Monitoring Progress

The script prints progress updates every chunk:
```
[2026-02-16 18:15:23] Processing chunk 1 (50,000 rows, total: 50,000)
[2026-02-16 18:15:45] Processing chunk 2 (50,000 rows, total: 100,000)
[2026-02-16 18:16:07] Processing chunk 3 (50,000 rows, total: 150,000)
```

### Running in Background

For long-running processes:

```bash
# Run in background and save output
nohup python3 process_large_file.py large_file.csv > output.log 2>&1 &

# Check progress
tail -f output.log

# Or check processing log
tail -f processing_log.txt
```

## Interpreting Results

### Fraud Risk Scores

| Score Range | Risk Level | Action |
|-------------|------------|--------|
| 0-25 | Low | No immediate action needed |
| 26-50 | Medium | Monitor for patterns |
| 51-75 | High | Review transactions |
| 76-90 | Very High | Investigate immediately |
| 91-100 | Critical | Priority investigation |

### Anomaly Types

**Cost Anomalies (Z-score > 3)**
- Provider charges significantly more than peers
- May indicate upcoding or overcharging

**Volume Anomalies (Z-score > 3)**
- Unusually high claims per beneficiary
- May indicate unbundling or unnecessary services

**ML Anomalies**
- Complex patterns detected by machine learning
- Combination of multiple suspicious factors

### Next Steps After Analysis

1. **Review High-Risk Providers**
   - Open `fraud_detection_results.csv`
   - Sort by `avg_fraud_risk_score`
   - Focus on providers with score > 75

2. **Investigate Specific Transactions**
   - Open `detailed_anomalies.csv`
   - Filter by provider NPI
   - Look for patterns (procedure codes, dates, amounts)

3. **Generate Reports**
   - Use `fraud_analysis_report.txt` for executive summary
   - Share with compliance team
   - Document findings

4. **Upload to Web Platform**
   - The results CSVs are much smaller than the original file
   - Upload `fraud_detection_results.csv` to the web platform for visualization
   - Share with team members

## Troubleshooting

### Error: "Memory Error" or "Killed"

**Solution:** Reduce chunk size

```python
# Edit process_large_file.py, line 33
detector = FraudDetector(chunk_size=10000)  # Reduce from 50000
```

### Error: "File not found"

**Solution:** Check file path

```bash
# Use absolute path
python3 process_large_file.py /full/path/to/file.csv

# Or navigate to directory first
cd /path/to/data
python3 /path/to/process_large_file.py medicaid-data.csv
```

### Error: "Module not found: pandas"

**Solution:** Install dependencies

```bash
pip install pandas numpy scikit-learn
```

### Processing is Very Slow

**Possible causes:**
1. Disk I/O bottleneck (use SSD if possible)
2. Low RAM (increase chunk size if you have more RAM)
3. CPU-bound (ML model is CPU-intensive)

**Solutions:**
- Close other applications
- Use a machine with more CPU cores
- Consider processing overnight

### Script Stops Without Error

**Check:**
1. `processing_log.txt` for last message
2. Available disk space (`df -h`)
3. Available RAM (`free -h`)

## Advanced Usage

### Customizing Fraud Detection

Edit `process_large_file.py` to adjust thresholds:

```python
# Line 275: Change Z-score threshold
df['is_cost_anomaly'] = df['cost_z_score'] > 2.5  # More sensitive

# Line 295: Change ML contamination rate
iso_forest = IsolationForest(contamination=0.10, ...)  # Detect more anomalies

# Line 311: Adjust risk score thresholds
df.loc[df['cost_z_score'] > 2, 'fraud_risk_score'] += ...  # Lower threshold
```

### Processing Specific Date Ranges

Add filtering after loading data:

```python
# After line 100, add:
chunk = chunk[chunk['claim_month'] >= '2024-01']
chunk = chunk[chunk['claim_month'] <= '2024-12']
```

### Exporting to Database

Add database export at the end:

```python
import sqlite3

# After line 400, add:
conn = sqlite3.connect('fraud_results.db')
high_risk_providers.to_sql('providers', conn, if_exists='replace')
anomalies.to_sql('anomalies', conn, if_exists='replace')
conn.close()
```

## Comparison with Web Platform

| Feature | Python Script | Web Platform |
|---------|---------------|--------------|
| File Size Limit | No limit | ~100 MB |
| Processing Speed | 10-30 min for 10 GB | 1-2 min for 10 MB |
| Setup Required | Install Python packages | None |
| Output Format | CSV + TXT | Interactive dashboard |
| Real-time Progress | Console logs | Progress bar |
| Collaboration | Share files | Share URL |
| Visualization | Manual (Excel, etc.) | Built-in charts |

**Recommendation:** Use the Python script for initial analysis of large files, then upload the results CSV to the web platform for visualization and sharing.

## Support

If you encounter issues:

1. Check `processing_log.txt` for error details
2. Verify Python version: `python3 --version` (need 3.7+)
3. Verify dependencies: `pip list | grep -E "pandas|numpy|scikit"`
4. Open a GitHub issue with:
   - Error message
   - `processing_log.txt` content
   - File size and format
   - System specs (RAM, CPU, OS)

## Example Workflow

```bash
# 1. Download HHS dataset
wget https://data.cms.gov/.../medicaid-provider-spending.csv.zip

# 2. Extract
unzip medicaid-provider-spending.csv.zip

# 3. Install dependencies (first time only)
pip install pandas numpy scikit-learn

# 4. Run fraud detection
python3 process_large_file.py medicaid-provider-spending.csv

# 5. Wait for completion (15-25 minutes)

# 6. Review results
cat fraud_analysis_report.txt
head -20 fraud_detection_results.csv

# 7. Upload results to web platform for visualization
# (Upload fraud_detection_results.csv through the web interface)
```

---

**Happy fraud hunting! 🔍**
