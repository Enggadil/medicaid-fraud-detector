# I Found HHS's Open Medicaid Dataset and Built a Fraud Detection System. Now It's Yours.

A few weeks ago, I stumbled upon something interesting: the U.S. Department of Health and Human Services had quietly released a massive open dataset containing Medicaid provider spending data. **3.36 GB of billing records, spanning from 2018 to 2024, completely public and accessible to anyone.**

As someone interested in healthcare technology and data analysis, I couldn't resist diving in. What started as weekend curiosity turned into a full-fledged fraud detection platform—and today, I'm **open-sourcing the entire system** so others can explore, improve, and use it.

## The Discovery

The dataset lives at [opendata.hhs.gov/datasets/medicaid-provider-spending](https://opendata.hhs.gov/datasets/medicaid-provider-spending/) and contains detailed billing information: provider NPIs, procedure codes, claim counts, beneficiary numbers, and payment amounts. It's exactly the kind of data that fraud investigators use, but now it's available to researchers, developers, and anyone curious about healthcare billing patterns.

I downloaded a sample, loaded it into a spreadsheet, and immediately saw the potential. Some providers had billing patterns that stood out dramatically—massive spikes in claims, costs far above peers, suspicious temporal patterns. The data was practically begging to be analyzed systematically.

So I built a system to do exactly that.

## What I Built

Over the past few weeks, I designed and developed a **full-stack fraud detection platform** that automatically analyzes Medicaid billing data and flags suspicious patterns. Here's what it does:

### Automated Fraud Detection

The system uses multiple detection techniques working together:

**Statistical Analysis** calculates z-scores for every transaction, comparing each provider's billing against peer benchmarks. When someone charges three standard deviations above the average for a procedure code, that's a red flag worth investigating.

**Machine Learning** runs an Isolation Forest algorithm that I implemented from scratch. Unlike simple statistical tests, this model looks at multiple variables simultaneously—total spending, claim volumes, beneficiary counts, and derived metrics—to catch sophisticated fraud patterns that might slip through traditional analysis.

**Temporal Pattern Recognition** tracks month-over-month changes in billing behavior. A provider who suddenly doubles or triples their claim volume triggers an alert, because sudden spikes often indicate fraudulent activity or systematic billing errors.

**Composite Risk Scoring** combines all these signals into a single 0-100 risk score for each provider, making it easy to prioritize which cases deserve investigation first.

### Real Results from Testing

I tested the system with synthetic data that included intentionally planted fraud patterns. The results were promising:

- Detected **220 cost anomalies** where providers charged significantly above peer averages
- Flagged **595 volume anomalies** indicating unusually high claim volumes  
- Identified **2,981 multivariate anomalies** through machine learning
- Caught **temporal spikes** showing sudden billing increases over 200%

The system processed tens of thousands of transactions in minutes and successfully identified all four types of fraud I had hidden in the test data.

## Why I'm Open-Sourcing This

Healthcare fraud costs the U.S. system an estimated **$68 billion annually**. Medicaid, serving over 80 million Americans, is particularly vulnerable because of its scale and complexity. Traditional manual auditing can't keep pace with the volume of transactions, and sophisticated fraud detection tools are often available only to large organizations with substantial technology budgets.

**This dataset is public. The fraud detection techniques are well-established. There's no reason this capability should be locked behind proprietary systems.**

By open-sourcing this platform, I'm hoping to:

- **Enable smaller organizations** like state Medicaid agencies and healthcare auditors to access advanced fraud detection
- **Invite collaboration** from data scientists, healthcare professionals, and developers who can improve the algorithms
- **Encourage transparency** in how we detect and investigate healthcare fraud
- **Spark innovation** in applying machine learning to public health challenges

## What's Inside

The repository includes everything you need to deploy and customize the platform:

### Technology Stack

- **Frontend:** React 19 with Tailwind CSS for a modern, responsive interface
- **Backend:** Node.js with Express and tRPC for type-safe APIs
- **Database:** MySQL with Drizzle ORM for efficient data management
- **Storage:** AWS S3 integration for uploaded datasets
- **Testing:** Comprehensive test suite ensuring algorithm accuracy

Everything is written in TypeScript, providing end-to-end type safety from database to UI.

### Documentation

- Complete README with installation instructions and usage guide
- Detailed fraud detection methodology explanations
- API documentation for all endpoints
- Deployment guides for multiple platforms (Vercel, Railway, Manus)
- Test suite with 12 passing tests

### Features

- Drag-and-drop file upload supporting CSV, Parquet, and ZIP formats
- Real-time analysis progress tracking
- Interactive dashboard with key metrics and alerts
- High-risk provider tracking with detailed risk profiles
- Automated alert generation for critical fraud patterns
- Cloud storage integration for historical analysis

## How You Can Help

This is an **initial exploration**—a working prototype that demonstrates what's possible with this public dataset. But it's far from complete, and that's where you come in.

### If You're a Developer

- **Improve the algorithms:** Experiment with different ML models, optimize performance, add new detection techniques
- **Build visualizations:** Create interactive charts showing risk distributions, spending trends, procedure analysis
- **Enhance the UI:** Add provider detail pages, advanced filtering, investigation workflows
- **Optimize performance:** Make it handle larger datasets more efficiently

### If You Work in Healthcare

- **Validate the results:** Review flagged cases and tell me if the detection logic makes sense
- **Share domain expertise:** Help identify fraud patterns I might have missed
- **Test with real data:** If you have access to Medicaid data, try the system and provide feedback

### If You're a Data Scientist

- **Experiment with models:** Test different anomaly detection approaches and compare results
- **Feature engineering:** Identify new derived metrics that improve detection accuracy
- **Benchmark performance:** Evaluate against other fraud detection datasets

### If You're Just Curious

- **Star the repository** to show interest and help others discover it
- **Share this post** with anyone working in healthcare fraud detection
- **Try the demo** and let me know what you think

## The Bigger Picture

This project started with a simple question: "What can we learn from this newly released public dataset?" The answer turned out to be quite a lot.

But more importantly, it demonstrated that **powerful fraud detection tools don't need to be proprietary black boxes**. With open data, open-source algorithms, and community collaboration, we can build transparent, accessible systems that serve the public interest.

Healthcare fraud diverts critical resources away from patient care. Every dollar recovered is a dollar that can be reinvested in serving the vulnerable populations who depend on Medicaid. If this platform helps even one organization catch fraudulent billing they would have otherwise missed, it will have been worth the effort.

## What's Next

I'm continuing to develop this platform, but I'm also excited to see where the community takes it. Some ideas for future enhancements:

- Provider detail pages with comprehensive risk profiles
- Interactive analytics dashboards with advanced visualizations  
- Alert management workflows for investigation teams
- Multi-user access control with role-based permissions
- Integration with external provider databases
- Automated report generation and scheduling

But these are just my ideas. **I'm curious what you would build with this.**

## Join Me

The repository is live on GitHub right now. The code is MIT licensed—free to use, modify, and distribute. Whether you want to deploy it for your organization, contribute improvements, or just explore the HHS dataset yourself, everything you need is there.

I built this because I was curious about a public dataset and wanted to see what was possible. Now I'm sharing it because I believe **transparency and collaboration make us all better at solving hard problems**.

If you work in healthcare, fraud detection, data science, or you're just interested in applying technology to public health challenges, **I'd love to have you contribute**. Fork the repo, open issues, submit pull requests, or just try it out and let me know what you think.

Let's see what we can build together.

---

**Repository:** [Link to your GitHub repository]  
**Live Demo:** [Link if available]  
**Dataset:** https://opendata.hhs.gov/datasets/medicaid-provider-spending/

**Tech Stack:** React, Node.js, TypeScript, tRPC, MySQL, AWS S3  
**License:** MIT (Open Source)  
**Status:** Working prototype, actively seeking contributors

---

**How to Get Involved:**

⭐ **Star the repository** if this interests you  
🔀 **Fork and contribute** to improve fraud detection  
💬 **Comment below** with your thoughts or questions  
📧 **Connect with me** to discuss collaboration  
📢 **Share this post** to spread the word

---

**Tags:** #OpenSource #HealthcareFraud #Medicaid #DataScience #MachineLearning #PublicHealth #FraudDetection #OpenData #TypeScript #React #HealthTech #CivicTech #Analytics #AI

---

*Note: This platform is designed to assist fraud detection efforts and should be used alongside professional judgment and established investigation procedures. The HHS dataset is public, but always consult with legal and compliance experts before taking action based on automated analysis.*
