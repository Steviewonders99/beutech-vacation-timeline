# IT Deployment Guide - Vacation Timeline Widget

## For: Beutech IT Team
## Date: Thursday Deployment

---

## Overview

This guide covers deploying the Vacation Timeline widget infrastructure to Azure. The deployment creates:

- **Azure Function App** - Backend API (Node.js 20)
- **Azure PostgreSQL Flexible Server** - Database
- **Azure Blob Storage** - Widget hosting (static website)
- **Application Insights** - Monitoring
- **Key Vault** (optional) - Secret storage

**Estimated time:** 30-45 minutes

---

## Prerequisites

### 1. Azure Subscription
- Contributor access to create resources
- Ability to create Azure AD App Registration

### 2. Azure AD App Registration
Create a new App Registration with the following:

| Setting | Value |
|---------|-------|
| Name | `Vacation Timeline Widget` |
| Supported account types | Single tenant |
| Redirect URI | None required |

After creation, note:
- **Application (client) ID** → `CLIENT_ID`
- **Directory (tenant) ID** → `TENANT_ID`

Create a client secret:
1. Go to Certificates & secrets
2. New client secret
3. Description: "Production"
4. Expires: 24 months
5. Copy the **Value** → `CLIENT_SECRET`

### 3. Microsoft Graph API Permissions

Add these **Application permissions** (NOT Delegated):

| Permission | Purpose |
|------------|---------|
| `Mail.Send` | Send email notifications |
| `User.Read.All` | Read user/manager info |
| `Calendars.ReadWrite` | Create vacation calendar events |
| `TeamsActivity.Send` | Teams notifications (optional) |

**Important:** Click "Grant admin consent for [Tenant]" after adding permissions.

### 4. Shared Mailbox for Calendar

Create or identify a shared mailbox for vacation events:
- Example: `vacations@beutech.com`
- This mailbox will contain all approved vacation calendar events

### 5. Tools Required

```bash
# Install Azure CLI
brew install azure-cli

# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4

# Install PostgreSQL client (for migrations)
brew install libpq
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"

# Login to Azure
az login
```

---

## Deployment Steps

### Step 1: Clone and Prepare

```bash
# Navigate to the project
cd /path/to/beutech-vacation-timeline

# Install dependencies
npm install
```

### Step 2: Deploy Infrastructure (includes Azure PostgreSQL)

```bash
# Preview what will be created
./scripts/deploy-infra.sh prod what-if

# Deploy infrastructure
./scripts/deploy-infra.sh prod deploy
```

**This creates:**
- Resource group: `rg-vacationtimeline-prod`
- Function App: `func-vacationtimeline-prod`
- PostgreSQL Server: `psql-vacationtimeline-prod`
- Storage: `stvacationtimelineprod`
- App Insights: `ai-vacationtimeline-prod`

**During deployment:**
- A secure PostgreSQL password will be generated
- **Save this password!** You'll need it for the DATABASE_URL
- Database migrations run automatically

### Step 3: Configure Environment Variables

Use the interactive script:

```bash
./scripts/configure-env.sh prod
```

Or set manually in Azure Portal:

| Variable | Value | Description |
|----------|-------|-------------|
| `TENANT_ID` | `xxxxxxxx-xxxx-...` | Azure AD tenant ID |
| `CLIENT_ID` | `xxxxxxxx-xxxx-...` | App registration client ID |
| `CLIENT_SECRET` | `xxxxx` | App registration secret |
| `DATABASE_URL` | `postgresql://vtadmin:...` | From infrastructure deployment |
| `API_KEY` | Generate secure key | Widget authentication |
| `VACATION_CALENDAR_MAILBOX` | `vacations@beutech.com` | Calendar mailbox |
| `ALLOWED_ORIGINS` | `https://beautech.staffbase.com,https://app.staffbase.com` | Staffbase domains (web + mobile) |
| `API_BASE_URL` | `https://func-vacationtimeline-prod.azurewebsites.net/api` | Enables email action buttons |
| `CALENDAR_MODE` | `shared` | Use shared calendar |
| `VACATION_CATEGORY` | `Vacation` | Calendar category |
| `DEFAULT_TIMEZONE` | `America/New_York` | or appropriate TZ |

### Step 4: Deploy Backend

```bash
./scripts/deploy-backend.sh prod
```

### Step 5: Deploy Widget

```bash
./scripts/deploy-widget.sh prod
```

### Step 6: Verify Deployment

Test the health endpoint:

```bash
curl https://func-vacationtimeline-prod.azurewebsites.net/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

---

## Staffbase Configuration

### Register Custom Widget

1. Log into Staffbase Studio
2. Go to **Plugins & Widgets** → **Custom Widgets**
3. Click **Add Widget**
4. Fill in:

| Field | Value |
|-------|-------|
| Name | `Vacation Timeline` |
| Widget URL | `https://stvacationtimelineprod.z13.web.core.windows.net/beutech.vacation-timeline.js` |
| Icon | Upload `vacation-timeline.svg` from `apps/widget/resources/` |

### Widget Configuration Properties

When adding the widget to a page, these properties are available:

