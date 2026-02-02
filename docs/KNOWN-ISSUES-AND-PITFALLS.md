# Known Issues and Potential Major Bugs

This document lists configuration mistakes and edge cases that can cause **major bugs** in production. Review this before deployment.

---

## Critical Issues (Will Break the App)

### 1. ALLOWED_ORIGINS Set to Wildcard `*`

**Symptom:** App crashes on startup in production

**Cause:** The backend explicitly rejects `*` as ALLOWED_ORIGINS in production mode.

**Fix:**
```bash
# Wrong
ALLOWED_ORIGINS=*

# Correct
ALLOWED_ORIGINS=https://yourcompany.staffbase.com,https://app.staffbase.com
```

**Code:** `apps/backend/src/utils/env.ts:98`

---

### 2. Missing or Incorrect SHARED_CALENDAR_MAILBOX

**Symptom:** `500 Internal Server Error` on `/api/vacations`

**Cause:** When `CALENDAR_MODE=shared` (default), the app tries to read from a shared calendar mailbox. If it's not set or the mailbox doesn't exist, Graph API returns 404.

**Fix:**
```bash
# Must be a valid mailbox that exists in your M365 tenant
SHARED_CALENDAR_MAILBOX=vacation-calendar@yourcompany.com
```

**How to verify:**
1. Go to Outlook
2. Search for the mailbox address
3. Confirm it exists and has a calendar

---

### 3. Azure AD App Missing Required Permissions

**Symptom:** `403 Forbidden` errors when fetching calendars or sending emails

**Required Permissions (Application type, NOT Delegated):**

| Permission | Why Needed |
|------------|------------|
| `Calendars.Read` | Read vacation events from calendars |
| `Calendars.ReadWrite` | Create calendar events when approving requests |
| `Mail.Send` | Send email notifications |
| `User.Read.All` | Look up user display names and managers |
| `Chat.Create` | Send Teams notifications (optional) |

**Fix:** In Azure Portal → App Registration → API Permissions → Add all permissions → Click "Grant admin consent"

---

### 4. Wrong DATABASE_URL Format

**Symptom:** App starts but all database operations fail

**Common mistakes:**
```bash
# Wrong - missing sslmode for Azure PostgreSQL
DATABASE_URL=postgresql://user:pass@server.postgres.database.azure.com/dbname

# Wrong - wrong protocol
DATABASE_URL=postgres://user:pass@server/dbname  # May work but not recommended

# Correct for Azure PostgreSQL
DATABASE_URL=postgresql://user:pass@server.postgres.database.azure.com:5432/dbname?sslmode=require
```

---

### 5. Database Tables Don't Exist

**Symptom:** `relation "time_off_requests" does not exist`

**Cause:** Migrations weren't run after provisioning the database.

**Fix:**
```bash
cd apps/backend
npm run migrate
```

---

## Major Bugs (App Works But Behaves Wrong)

### 6. API_KEY Mismatch Between Widget and Backend

**Symptom:** Widget shows "Unauthorized" error, but health endpoint works

**Cause:** The API key in Staffbase widget config doesn't match the backend's `API_KEY` environment variable.

**Fix:** Ensure EXACT match (case-sensitive, no extra spaces):
```bash
# Backend .env
API_KEY=my-super-secret-key-12345

# Staffbase Widget Config
apiKey: my-super-secret-key-12345
```

---

### 7. CORS Origin Doesn't Match Staffbase Domain Exactly

**Symptom:** Browser console shows CORS errors, widget displays nothing

**Cause:** The origin must match EXACTLY including protocol and subdomain.

**Wrong:**
```bash
ALLOWED_ORIGINS=staffbase.com              # Missing https:// and subdomain
ALLOWED_ORIGINS=http://app.staffbase.com   # Wrong protocol (http vs https)
ALLOWED_ORIGINS=https://app.staffbase.com/ # Trailing slash
```

