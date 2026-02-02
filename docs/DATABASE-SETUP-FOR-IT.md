# Database Setup Guide for IT

This document contains everything needed to set up the PostgreSQL database for the Vacation Timeline widget.

---

## Option 1: Azure PostgreSQL (Recommended for Production)

### Step 1: Create Azure PostgreSQL Flexible Server

**Via Azure Portal:**
1. Go to Azure Portal → Create a resource → Azure Database for PostgreSQL
2. Select **Flexible Server**
3. Configure:
   - **Server name:** `vacation-timeline-db` (or your naming convention)
   - **Region:** Same as your Function App
   - **PostgreSQL version:** 15 or 16
   - **Workload type:** Development (can upgrade later)
   - **Compute + storage:** Burstable B1ms ($12/month) is sufficient to start
4. Set admin credentials (save these securely!)
5. Networking: Allow Azure services to access
6. Create

**Via Azure CLI:**
```bash
# Variables
RESOURCE_GROUP="vacation-timeline-rg"
LOCATION="eastus"
SERVER_NAME="vacation-timeline-db"
ADMIN_USER="vtadmin"
ADMIN_PASSWORD="$(openssl rand -base64 24)"  # Save this!

# Create server
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $SERVER_NAME \
  --location $LOCATION \
  --admin-user $ADMIN_USER \
  --admin-password "$ADMIN_PASSWORD" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 15 \
  --storage-size 32 \
  --yes

# Allow Azure services
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name $SERVER_NAME \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Create database
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $SERVER_NAME \
  --database-name vacationtimeline

echo "DATABASE_URL=postgresql://${ADMIN_USER}:${ADMIN_PASSWORD}@${SERVER_NAME}.postgres.database.azure.com:5432/vacationtimeline?sslmode=require"
```

### Step 2: Get Connection String

Format:
```
postgresql://USERNAME:PASSWORD@SERVER.postgres.database.azure.com:5432/DATABASE?sslmode=require
```

Example:
```
postgresql://vtadmin:MySecurePass123@vacation-timeline-db.postgres.database.azure.com:5432/vacationtimeline?sslmode=require
```

---

## Option 2: Run Schema Manually (Any PostgreSQL)

If you prefer to run the SQL directly, here's the complete schema:

```sql
-- ============================================================
-- Vacation Timeline Database Schema
-- Run this SQL in your PostgreSQL database
-- ============================================================

-- Schema version tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Main time-off requests table
CREATE TABLE IF NOT EXISTS time_off_requests (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Requester information
  requester_email VARCHAR(255) NOT NULL,
  requester_name VARCHAR(255) NOT NULL,
  requester_id VARCHAR(255),

  -- Supervisor information
  supervisor_email VARCHAR(255) NOT NULL,
  supervisor_name VARCHAR(255) NOT NULL,
  supervisor_id VARCHAR(255),

  -- Request details
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type VARCHAR(50) DEFAULT 'vacation',
  reason TEXT,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending',
  status_changed_at TIMESTAMPTZ,
  status_changed_by VARCHAR(255),

  -- Integration
  calendar_event_id VARCHAR(255),

  -- Rejection details
  rejection_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_dates CHECK (end_date >= start_date),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT valid_leave_type CHECK (leave_type IN ('vacation', 'sick', 'personal', 'other'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_requests_requester ON time_off_requests(requester_email);
CREATE INDEX IF NOT EXISTS idx_requests_supervisor ON time_off_requests(supervisor_email);
CREATE INDEX IF NOT EXISTS idx_requests_status ON time_off_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_dates ON time_off_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_requests_created ON time_off_requests(created_at DESC);

-- Compound index for supervisor pending requests query
CREATE INDEX IF NOT EXISTS idx_requests_supervisor_pending
  ON time_off_requests(supervisor_email, status)
  WHERE status = 'pending';

-- Record migration
INSERT INTO schema_migrations (version) VALUES ('001_initial_schema')
ON CONFLICT (version) DO NOTHING;

-- Comments
COMMENT ON TABLE time_off_requests IS 'Stores time-off requests submitted through the widget';
COMMENT ON COLUMN time_off_requests.status IS 'Request status: pending, approved, or rejected';
COMMENT ON COLUMN time_off_requests.calendar_event_id IS 'Microsoft Graph calendar event ID (set on approval)';
```

