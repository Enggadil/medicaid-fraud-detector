# Medicaid Fraud Detection Platform

An advanced analytics platform for identifying unusual billing patterns and potential fraud in Medicaid provider spending data. The system uses multiple fraud detection techniques including statistical analysis, machine learning, and temporal pattern recognition to flag high-risk providers and suspicious transactions.

![Medicaid Fraud Detection Dashboard](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Tests](https://img.shields.io/badge/Tests-12%20Passing-success)
![License](https://img.shields.io/badge/License-MIT-blue)

## Features

### Fraud Detection Algorithms

- **Statistical Z-Score Analysis** - Identifies cost anomalies when z-score exceeds 3 standard deviations
- **Isolation Forest ML Model** - Multivariate anomaly detection using custom implementation
- **Temporal Spike Detection** - Flags providers with >200% month-over-month billing increases
- **Peer Comparison Analysis** - Benchmarks providers against procedure code averages
- **Composite Risk Scoring** - 0-100 scale combining multiple fraud indicators

### Data Processing

- CSV, Parquet, and ZIP file upload support
- Drag-and-drop interface with real-time progress tracking
- Automatic data validation and preprocessing
- Feature engineering pipeline for fraud indicators
- Cloud storage integration for historical analysis

### Dashboard & Analytics

- Key metrics overview (total records, anomalies, high-risk providers, spending)
- Critical fraud alerts with severity levels
- High-risk provider tracking and investigation
- Recent analysis history
- Elegant indigo/purple color scheme with modern UI

### Alert System

- Automatic alert generation for critical patterns (risk score > 75)
- Multiple alert types: excessive billing, sudden spikes, overcharging, critical risk
- Owner notifications for high-priority fraud patterns
- Alert status management (new, investigating, resolved, dismissed)

## Technology Stack

### Frontend
- **React 19** - Modern UI framework
- **Tailwind CSS 4** - Utility-first styling with OKLCH color system
- **tRPC 11** - End-to-end typesafe APIs
- **Wouter** - Lightweight routing
- **shadcn/ui** - High-quality component library
- **Recharts** - Data visualization (ready for charts)

### Backend
- **Node.js + Express** - Server runtime
- **tRPC** - Type-safe API layer
- **Drizzle ORM** - Type-safe database queries
- **MySQL/TiDB** - Relational database
- **AWS S3** - Cloud file storage

### Fraud Detection
- Custom Isolation Forest implementation
- Statistical analysis (z-scores, percentiles)
- Temporal pattern recognition
- Provider-level aggregation and benchmarking

## Deployment

### Option 1: Manus Hosting (Recommended)

The easiest way to deploy this application:

1. Click the **Publish** button in the Manus Management UI
2. Choose your custom domain
3. Done! Everything is pre-configured.

### Option 2: Vercel

For Vercel deployment, see the detailed guide: [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)

**Note:** Vercel requires external database, S3 storage, and custom OAuth setup. Total cost: $50-100/month.

### Option 3: Other Platforms

This app can also be deployed to Railway, Render, Heroku, or DigitalOcean App Platform.

## Getting Started

### Prerequisites

- Node.js 22+
- MySQL or TiDB database
- AWS S3 credentials (or Manus built-in storage)

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
# DATABASE_URL, JWT_SECRET, and storage credentials are auto-configured in Manus

# Generate database migrations
pnpm drizzle-kit generate

# Run migrations (or use webdev_execute_sql tool)
pnpm db:push

# Start development server
pnpm dev
```

### Running Tests

```bash
# Run all tests
pnpm test

# Type checking
pnpm check

# Format code
pnpm format
```

## Usage

### Uploading Data

1. Click "Upload Data" button on the dashboard
2. Drag and drop a CSV file or click to browse
3. Ensure your CSV contains these columns:
   - `BILLING_PROVIDER_NPI_NUM`
   - `SERVICING_PROVIDER_NPI_NUM`
   - `HCPCS_CODE`
   - `CLAIM_FROM_MONTH` (YYYY-MM-DD format)
   - `TOTAL_UNIQUE_BENEFICIARIES`
   - `TOTAL_CLAIMS`
   - `TOTAL_PAID`
4. Click "Start Analysis" and wait for processing to complete

### Understanding Risk Scores

Risk scores range from 0-100 and are calculated based on:

- **Cost Anomalies** (30 points max) - Z-score > 3 indicates excessive charges
- **Claims per Beneficiary** (25 points max) - Z-score > 3 indicates unusual volume
- **High Volume** (20 points max) - Top 1% of claim volumes
- **ML Anomaly Detection** (25 points max) - Isolation Forest flagged

**Risk Levels:**
- 0-25: Low risk
- 26-50: Moderate risk
- 51-75: High risk
- 76-100: Critical risk (triggers automatic alerts)

### Critical Alerts

The system automatically generates alerts for:

- **Critical Risk** - Providers with average risk score > 75
- **Excessive Billing** - Providers in top 1% of claim volumes
- **Sudden Spikes** - >200% month-over-month increase in billing
- **Overcharging** - Consistent cost anomalies (z-score > 3)

Critical alerts trigger owner notifications automatically.

## Project Structure

```
medicaid-fraud-detector/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── pages/            # Page components
│   │   ├── components/       # Reusable UI components
│   │   ├── lib/              # tRPC client setup
│   │   └── index.css         # Global styles and theme
├── server/                    # Backend application
│   ├── _core/                # Framework core (OAuth, context, etc.)
│   ├── routers.ts            # Main tRPC router
│   ├── fraudRouter.ts        # Fraud detection API endpoints
│   ├── fraudDb.ts            # Database operations
│   ├── fraudDetection.ts     # Fraud detection algorithms
│   ├── dataProcessor.ts      # File upload and processing
│   └── *.test.ts             # Test files
├── drizzle/                   # Database schema and migrations
│   └── schema.ts             # Database tables definition
├── shared/                    # Shared types and constants
└── README.md                  # This file
```

## API Endpoints (tRPC)

### Fraud Detection Routes

- `fraud.uploadData` - Upload and analyze data file
- `fraud.getAnalysisStatus` - Get analysis run status and progress
- `fraud.getRecentAnalyses` - Get recent analysis runs
- `fraud.getDashboardStats` - Get dashboard statistics
- `fraud.searchProvider` - Search provider by NPI
- `fraud.getProviderProfile` - Get provider risk profile with transactions
- `fraud.getHighRiskProviders` - Get high-risk providers list
- `fraud.getAnomalousTransactions` - Get anomalous transactions
- `fraud.getHighRiskTransactions` - Get high-risk transactions
- `fraud.getAlerts` - Get alerts for an analysis
- `fraud.updateAlertStatus` - Update alert status
- `fraud.exportResults` - Export analysis results as CSV

## Database Schema

### Tables

- **users** - User accounts and authentication
- **providers** - Provider-level aggregated statistics
- **transactions** - Individual billing transactions with fraud scores
- **alerts** - Generated fraud alerts
- **analysisRuns** - Analysis execution tracking
- **procedureBenchmarks** - Procedure code benchmarks for comparison

## Fraud Detection Methodology

### 1. Statistical Z-Score Analysis

Calculates z-scores for cost per claim and claims per beneficiary:
```
z = (value - mean) / std_deviation
```
Flags transactions with |z| > 3 as anomalous.

### 2. Isolation Forest

Custom implementation that:
- Builds random decision trees on feature subsets
- Calculates anomaly scores based on path lengths
- Flags points with scores > 0.6 as anomalies

Features used:
- Total paid amount
- Total claims
- Total beneficiaries
- Cost per claim
- Claims per beneficiary

### 3. Temporal Spike Detection

Compares month-over-month changes:
```
change_percent = ((current - previous) / previous) * 100
```
Flags increases > 200% as suspicious spikes.

### 4. Composite Risk Scoring

Combines multiple indicators:
- Cost z-score > 3: +30 points
- Claims/beneficiary z-score > 3: +25 points
- Top 1% volume: +20 points
- ML anomaly: +25 points

Maximum score capped at 100.

## Testing

The project includes comprehensive unit tests for fraud detection algorithms:

```bash
# Run tests
pnpm test

# Tests cover:
# - Procedure benchmark calculation
# - Transaction processing
# - Fraud risk scoring
# - Provider statistics aggregation
# - Temporal spike detection
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Built with [Manus](https://manus.im) - AI-powered development platform
- Uses [shadcn/ui](https://ui.shadcn.com/) for UI components
- Fraud detection algorithms based on industry best practices

## Support

For questions or issues:
- Open an issue in this repository
- Contact the development team
- Check the documentation in `/docs` (coming soon)

## Roadmap

- [ ] Provider detail pages with spending history charts
- [ ] Interactive analytics visualizations (risk distribution, trends)
- [ ] Enhanced alert management dashboard
- [ ] CSV export functionality for reports
- [ ] Advanced filtering and search capabilities
- [ ] Multi-user role-based access control
- [ ] Automated report scheduling
- [ ] Integration with external provider databases

---

**Built with ❤️ using Manus AI Development Platform**
