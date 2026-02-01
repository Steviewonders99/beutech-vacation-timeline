# Runbook & Support Guide

This document provides operational procedures and troubleshooting guidance for the Vacation Timeline widget.

## Contact Points

| Role | Contact | Escalation |
|------|---------|------------|
| Primary Support | [Your IT Support] | [Escalation Path] |
| Azure Admin | [Azure Team] | [Manager] |
| Staffbase Admin | [Staffbase Team] | [Manager] |

## Common Operations

### Rotating the API Key

**When**: Periodically (e.g., quarterly) or after suspected compromise

**Steps**:

1. Generate a new secure API key:
   ```bash
   openssl rand -base64 32
   ```

2. Update the Azure Function App setting:
   ```bash
   az functionapp config appsettings set \
     --name func-vacationtimeline-prod \
     --resource-group rg-vacationtimeline-prod \
     --settings "API_KEY=your-new-api-key"
   ```

3. Update the widget configuration in Staffbase Studio:
   - Navigate to the page with the widget
   - Edit widget configuration
   - Update the API Key field
   - Save

4. Verify the widget still works

### Updating CORS Origins

**When**: Adding new Staffbase domains or restricting access

**Steps**:

1. Update the Function App setting:
   ```bash
   az functionapp config appsettings set \
     --name func-vacationtimeline-prod \
     --resource-group rg-vacationtimeline-prod \
     --settings "ALLOWED_ORIGINS=https://domain1.staffbase.com,https://domain2.staffbase.com"
   ```

2. The change takes effect immediately (no restart needed)

### Rotating Azure AD Client Secret

**When**: Before expiration or after suspected compromise

**Steps**:

1. In Azure Portal, navigate to **Azure Active Directory** → **App registrations** → your app

2. Go to **Certificates & secrets** → **Client secrets**

3. Click **New client secret**, set expiration, and copy the value

4. Update the Function App setting:
   ```bash
   az functionapp config appsettings set \
     --name func-vacationtimeline-prod \
     --resource-group rg-vacationtimeline-prod \
     --settings "CLIENT_SECRET=your-new-secret"
   ```

5. (Optional) Delete the old secret from Azure AD after confirming the new one works

### Deploying Backend Updates

**Steps**:

1. Build the backend:
   ```bash
   cd apps/backend
   npm run build
   ```

2. Deploy to Azure Functions:
   ```bash
   func azure functionapp publish func-vacationtimeline-prod
   ```

3. Verify deployment:
   ```bash
   curl -H "x-api-key: your-key" \
     "https://func-vacationtimeline-prod.azurewebsites.net/api/vacations?start=2025-01-01&end=2025-01-31&view=month"
   ```

### Deploying Widget Updates

**Steps**:

1. Build the widget:
   ```bash
   cd apps/widget
   npm run build
   ```

2. Upload `dist/beutech.vacation-timeline.js` to your hosting location

3. If using Azure Blob Storage:
   ```bash
   az storage blob upload \
     --account-name yourStorageAccount \
     --container-name widgets \
     --name beutech.vacation-timeline.js \
     --file dist/beutech.vacation-timeline.js \
     --overwrite
   ```

4. Clear any CDN cache if applicable

5. Refresh the Staffbase page to load the new version

## Monitoring

### Key Metrics to Watch

| Metric | Warning Threshold | Critical Threshold | Action |
|--------|-------------------|-------------------|--------|
| Error Rate | > 1% | > 5% | Investigate logs |
| Response Time (p95) | > 2s | > 5s | Check Graph API latency |
| Request Volume | -50% from baseline | -90% from baseline | Verify widget is loading |
| 401 Errors | > 10/hour | > 50/hour | Possible key compromise |

### Application Insights Queries

**Error Summary (Last 24 hours)**:
```kusto
requests
| where timestamp > ago(24h)
| where success == false
| summarize count() by resultCode, operation_Name
| order by count_ desc
```

**Latency by Operation**:
```kusto
requests
| where timestamp > ago(24h)
| summarize
    avg(duration),
    percentile(duration, 95),
    percentile(duration, 99)
  by operation_Name
```

**Graph API Errors**:
```kusto
traces
| where timestamp > ago(24h)
| where message contains "Graph"
| where severityLevel >= 3
| project timestamp, message, customDimensions
```

### Setting Up Alerts

1. In Azure Portal, navigate to your Application Insights resource

2. Go to **Alerts** → **Create rule**

3. Recommended alerts:
   - **High Error Rate**: Custom metric query, threshold > 5%
   - **Slow Response**: Request duration p95 > 5000ms
   - **Function Errors**: Failed requests > 10 in 5 minutes

## Troubleshooting

### Widget Shows "Unable to load vacations"

**Symptoms**: Error state displayed instead of timeline

