# Beautech Vacation Timeline - IT Admin Setup Checklist

This document provides step-by-step instructions for setting up the Vacation Timeline widget's backend services. **Estimated time: 30-45 minutes**

---

## Prerequisites

- [ ] Global Administrator or Application Administrator role in Microsoft 365
- [ ] Access to Azure Portal (portal.azure.com)
- [ ] Access to Staffbase Studio (admin)

---

## Part 1: Azure AD App Registration (15 minutes)

### Step 1.1: Create the App Registration

1. [ ] Go to [Azure Portal](https://portal.azure.com)
2. [ ] Navigate to **Microsoft Entra ID** → **App registrations**
3. [ ] Click **+ New registration**
4. [ ] Fill in:
   - **Name:** `Beautech Vacation Timeline`
   - **Supported account types:** `Accounts in this organizational directory only`
   - **Redirect URI:** Leave blank (not needed for app-only auth)
5. [ ] Click **Register**
6. [ ] **Copy and save these values:**
   - Application (client) ID: `_______________________`
   - Directory (tenant) ID: `_______________________`

### Step 1.2: Create Client Secret

1. [ ] In your app registration, go to **Certificates & secrets**
2. [ ] Click **+ New client secret**
3. [ ] Description: `Vacation Timeline Backend`
4. [ ] Expiration: `24 months` (set calendar reminder to renew!)
5. [ ] Click **Add**
6. [ ] **Copy the secret value immediately** (it won't be shown again):
   - Client Secret: `_______________________`

### Step 1.3: Add API Permissions

1. [ ] Go to **API permissions**
2. [ ] Click **+ Add a permission** → **Microsoft Graph** → **Application permissions**
3. [ ] Add these permissions (search and check each):

| Permission | Purpose |
|------------|---------|
| [ ] `Calendars.Read` | Read employee vacation events |
| [ ] `Calendars.ReadWrite` | Create approved vacation events |
| [ ] `Mail.Send` | Send approval/rejection notifications |
| [ ] `User.Read.All` | Look up employee's manager |

4. [ ] Click **Add permissions**
5. [ ] Click **Grant admin consent for Beautech**
6. [ ] Confirm by clicking **Yes**
7. [ ] Verify all permissions show green checkmarks ✓

---

## Part 2: Database Setup - Neon PostgreSQL (10 minutes)

### Step 2.1: Create Neon Account

1. [ ] Go to [neon.tech](https://neon.tech)
2. [ ] Sign up with GitHub or email
3. [ ] Verify your email if required

### Step 2.2: Create Database Project

1. [ ] Click **Create a project**
2. [ ] Fill in:
   - **Project name:** `beautech-vacation`
   - **Region:** `US East (Ohio)` or closest to your users
   - **PostgreSQL version:** `16`
3. [ ] Click **Create project**
4. [ ] **Copy the connection string:**
   - Connection string: `postgres://___________________________`

### Step 2.3: Run Database Migration

1. [ ] In Neon dashboard, click **SQL Editor** (left sidebar)
2. [ ] Copy and paste this entire SQL script:

```sql
-- Create enum types
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE leave_type AS ENUM ('vacation', 'sick', 'personal', 'other');

-- Create main table
CREATE TABLE time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_email VARCHAR(255) NOT NULL,
  requester_name VARCHAR(255) NOT NULL,
  requester_id VARCHAR(255),
  supervisor_email VARCHAR(255) NOT NULL,
  supervisor_name VARCHAR(255),
  supervisor_id VARCHAR(255),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type leave_type DEFAULT 'vacation',
  reason TEXT,
  status request_status DEFAULT 'pending',
  status_changed_at TIMESTAMP WITH TIME ZONE,
  status_changed_by VARCHAR(255),
  rejection_reason TEXT,
  calendar_event_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Create indexes for performance
CREATE INDEX idx_requests_requester ON time_off_requests(requester_email);
CREATE INDEX idx_requests_supervisor ON time_off_requests(supervisor_email);
CREATE INDEX idx_requests_status ON time_off_requests(status);
CREATE INDEX idx_requests_dates ON time_off_requests(start_date, end_date);
CREATE INDEX idx_requests_created ON time_off_requests(created_at DESC);
```

3. [ ] Click **Run**
4. [ ] Verify you see "CREATE TABLE" and "CREATE INDEX" success messages

---

## Part 3: Azure Functions Configuration (10 minutes)

### Step 3.1: Access Azure Functions

1. [ ] Go to [Azure Portal](https://portal.azure.com)
2. [ ] Navigate to your Function App (or create one if needed)
3. [ ] Go to **Configuration** → **Application settings**

### Step 3.2: Add Environment Variables

Click **+ New application setting** for each:

| Name | Value | Notes |
|------|-------|-------|
| [ ] `TENANT_ID` | Your Directory (tenant) ID | From Step 1.1 |
| [ ] `CLIENT_ID` | Your Application (client) ID | From Step 1.1 |
| [ ] `CLIENT_SECRET` | Your client secret value | From Step 1.2 |
| [ ] `DATABASE_URL` | Your Neon connection string | From Step 2.2 |
| [ ] `API_KEY` | Generate a random 32+ character string | For widget authentication |

**To generate a secure API key:**
```
openssl rand -hex 32
```
Or use: https://randomkeygen.com (use "256-bit WEP Key")

4. [ ] Click **Save**
5. [ ] Click **Continue** to confirm restart

---

## Part 4: Staffbase Widget Configuration (5 minutes)

### Step 4.1: Update Widget Settings

1. [ ] Go to Staffbase Studio
2. [ ] Navigate to the Vacation Timeline widget
3. [ ] In widget settings, configure:
   - **API Endpoint:** `https://your-function-app.azurewebsites.net/api`
   - **API Key:** The same API_KEY value from Step 3.2

---

## Part 5: Verification (5 minutes)

### Test the Setup

1. [ ] Open the Vacation Timeline widget in Staffbase
2. [ ] Verify calendar events load (tests read permissions)
3. [ ] Submit a test time-off request
4. [ ] Check that the supervisor receives an email notification
5. [ ] Approve the request as supervisor
6. [ ] Verify calendar event is created in the requester's Outlook

---

## Troubleshooting

### "Access Denied" errors
- Verify admin consent was granted (green checkmarks in API permissions)
- Check that CLIENT_ID and CLIENT_SECRET match

### "Database connection failed"
- Verify DATABASE_URL includes `?sslmode=require`
- Check Neon project is active (not paused)

### "No manager found" errors
- Ensure employees have managers assigned in Microsoft 365 admin center
- Check User.Read.All permission is granted

### Notifications not sending
- Verify Mail.Send permission is granted
- Check that email addresses are valid M365 accounts

---

## Security Notes

- [ ] Store credentials securely (never in code repositories)
- [ ] Set calendar reminder to rotate client secret before expiration
- [ ] Review API permissions periodically
- [ ] Neon free tier pauses after 5 days of inactivity (upgrade if needed)

---

## Support Contacts

- **Widget Developer:** [Your contact info]
- **Microsoft 365 Issues:** Microsoft Support
- **Neon Database Issues:** support@neon.tech

---

## Values Reference (fill in during setup)

```
TENANT_ID=
CLIENT_ID=
CLIENT_SECRET=
DATABASE_URL=
API_KEY=
```

Keep this document secure - it contains references to sensitive credentials!
