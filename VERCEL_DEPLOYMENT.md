# Vercel Deployment Guide

This guide will walk you through deploying the Medicaid Fraud Detection Platform to Vercel.

## ⚠️ Important Limitations

**Vercel is NOT recommended for this application** because:

1. **No Built-in Database** - Vercel doesn't provide a database. You'll need to use an external service like PlanetScale, Neon, or Supabase.
2. **Serverless Functions** - The backend runs as serverless functions with cold starts and execution time limits (10s hobby, 60s pro).
3. **No Persistent Storage** - File uploads require external storage (S3, Cloudflare R2, etc.).
4. **Complex Setup** - Requires significant configuration compared to Manus's one-click deployment.

**Recommended Alternative:** Use Manus built-in hosting (click Publish button) or Railway/Render for simpler deployment.

---

## Prerequisites

Before deploying to Vercel, you need:

1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository** - Your code must be in a GitHub repo
3. **External Database** - MySQL/PostgreSQL database (PlanetScale, Neon, Supabase)
4. **S3 Storage** - AWS S3 or compatible service for file uploads
5. **OAuth Provider** - For authentication (or disable auth features)

## Step 1: Set Up External Database

### Option A: PlanetScale (Recommended for MySQL)

1. Go to [planetscale.com](https://planetscale.com) and create an account
2. Create a new database named `medicaid-fraud-detector`
3. Get your connection string from the dashboard
4. Format: `mysql://user:password@host/database?sslaccept=strict`

### Option B: Neon (PostgreSQL)

1. Go to [neon.tech](https://neon.tech) and create an account
2. Create a new project
3. Get your connection string
4. **Note:** You'll need to convert Drizzle schema from MySQL to PostgreSQL

### Option C: Supabase (PostgreSQL)

1. Go to [supabase.com](https://supabase.com) and create a project
2. Get your database connection string from Settings → Database
3. **Note:** Requires schema conversion from MySQL to PostgreSQL

## Step 2: Set Up S3 Storage

### Option A: AWS S3

1. Create an AWS account and set up S3 bucket
2. Create IAM user with S3 access
3. Get credentials:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`
   - `AWS_S3_BUCKET`

### Option B: Cloudflare R2 (S3-compatible)

1. Go to Cloudflare dashboard → R2
2. Create a bucket
3. Create API token with R2 permissions
4. Get credentials (same format as AWS)

## Step 3: Modify Code for Vercel

### 3.1 Update Package.json

Add Vercel-specific scripts:

```json
{
  "scripts": {
    "vercel-build": "vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=api"
  }
}
```

### 3.2 Create API Entry Point

Create `api/index.js`:

```javascript
// This file adapts the Express app to Vercel's serverless format
import { createServer } from '../dist/index.js';

export default async function handler(req, res) {
  const app = await createServer();
  return app(req, res);
}
```

### 3.3 Update Database Connection

Modify `server/db.ts` to handle serverless connection pooling:

```typescript
// Add connection pooling for serverless
const connectionLimit = process.env.VERCEL ? 1 : 10;
```

## Step 4: Configure Environment Variables

In Vercel dashboard, add these environment variables:

### Required Variables

```bash
# Database
DATABASE_URL=mysql://user:password@host/database?sslaccept=strict

# Authentication (if using Manus OAuth, you'll need alternatives)
JWT_SECRET=your-random-secret-key-min-32-chars
OAUTH_SERVER_URL=https://your-oauth-provider.com
VITE_OAUTH_PORTAL_URL=https://your-oauth-portal.com

# Storage (AWS S3 or compatible)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name

# Application
NODE_ENV=production
VITE_APP_ID=medicaid-fraud-detector
VITE_APP_TITLE=Medicaid Fraud Detection
```

### Optional Variables

```bash
# If using custom OAuth
OWNER_OPEN_ID=your-owner-id
OWNER_NAME=Your Name

# Frontend API endpoints
VITE_FRONTEND_FORGE_API_URL=/api
VITE_FRONTEND_FORGE_API_KEY=your-api-key
```

## Step 5: Deploy to Vercel

### Method 1: Vercel Dashboard (Easiest)

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure build settings:
   - **Framework Preset:** Other
   - **Build Command:** `pnpm vercel-build`
   - **Output Directory:** `dist`
   - **Install Command:** `pnpm install`
5. Add all environment variables from Step 4
6. Click "Deploy"

### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod

# Follow prompts to configure project
```

## Step 6: Run Database Migrations

After deployment, you need to run migrations:

### Option 1: Use Drizzle Kit

```bash
# Set DATABASE_URL locally
export DATABASE_URL="your-production-database-url"

# Run migrations
pnpm drizzle-kit push
```

### Option 2: Manual SQL Execution

1. Connect to your database using a SQL client
2. Run the migration SQL from `drizzle/*.sql` files
3. Execute in order (0000, 0001, etc.)

## Step 7: Test Your Deployment

1. Visit your Vercel URL (e.g., `https://your-app.vercel.app`)
2. Test file upload functionality
3. Verify database connectivity
4. Check that fraud detection analysis works
5. Ensure S3 file storage is working

## Troubleshooting

### Issue: "Database connection failed"

**Solution:** 
- Verify `DATABASE_URL` is correct in Vercel environment variables
- Ensure database allows connections from Vercel IPs
- Check SSL/TLS settings in connection string

### Issue: "Function timeout"

**Solution:**
- Upgrade to Vercel Pro for 60s timeout (hobby is 10s)
- Optimize fraud detection algorithms
- Process large files asynchronously

### Issue: "File upload fails"

**Solution:**
- Verify S3 credentials are correct
- Check bucket permissions (public read, authenticated write)
- Ensure CORS is configured on S3 bucket

### Issue: "OAuth/Authentication not working"

**Solution:**
- Manus OAuth won't work on Vercel - you need alternative auth
- Consider using NextAuth.js, Auth0, or Clerk
- Or remove authentication requirements for testing

### Issue: "Cold starts are slow"

**Solution:**
- Vercel serverless functions have cold starts (1-3s)
- Upgrade to Pro for better performance
- Consider using Vercel Edge Functions for critical paths

## Cost Considerations

### Vercel Pricing

- **Hobby (Free):** 
  - 100GB bandwidth/month
  - 10s function timeout
  - 12 serverless functions
  - Good for testing only

- **Pro ($20/month):**
  - 1TB bandwidth
  - 60s function timeout
  - Unlimited functions
  - Better for production

### External Service Costs

- **PlanetScale:** Free tier (5GB storage), then $29/month
- **AWS S3:** ~$0.023/GB storage + transfer costs
- **Neon:** Free tier (0.5GB), then $19/month

**Total Monthly Cost:** $50-100+ for production use

## Alternative: Use Manus Hosting Instead

**Why Manus is Better for This App:**

✅ One-click deployment (no configuration)  
✅ Built-in database (no external service needed)  
✅ Included S3 storage  
✅ OAuth authentication pre-configured  
✅ No cold starts  
✅ Custom domain support  
✅ Lower total cost  

**To deploy on Manus:**
1. Click the "Publish" button in the Management UI
2. Choose your domain
3. Done! 🎉

## Conclusion

While Vercel deployment is possible, it requires:
- External database setup and management
- S3 storage configuration
- OAuth replacement or custom auth
- Ongoing cost management
- Performance optimization for serverless

**Recommendation:** Use Manus built-in hosting for the easiest, most cost-effective deployment of this full-stack application.

---

## Need Help?

- Vercel Documentation: [vercel.com/docs](https://vercel.com/docs)
- PlanetScale Docs: [planetscale.com/docs](https://planetscale.com/docs)
- Manus Support: [help.manus.im](https://help.manus.im)