**Diagnosis**:
1. Open browser DevTools → Network tab
2. Look for failed request to `/api/vacations`
3. Check response status and body

**Common Causes**:

| Status | Cause | Solution |
|--------|-------|----------|
| 401 | Invalid API key | Verify key in widget config and backend |
| 403 | CORS blocked | Add Staffbase domain to ALLOWED_ORIGINS |
| 500 | Backend error | Check Application Insights logs |
| 502 | Graph API error | Check Graph permissions / tenant config |
| Network Error | URL unreachable | Verify API Base URL is correct |

### No Events Showing (Empty State)

**Symptoms**: Widget loads but shows "No vacations scheduled"

**Diagnosis**:
1. Verify the date range in the API request
2. Check if events exist in the source calendar
3. In per-user mode, verify the user list

**Common Causes**:

| Cause | Solution |
|-------|----------|
| Wrong date range | Verify start/end parameters |
| No events in calendar | Add test events to source calendar |
| Category filter (perUser mode) | Ensure events have the "Vacation" category |
| User filter active | Try "All" filter instead of specific users |

### "Only Me" Not Highlighting

**Symptoms**: User filter works but "Only Me" doesn't identify current user

**Diagnosis**:
1. Check Staffbase user context in DevTools
2. Verify user's email matches M365 UPN

**Solutions**:
- Configure M365 Fallback Domain in widget settings
- Add custom profile field `m365Upn` in Staffbase
- Ensure user's email in Staffbase matches their M365 UPN

### Slow Performance

**Symptoms**: Widget takes > 3 seconds to load data

**Diagnosis**:
1. Check Application Insights for Graph API latency
2. Review date range size (large ranges = more data)

**Solutions**:
- Reduce MAX_DATE_RANGE_DAYS setting
- Implement caching in vacationService
- Consider Azure Cache for Redis for frequently accessed data

## Emergency Procedures

### Disabling the Widget

If the widget is causing issues:

1. **Quick**: In Staffbase Studio, edit the page and remove the widget
2. **Or**: Replace the widget bundle URL with a placeholder that renders nothing
3. **Or**: Set an invalid API key to prevent data loading

### Reverting Backend Deployment

1. In Azure Portal, go to **Function App** → **Deployment Center** → **Logs**
2. Find the previous successful deployment
3. Click **Redeploy**

### Incident Response Checklist