| Property | Default | Description |
|----------|---------|-------------|
| `apiBaseUrl` | Required | `https://func-vacationtimeline-prod.azurewebsites.net/api` |
| `apiKey` | Required | Same as `API_KEY` env variable |
| `defaultView` | `week` | Initial calendar view |
| `showRequests` | `true` | Show request management |
| `darkMode` | `false` | Dark theme |

---

## Actionable Email Notifications

When `API_BASE_URL` is configured, email notifications include **Approve** and **Reject** buttons that managers can click directly from Outlook:

**Features:**
- One-click approve/reject from email
- Secure signed tokens (24-hour expiry)
- No need to open the widget for simple approvals
- Works in Outlook desktop, web, and mobile

**How it works:**
1. Employee submits time-off request
2. Manager receives email with Approve/Reject buttons
3. Manager clicks button → Browser opens → Action completed
4. Employee receives approval/rejection notification

**Security:**
- Tokens are cryptographically signed using API_KEY
- Tokens expire after 24 hours
- Only the designated supervisor can use the links
- Actions are logged in Application Insights

---

## Quick Reference

### Resource Names (Production)

| Resource | Name |
|----------|------|
| Resource Group | `rg-vacationtimeline-prod` |
| Function App | `func-vacationtimeline-prod` |
| PostgreSQL Server | `psql-vacationtimeline-prod` |
| Database | `vacationtimeline` |
| Storage Account | `stvacationtimelineprod` |
| App Insights | `ai-vacationtimeline-prod` |

### URLs (After Deployment)

| Endpoint | URL |
|----------|-----|
| API Base | `https://func-vacationtimeline-prod.azurewebsites.net/api` |
| Health Check | `https://func-vacationtimeline-prod.azurewebsites.net/api/health` |
| Widget JS | `https://stvacationtimelineprod.z13.web.core.windows.net/beutech.vacation-timeline.js` |
| PostgreSQL | `psql-vacationtimeline-prod.postgres.database.azure.com` |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (no auth) |
| GET | `/api/vacations` | Get vacation events |
| GET | `/api/requests` | List time-off requests |
| POST | `/api/requests` | Create new request |
| POST | `/api/requests/{id}/approve` | Approve request |
| POST | `/api/requests/{id}/reject` | Reject request |

---

## Database Connection

### Connection String Format

```
postgresql://vtadmin:{PASSWORD}@psql-vacationtimeline-prod.postgres.database.azure.com/vacationtimeline?sslmode=require
```

Replace `{PASSWORD}` with the password generated during infrastructure deployment.

### Connect with psql (for troubleshooting)

```bash
psql "postgresql://vtadmin:{PASSWORD}@psql-vacationtimeline-prod.postgres.database.azure.com/vacationtimeline?sslmode=require"
```

### View Tables

```sql
\dt
SELECT COUNT(*) FROM time_off_requests;
```

---

## Cost Estimate (Monthly)

| Resource | SKU | Est. Cost |
|----------|-----|-----------|
| Function App | Consumption | ~$0-20 (pay per use) |
| PostgreSQL | Burstable B1ms | ~$15-25 |
| Storage | Standard | ~$1-5 |
| App Insights | Pay-as-you-go | ~$0-10 |
| **Total** | | **~$20-60/month** |

---

## Troubleshooting

### Function App Not Starting

Check logs:
```bash
az functionapp log tail --name func-vacationtimeline-prod --resource-group rg-vacationtimeline-prod
```

### CORS Errors

Verify `ALLOWED_ORIGINS` includes your Staffbase domain(s).

### Graph API 403 Errors

1. Check app registration permissions
2. Ensure admin consent was granted
3. Verify `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET` are correct

### Database Connection Errors

1. Verify `DATABASE_URL` is correct (especially the password)
2. Check PostgreSQL firewall rules in Azure Portal
3. Ensure SSL mode is `require`

```bash
# Test connection
psql "postgresql://vtadmin:{PASSWORD}@psql-vacationtimeline-prod.postgres.database.azure.com/vacationtimeline?sslmode=require" -c "SELECT 1"
```

### PostgreSQL Firewall

If connection fails from your local machine:
1. Go to Azure Portal → PostgreSQL server
2. Networking → Firewall rules
3. Add your IP address

---

## Security Checklist

- [ ] `CLIENT_SECRET` is stored securely (not in code)
- [ ] `API_KEY` is a strong random value (min 24 chars)
- [ ] PostgreSQL password is stored securely
- [ ] `ALLOWED_ORIGINS` is restricted to Staffbase domain only
- [ ] HTTPS is enforced (automatic with Azure)
- [ ] Admin consent granted for Graph API permissions
- [ ] PostgreSQL SSL required

---

## Backup & Recovery

### PostgreSQL Backups
- Automatic daily backups (7-day retention by default)
- Point-in-time restore available via Azure Portal

### Manual Backup

```bash
pg_dump "postgresql://vtadmin:{PASSWORD}@psql-vacationtimeline-prod.postgres.database.azure.com/vacationtimeline?sslmode=require" > backup.sql
```

---

## Support

For issues during deployment:
- GitHub: https://github.com/beutech/vacation-timeline
- Contact: [Your IT Contact]