**Correct:**
```bash
ALLOWED_ORIGINS=https://yourcompany.staffbase.com
```

**How to find your exact origin:**
1. Open Staffbase in browser
2. Open DevTools (F12) → Console
3. Type `window.location.origin` and press Enter
4. Use that exact value

---

### 8. Timezone Mismatch

**Symptom:** Events appear on wrong dates (off by one day)

**Cause:** Server timezone doesn't match user timezone, and dates near midnight shift.

**Fix:**
```bash
# Set explicit timezone
DEFAULT_TIMEZONE=America/New_York
```

**Note:** The widget sends the user's timezone in the `timezone` query param, but if not provided, DEFAULT_TIMEZONE is used.

---

### 9. ACTION_TOKEN_SECRET Not Set or Too Weak

**Symptom:** Email approve/reject links don't work or are easily forged

**Cause:** The secret used to sign action tokens must be strong and consistent.

**Fix:**
```bash
# Generate a strong secret
ACTION_TOKEN_SECRET=$(openssl rand -base64 32)

# Must be the same across all function app instances
```

**If changed after deployment:** All existing email links will stop working.

---

### 10. NOTIFICATION_FROM_EMAIL Doesn't Have Send Permission

**Symptom:** Approval emails never arrive

**Cause:** The email address used for sending must have `Mail.Send` permission granted to the app.

**Fix:**
```bash
# Must be a real mailbox in your tenant
NOTIFICATION_FROM_EMAIL=vacation-noreply@yourcompany.com
```

**Alternative:** Use a shared mailbox and grant the app permission to send as that mailbox.

---

## Edge Cases That Cause Confusion

### 11. Health Endpoint Shows "Healthy" But App Doesn't Work

**Cause:** Health endpoint only checks:
- Config loads ✓
- Database connects ✓

It does NOT check:
- Graph API credentials
- Calendar permissions
- Email sending works

**Solution:** Use the validation script to test everything:
```bash
./scripts/validate-deployment.sh
```

---

### 12. Duplicate Route Registration (Already Fixed)

**Symptom:** Azure Functions fails to start with "route conflict" error

**Cause:** Two functions registered the same route `/api/requests` with overlapping HTTP methods.

**Status:** Fixed in commit `a941f07`. If you see this error, pull the latest code.

---

### 13. Calendar Events Not Showing for Some Users

**Possible causes:**
1. User's email doesn't match their M365 UPN (check `m365FallbackDomain` config)
2. Events are in a different calendar (not the default)
3. Events don't have the vacation category set (check `vacationCategory` config)
4. Date range doesn't include the events

---

### 14. Manager/Supervisor Not Detected

**Symptom:** User can't see approval requests even though they're a manager

**Cause:** The Staffbase user profile doesn't have `directReports` populated.

**Fix:** Ensure your Staffbase user sync includes manager relationships from Active Directory.

---

## Pre-Deployment Checklist

Run through this before every deployment:

```bash
# 1. Set environment variables
export AZURE_TENANT_ID=...
export AZURE_CLIENT_ID=...
export AZURE_CLIENT_SECRET=...
export DATABASE_URL=...
export API_KEY=...
export ALLOWED_ORIGINS=...
export SHARED_CALENDAR_MAILBOX=...

# 2. Run validation script
./scripts/validate-deployment.sh

# 3. Run database migrations
cd apps/backend && npm run migrate

# 4. Deploy
# (via GitHub Actions or Azure CLI)

# 5. Post-deploy validation
export FUNCTION_APP_URL=https://your-app.azurewebsites.net
./scripts/validate-deployment.sh
```

---

## Getting Help

If you encounter issues not listed here:

1. Check Azure Functions logs: Portal → Function App → Monitor → Logs
2. Check Application Insights (if configured)
3. Test individual endpoints with curl
4. Open an issue on GitHub with:
   - Error message
   - Steps to reproduce
   - Environment (dev/prod)
   - Relevant config (redact secrets!)