- [ ] Identify the issue scope (all users / some users / specific pages)
- [ ] Check Application Insights for errors
- [ ] Check Azure Function App health
- [ ] Verify Graph API status (https://status.azure.com)
- [ ] If user-impacting, communicate via Staffbase
- [ ] Document incident timeline and resolution

---

## Enhanced Incident Procedures

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| P1 - Critical | Complete service outage | 15 minutes | Widget won't load, all API calls failing |
| P2 - High | Major feature broken | 1 hour | Approvals not working, data not loading |
| P3 - Medium | Degraded performance | 4 hours | Slow responses, intermittent errors |
| P4 - Low | Minor issues | 24 hours | UI glitches, cosmetic issues |

### P1 Incident Response

**Timeline:**

1. **0-5 minutes**: Acknowledge and assess
   - Check `/api/health` endpoint status
   - Review Application Insights for error spike
   - Identify if issue is backend, widget, or external

2. **5-15 minutes**: Initial response
   - If backend: Check Azure Function App status, restart if needed
   - If widget: Verify CDN/storage availability
   - If Graph API: Check Azure status page

3. **15-30 minutes**: Communication
   - Post status update in incident channel
   - If user-impacting, prepare Staffbase announcement

4. **30+ minutes**: Resolution
   - Apply fix or rollback
   - Verify fix with health check
   - Post resolution update

**Commands:**

```bash
# Check Azure Function App status
az functionapp show --name func-vacationtimeline-prod --resource-group rg-vacationtimeline-prod --query "state"

# Restart Function App
az functionapp restart --name func-vacationtimeline-prod --resource-group rg-vacationtimeline-prod

# Check recent deployments
az functionapp deployment list-publishing-profiles --name func-vacationtimeline-prod --resource-group rg-vacationtimeline-prod

# View Function App logs
az functionapp log tail --name func-vacationtimeline-prod --resource-group rg-vacationtimeline-prod
```

### Secret Rotation Procedures

#### API Key Rotation

**When to rotate:**
- Quarterly (scheduled maintenance)
- After suspected compromise
- After team member departure with access

**Steps:**

1. Generate new key:
   ```bash
   NEW_KEY=$(openssl rand -base64 32)
   echo "New API Key: $NEW_KEY"
   ```

2. Update Azure Function App:
   ```bash
   az functionapp config appsettings set \
     --name func-vacationtimeline-prod \
     --resource-group rg-vacationtimeline-prod \
     --settings "API_KEY=$NEW_KEY"
   ```

3. Update Staffbase widget configuration:
   - Navigate to Staffbase Studio
   - Edit the page with the widget
   - Update the API Key field
   - Save changes

4. Verify functionality:
   ```bash
   curl -H "x-api-key: $NEW_KEY" \
     "https://func-vacationtimeline-prod.azurewebsites.net/api/health"
   ```

5. Document rotation in change log

#### Azure AD Client Secret Rotation

**When to rotate:**
- Before expiration (check in Azure Portal)
- After suspected compromise

**Steps:**

1. Generate new secret in Azure Portal:
   - Navigate to Azure AD > App registrations > [Your App]
   - Go to Certificates & secrets
   - Click "New client secret"
   - Set expiration (recommended: 12 months)
   - Copy the secret value immediately

2. Update Azure Function App:
   ```bash
   az functionapp config appsettings set \
     --name func-vacationtimeline-prod \
     --resource-group rg-vacationtimeline-prod \
     --settings "CLIENT_SECRET=<new-secret>"
   ```

3. Verify Graph API connectivity:
   ```bash
   curl -H "x-api-key: $API_KEY" \
     "https://func-vacationtimeline-prod.azurewebsites.net/api/vacations?start=2025-01-01&end=2025-01-31&view=month"
   ```

4. Delete old secret from Azure AD (after 24h to ensure no cached tokens)

### Database Recovery Procedures

#### Point-in-Time Recovery (Neon)

Neon databases support point-in-time recovery. To restore:

1. Access Neon Console (https://console.neon.tech)
2. Navigate to your project
3. Go to Branches
4. Create new branch from a point in time before the incident
5. Update `DATABASE_URL` to point to new branch for testing
6. After verification, update production connection string

#### Manual Data Recovery

For specific record recovery:

```sql
-- Find deleted/modified records from audit trail (if enabled)
SELECT * FROM time_off_requests
WHERE updated_at > '2025-01-15 10:00:00'
ORDER BY updated_at DESC;

-- Restore specific request status
UPDATE time_off_requests
SET status = 'pending',
    status_changed_at = NULL,
    status_changed_by = NULL,
    updated_at = NOW()
WHERE id = '<request-uuid>';
```

### Staffbase Widget Reinstallation

If the widget needs to be reinstalled:

1. **Build the widget:**
   ```bash
   cd apps/widget
   npm run build
   ```

2. **Upload to Azure Storage:**
   ```bash
   az storage blob upload \
     --account-name stvacationtimelineprod \
     --container-name '$web' \
     --name beutech.vacation-timeline.js \
     --file dist/beutech.vacation-timeline.js \
     --overwrite
   ```

3. **Clear CDN cache (if applicable):**
   ```bash
   az cdn endpoint purge \
     --resource-group rg-vacationtimeline-prod \
     --profile-name cdn-vacationtimeline-prod \
     --name vacationtimeline \
     --content-paths '/*'
   ```

4. **Configure in Staffbase Studio:**
   - Navigate to Administration > Custom Widgets
   - Add new custom widget (or update existing)
   - Set Bundle URL: `https://stvacationtimelineprod.blob.core.windows.net/$web/beutech.vacation-timeline.js`
   - Configure widget on pages

5. **Test in Staffbase:**
   - Add widget to a test page
   - Verify data loads correctly
   - Test time-off request submission

---

## Monitoring Dashboards

### Key Application Insights Queries

**Service Health Overview:**
```kusto
requests
| where timestamp > ago(1h)
| summarize
    TotalRequests = count(),
    FailedRequests = countif(success == false),
    AvgDuration = avg(duration),
    P95Duration = percentile(duration, 95)
| extend ErrorRate = round(100.0 * FailedRequests / TotalRequests, 2)
```

**Error Breakdown:**
```kusto
requests
| where timestamp > ago(24h)
| where success == false
| summarize Count = count() by resultCode, operation_Name
| order by Count desc
```

**User Activity:**
```kusto
customEvents
| where timestamp > ago(7d)
| where name in ("RequestCreated", "RequestApproved", "RequestRejected")
| summarize Count = count() by name, bin(timestamp, 1d)
| render timechart
```

### Azure Monitor Workbook

Create a workbook with these visualizations:
1. Request volume over time (line chart)
2. Error rate trend (line chart)
3. Response time percentiles (line chart)
4. Top errors table
5. Geographic distribution (map)
6. Active users count

---

## Change Management

### Deployment Checklist

Before deploying to production:

- [ ] Changes tested in development environment
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Security scan completed (npm audit)
- [ ] Documentation updated
- [ ] Rollback plan documented
- [ ] Stakeholders notified

### Rollback Procedure

1. Identify the last known good deployment
2. In Azure Portal, go to Function App > Deployment Center
3. Find the previous deployment and click "Redeploy"
4. Verify health check passes
5. Monitor for 15 minutes
6. Update incident ticket with rollback details
