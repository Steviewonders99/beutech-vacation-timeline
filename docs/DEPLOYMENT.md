# Backend Deployment Guide

## Quick Reference

**Function App:** `vacation-timeline`
**SCM URL:** `vacation-timeline-fgcmcrc0c5ezfuf5.scm.centralus-01.azurewebsites.net`
**API URL:** `https://vacation-timeline-fgcmcrc0c5ezfuf5.centralus-01.azurewebsites.net`

---

## Step 1: Get Publish Profile (One-Time Setup)

1. Go to **Azure Portal** → **Function Apps** → `vacation-timeline`
2. Click **Download publish profile** (top toolbar)
3. Save as `/Users/stevenjunop/Downloads/vacation-timeline.PublishSettings`

Extract credentials from the XML:
- **Username:** `$vacation-timeline`
- **Password:** (from `userPWD` attribute in the XML)

---

## Step 2: Build the Backend

```bash
cd /Users/stevenjunop/beutech-vacation-timeline
npm run build -w apps/backend
```

---

## Step 3: Create Deployment Package

```bash
# Create clean deployment directory
rm -rf /tmp/backend-deploy-clean && mkdir -p /tmp/backend-deploy-clean

# Copy built code
cp -r apps/backend/dist/* /tmp/backend-deploy-clean/
cp apps/backend/host.json /tmp/backend-deploy-clean/

# Create production-only package.json (NO devDependencies)
cat > /tmp/backend-deploy-clean/package.json << 'EOF'
{
  "name": "@beutech/vacation-timeline-backend",
  "version": "1.0.0",
  "private": true,
  "main": "src/functions/*/index.js",
  "dependencies": {
    "@azure/functions": "^4.5.0",
    "@azure/identity": "^4.2.0",
    "@microsoft/microsoft-graph-client": "^3.0.7",
    "pg": "^8.11.0",
    "applicationinsights": "^2.9.0",
    "zod": "^3.22.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Copy node_modules
cp -r node_modules /tmp/backend-deploy-clean/

# Create zip
cd /tmp/backend-deploy-clean && zip -rq ../backend-deploy.zip .
```

---

## Step 4: Deploy via Kudu API

Create deployment script `/tmp/deploy.sh`:

```bash
#!/bin/bash
curl -X POST "https://vacation-timeline-fgcmcrc0c5ezfuf5.scm.centralus-01.azurewebsites.net/api/zipdeploy" \
  -u '$vacation-timeline:YOUR_PASSWORD_HERE' \
  --data-binary @/tmp/backend-deploy.zip \
  --max-time 600
```

Run it:
```bash
chmod +x /tmp/deploy.sh
/tmp/deploy.sh
```

---

## Step 5: Verify Deployment

Check deployment status:
```bash
curl -s "https://vacation-timeline-fgcmcrc0c5ezfuf5.scm.centralus-01.azurewebsites.net/api/deployments/latest" \
  -u '$vacation-timeline:YOUR_PASSWORD_HERE' | python3 -m json.tool
```

**Status codes:**
- `0` = Pending
- `1` = Building
- `3` = Failed
- `4` = Success ✓

---

## Troubleshooting

### "Deployment currently in progress"
Wait for it to complete (can take 2-5 minutes), then retry.

### Deployment times out but shows status 4
**It actually succeeded!** The Kudu API sometimes times out but the deployment completes in the background. Check the status endpoint to confirm.

### Status 3 (Failed)
Check logs:
```bash
curl -s "https://vacation-timeline-fgcmcrc0c5ezfuf5.scm.centralus-01.azurewebsites.net/api/deployments/DEPLOYMENT_ID/log" \
  -u '$vacation-timeline:YOUR_PASSWORD_HERE' | python3 -m json.tool
```

Common causes:
- npm dependency conflicts (ensure package.json has NO devDependencies)
- Missing node_modules

---

## Full One-Liner Deploy Script

Save this as `deploy-backend.sh` in the project root:

```bash
#!/bin/bash
set -e

echo "Building backend..."
cd /Users/stevenjunop/beutech-vacation-timeline
npm run build -w apps/backend

echo "Creating deployment package..."
rm -rf /tmp/backend-deploy-clean && mkdir -p /tmp/backend-deploy-clean
cp -r apps/backend/dist/* /tmp/backend-deploy-clean/
cp apps/backend/host.json /tmp/backend-deploy-clean/

cat > /tmp/backend-deploy-clean/package.json << 'PKGJSON'
{
  "name": "@beutech/vacation-timeline-backend",
  "version": "1.0.0",
  "private": true,
  "main": "src/functions/*/index.js",
  "dependencies": {
    "@azure/functions": "^4.5.0",
    "@azure/identity": "^4.2.0",
    "@microsoft/microsoft-graph-client": "^3.0.7",
    "pg": "^8.11.0",
    "applicationinsights": "^2.9.0",
    "zod": "^3.22.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
PKGJSON

cp -r node_modules /tmp/backend-deploy-clean/
cd /tmp/backend-deploy-clean && zip -rq ../backend-deploy.zip .

echo "Deploying to Azure..."
curl -X POST "https://vacation-timeline-fgcmcrc0c5ezfuf5.scm.centralus-01.azurewebsites.net/api/zipdeploy" \
  -u '$vacation-timeline:YOUR_PASSWORD_HERE' \
  --data-binary @/tmp/backend-deploy.zip \
  --max-time 600

echo ""
echo "Checking deployment status..."
sleep 10
curl -s "https://vacation-timeline-fgcmcrc0c5ezfuf5.scm.centralus-01.azurewebsites.net/api/deployments/latest" \
  -u '$vacation-timeline:YOUR_PASSWORD_HERE' | python3 -c "
import sys, json
d = json.load(sys.stdin)
status = {0:'Pending', 1:'Building', 3:'Failed', 4:'Success'}
print(f\"Status: {status.get(d['status'], d['status'])}, Complete: {d['complete']}\")
"
```

---

## Important Notes

1. **Password Security:** Never commit the password. Store in environment variable:
   ```bash
   export AZURE_DEPLOY_PASSWORD="your-password-here"
   ```
   Then use `$AZURE_DEPLOY_PASSWORD` in scripts.

2. **Package.json:** The deployed package.json must NOT have devDependencies or Oryx will try to install them and fail.

3. **node_modules:** We include node_modules to avoid remote npm install issues.

4. **Timeouts:** The deployment can take 2-5 minutes. If curl times out, check status manually - it often succeeds anyway.

---

## CI/CD Alternative

For automated deployments via GitHub Actions, configure these secrets:
- `AZURE_CREDENTIALS_DEV` - Azure service principal JSON

The workflow in `.github/workflows/ci-cd.yml` handles deployment automatically on push to main.