---

## Option 3: Use Migration Script

If you have Node.js installed:

```bash
# 1. Clone the repo (or copy the backend folder)
cd apps/backend

# 2. Install dependencies
npm install

# 3. Run migrations
DATABASE_URL="postgresql://user:pass@server:5432/db?sslmode=require" npm run migrate
```

---

## Verify Setup

### Test Connection
```bash
# Using psql
psql "postgresql://user:pass@server:5432/db?sslmode=require" -c "SELECT 1;"

# Using Azure CLI
az postgres flexible-server connect \
  --name vacation-timeline-db \
  --admin-user vtadmin \
  --admin-password "$ADMIN_PASSWORD" \
  --database vacationtimeline
```

### Verify Tables Exist
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```

Expected output:
```
     table_name
---------------------
 schema_migrations
 time_off_requests
```

### Check Indexes
```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'time_off_requests';
```

Expected output:
```
          indexname
------------------------------
 time_off_requests_pkey
 idx_requests_requester
 idx_requests_supervisor
 idx_requests_status
 idx_requests_dates
 idx_requests_created
 idx_requests_supervisor_pending
```

---

## Configure Function App

Add the `DATABASE_URL` to your Azure Function App settings:

**Via Azure Portal:**
1. Go to Function App → Configuration → Application settings
2. Add new setting:
   - **Name:** `DATABASE_URL`
   - **Value:** `postgresql://user:pass@server.postgres.database.azure.com:5432/vacationtimeline?sslmode=require`
3. Save

**Via Azure CLI:**
```bash
az functionapp config appsettings set \
  --name "vacation-timeline-func" \
  --resource-group "vacation-timeline-rg" \
  --settings "DATABASE_URL=postgresql://user:pass@server:5432/db?sslmode=require"
```

---

## Table Schema Reference

### time_off_requests

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `requester_email` | VARCHAR(255) | Employee's email |
| `requester_name` | VARCHAR(255) | Employee's display name |
| `requester_id` | VARCHAR(255) | Microsoft Graph user ID |
| `supervisor_email` | VARCHAR(255) | Manager's email |
| `supervisor_name` | VARCHAR(255) | Manager's display name |
| `supervisor_id` | VARCHAR(255) | Microsoft Graph user ID |
| `start_date` | DATE | First day of time off |
| `end_date` | DATE | Last day of time off |
| `leave_type` | VARCHAR(50) | vacation, sick, personal, other |
| `reason` | TEXT | Optional reason/notes |
| `status` | VARCHAR(20) | pending, approved, rejected |
| `status_changed_at` | TIMESTAMPTZ | When status was changed |
| `status_changed_by` | VARCHAR(255) | Who changed the status |
| `calendar_event_id` | VARCHAR(255) | Graph API event ID (after approval) |
| `rejection_reason` | TEXT | Reason for rejection |
| `created_at` | TIMESTAMPTZ | When request was created |
| `updated_at` | TIMESTAMPTZ | When request was last updated |

---

## Troubleshooting

### "relation does not exist"
Run the migration script or execute the SQL schema above.

### "connection refused"
- Check firewall rules allow Azure services
- Verify the server name in connection string
- Ensure SSL is enabled (`?sslmode=require`)

### "password authentication failed"
- Verify username and password
- Check for special characters that need URL encoding

### "SSL required"
Add `?sslmode=require` to the end of your connection string.

---

## Security Notes

1. **Never commit DATABASE_URL to git** - Use environment variables or Key Vault
2. **Use strong passwords** - Generate with `openssl rand -base64 24`
3. **Restrict network access** - Only allow Azure services and specific IPs
4. **Enable SSL** - Always use `sslmode=require` for Azure PostgreSQL
5. **Rotate credentials** - Change passwords periodically

---

## Support

If you encounter issues:
1. Check the `/api/diagnostics` endpoint (requires API key)
2. Check Azure Function logs in Application Insights
3. Verify connection string format matches exactly
