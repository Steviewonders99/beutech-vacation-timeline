# Production Launch Checklist

This checklist ensures all prerequisites are met before launching the Vacation Timeline widget to production.

## Pre-Launch Verification

### Infrastructure
- [ ] Azure resource group created for production
- [ ] Bicep templates deployed successfully
- [ ] Function App running and healthy
- [ ] Storage Account configured with static website hosting
- [ ] Application Insights collecting telemetry
- [ ] Key Vault configured (if using)

### Azure AD & Graph API
- [ ] App registration created with correct permissions:
  - [ ] `Calendars.Read`
  - [ ] `Calendars.Read.Shared` (if using shared calendar)
  - [ ] `User.Read.All` (if resolving user names)
- [ ] Admin consent granted for permissions
- [ ] Client secret created and stored securely
- [ ] Client secret expiration date documented

### Backend Configuration
- [ ] All environment variables configured:
  - [ ] `TENANT_ID`
  - [ ] `CLIENT_ID`
  - [ ] `CLIENT_SECRET`
  - [ ] `VACATION_CALENDAR_MAILBOX` (if shared mode)
  - [ ] `API_KEY` (strong, randomly generated)
  - [ ] `ALLOWED_ORIGINS` (Staffbase production domain)
- [ ] CORS configured for production Staffbase domain only
- [ ] HTTPS enforced (no HTTP)

### Widget Deployment
- [ ] Widget bundle built in production mode
- [ ] Bundle uploaded to static hosting
- [ ] Bundle URL is HTTPS
- [ ] CDN caching configured (if applicable)

### Staffbase Configuration
- [ ] Custom widget registered in Staffbase Studio
- [ ] Widget configuration complete:
  - [ ] API Base URL (production)
  - [ ] API Key
  - [ ] Calendar Mode
  - [ ] Shared Calendar Mailbox (if applicable)
  - [ ] Default View
  - [ ] Max Users
- [ ] Widget placed on target page(s)
- [ ] SAML deep link configured (if using)

---

## Security Verification

### Secrets Management
- [ ] No secrets in source code
- [ ] No secrets in widget bundle
- [ ] API key is not guessable (use `openssl rand -base64 32`)
- [ ] Client secret stored in Key Vault or Function App settings
- [ ] `.env` / `local.settings.json` not committed to repo

### Access Controls
- [ ] CORS restricts to Staffbase domain only
- [ ] API key required on all endpoints
- [ ] No sensitive data in error messages
- [ ] Graph API permissions are minimal necessary

### SSL/TLS
- [ ] Function App HTTPS only
- [ ] Widget bundle served over HTTPS
- [ ] No mixed content warnings

---

## Monitoring & Alerting

### Application Insights
- [ ] Telemetry collecting from Function App
- [ ] Custom dashboards created:
  - [ ] Request volume
  - [ ] Error rate
  - [ ] Response time (p50, p95, p99)
  - [ ] Graph API latency

### Alerts Configured
- [ ] High error rate alert (> 5%)
- [ ] Slow response time alert (p95 > 5s)
- [ ] Function failures alert
- [ ] Certificate expiration alert (if applicable)

### On-Call
- [ ] Escalation path documented
- [ ] Contact list updated
- [ ] Runbook available to support team

---

## Documentation Complete

- [ ] README.md up to date
- [ ] Architecture diagram accurate
- [ ] Staffbase setup guide complete
- [ ] Runbook/support guide complete
- [ ] SAML deep link guide complete (if using)
- [ ] UAT checklist complete
- [ ] GitHub setup guide complete

---

## UAT Sign-Off

- [ ] All test cases passed
- [ ] All critical/high bugs fixed
- [ ] Performance acceptable
- [ ] Accessibility requirements met
- [ ] Stakeholder approval received

---

## Go-Live Steps

### 1. Final Deployment
```bash
# Deploy infrastructure (if not already done)
./scripts/deploy-infra.sh prod deploy

# Deploy backend
./scripts/deploy-backend.sh prod

# Deploy widget
./scripts/deploy-widget.sh prod
```

### 2. Smoke Test
- [ ] Widget loads on production page
- [ ] Vacation events display correctly
- [ ] No console errors
- [ ] Response times acceptable

### 3. Staged Rollout (Recommended)
- [ ] Day 1: Limited pilot group (e.g., HR team)
- [ ] Day 3: Expand to department
- [ ] Day 7: Company-wide (if no issues)

### 4. Communication
- [ ] Announcement prepared for employees
- [ ] Usage guide created (optional)
- [ ] Support team briefed

---

## Post-Launch

### Monitoring (First 48 Hours)
- [ ] Check error rates hourly
- [ ] Review Application Insights logs
- [ ] Monitor user feedback channels

### Week 1 Review
- [ ] Analyze usage patterns
- [ ] Review any support tickets
- [ ] Performance baseline established

### Scheduled Reviews
- [ ] Week 4: Post-launch review meeting
- [ ] Month 3: Rotate API key
- [ ] Month 6: Review Azure AD client secret expiration

---

## Rollback Plan

If critical issues occur:

### Quick Fixes
1. **Widget issues**: Remove widget from Staffbase page
2. **Backend issues**: Redeploy previous version from Azure Deployment Center
3. **Data issues**: Set invalid API key to stop data loading

### Full Rollback
1. Navigate to Azure Portal → Function App → Deployment Center
2. Select previous successful deployment
3. Click "Redeploy"
4. Verify widget shows error state (expected)
5. Communicate outage to stakeholders

---

## Sign-Off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Product Owner | | | [ ] |
| Tech Lead | | | [ ] |
| Security Lead | | | [ ] |
| IT Operations | | | [ ] |

**Go-Live Date:** _______________

**Go-Live Time:** _______________

**Launch Owner:** _______________
