# Quick Deploy Checklist

## Before Starting (IT Team Needs)

```
□ Azure AD App Registration
  - Client ID: _______________________
  - Tenant ID: _______________________
  - Client Secret: ___________________

□ Graph API Permissions (with admin consent):
  - Mail.Send
  - User.Read.All
  - Calendars.ReadWrite

□ Shared Mailbox: vacations@____________.com
```

## Deploy Commands (In Order)

```bash
# 1. Login to Azure
az login

# 2. Deploy Infrastructure (creates PostgreSQL, Function App, Storage)
./scripts/deploy-infra.sh prod deploy
# ⚠️  SAVE THE POSTGRES PASSWORD SHOWN IN OUTPUT!

# 3. Configure Environment Variables
./scripts/configure-env.sh prod

# 4. Deploy Backend
./scripts/deploy-backend.sh prod

# 5. Deploy Widget
./scripts/deploy-widget.sh prod

# 6. Verify
curl https://func-vacationtimeline-prod.azurewebsites.net/api/health
```

## OR One-Command Deploy

```bash
./scripts/deploy-all.sh prod
```

## Environment Variables to Set

| Variable | Value |
|----------|-------|
| TENANT_ID | `<from Azure AD>` |
| CLIENT_ID | `<from Azure AD>` |
| CLIENT_SECRET | `<from Azure AD>` |
| DATABASE_URL | `postgresql://vtadmin:{PASS}@psql-vacationtimeline-prod.postgres.database.azure.com/vacationtimeline?sslmode=require` |
| API_KEY | `<generate strong key>` |
| VACATION_CALENDAR_MAILBOX | `vacations@beutech.com` |
| ALLOWED_ORIGINS | `https://beautech.staffbase.com,https://app.staffbase.com` |

## Staffbase Widget Registration

1. **Widget URL:** `https://stvacationtimelineprod.z13.web.core.windows.net/beutech.vacation-timeline.js`

2. **Widget Config:**
   - apiBaseUrl: `https://func-vacationtimeline-prod.azurewebsites.net/api`
   - apiKey: `<same as API_KEY above>`

## Verify Everything Works

```bash
# Health check
curl https://func-vacationtimeline-prod.azurewebsites.net/api/health

# Get vacations (needs API key)
curl -H "X-API-Key: YOUR_API_KEY" \
  "https://func-vacationtimeline-prod.azurewebsites.net/api/vacations?startDate=2024-01-01&endDate=2024-12-31"
```

## Resources Created

| Resource | Name |
|----------|------|
| Resource Group | `rg-vacationtimeline-prod` |
| Function App | `func-vacationtimeline-prod` |
| PostgreSQL | `psql-vacationtimeline-prod` |
| Database | `vacationtimeline` |
| Storage | `stvacationtimelineprod` |

## If Something Goes Wrong

```bash
# Check function logs
az functionapp log tail --name func-vacationtimeline-prod --resource-group rg-vacationtimeline-prod

# Test database connection
psql "postgresql://vtadmin:{PASSWORD}@psql-vacationtimeline-prod.postgres.database.azure.com/vacationtimeline?sslmode=require" -c "SELECT 1"
```

## Estimated Monthly Cost

~$20-60/month (PostgreSQL Burstable + Function App consumption)
