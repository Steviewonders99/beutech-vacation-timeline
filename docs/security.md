# Security Documentation

This document describes the security architecture and best practices for the Vacation Timeline widget.

## Authentication Architecture

### Widget-to-Backend Communication

The Vacation Timeline uses **API key authentication**, which is the standard pattern for Staffbase Custom Widgets:

1. **Widget** runs in a Staffbase iframe and uses the Widget SDK for user context
2. **API Key** is stored in widget configuration (Staffbase Studio)
3. **Backend** validates the API key on every request via the `x-api-key` header

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Staffbase      │     │  Widget          │     │  Azure          │
│  Platform       │────▶│  (iframe)        │────▶│  Functions      │
│                 │     │                  │     │                 │
│  User Context   │     │  + API Key       │     │  + API Key      │
│  from SDK       │     │  + User Info     │     │  Validation     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Why API Keys (Not JWT)

Staffbase Custom Widgets don't provide JWT tokens like Plugins do. The Widget SDK provides user information directly, and API key authentication is the documented pattern for widget-to-backend communication.

## API Key Security

### Best Practices

1. **Use Strong Keys**: Generate keys with high entropy (32+ bytes)
   ```bash
   openssl rand -base64 32
   ```

2. **Rotate Regularly**: Rotate API keys quarterly or after any suspected compromise

3. **Environment Separation**: Use different keys for dev/staging/production

4. **Never Commit Keys**: Keys should only exist in:
   - Azure Function App settings
   - Staffbase widget configuration
   - Secure secrets management (Azure Key Vault)

5. **Monitor Usage**: Track 401 errors in Application Insights to detect unauthorized access attempts

### Rotation Procedure

See [Runbook: Rotating the API Key](./runbook-support.md#rotating-the-api-key)

## CORS Configuration

### Production Requirements

CORS is configured via the `ALLOWED_ORIGINS` environment variable:

```bash
# Production (required - no wildcards)
ALLOWED_ORIGINS=https://yourcompany.staffbase.com,https://app.staffbase.com

# Development only
ALLOWED_ORIGINS=http://localhost:3000,https://yourcompany.staffbase.com
```

### Security Rules

1. **No Wildcards in Production**: The backend will refuse to start if `ALLOWED_ORIGINS` is `*` in production
2. **Explicit Domains Only**: List all Staffbase domains that will host the widget
3. **HTTPS Required**: Only HTTPS origins are allowed in production

### How CORS Works

```
Browser                  Backend
   │                        │
   │ Preflight OPTIONS      │
   │ Origin: staffbase.com  │
   │───────────────────────▶│
   │                        │ Validate origin
   │◀───────────────────────│ against ALLOWED_ORIGINS
   │ Allow-Origin header    │
   │                        │
   │ Actual Request         │
   │───────────────────────▶│
   │                        │
```

## Input Validation

### SQL Injection Prevention

All database queries use **parameterized queries**:

```typescript
// ✅ Safe - parameterized
const sql = 'SELECT * FROM requests WHERE id = $1';
await query(sql, [requestId]);

// ❌ Vulnerable - string interpolation
const sql = `SELECT * FROM requests WHERE id = '${requestId}'`;
```

### Validated Input Types

| Input | Validation | Example |
|-------|------------|---------|
| UUID | RFC 4122 v4 format | `123e4567-e89b-12d3-a456-426614174000` |
| Email | Standard format, max 254 chars | `user@example.com` |
| Date | YYYY-MM-DD, valid calendar date | `2025-01-15` |
| Limit | Integer 0-100 | `50` |
| Offset | Non-negative integer | `0` |
| Leave Type | Enum: vacation, sick, personal, other | `vacation` |
| Status | Enum: pending, approved, rejected | `pending` |

### Validation Utilities

```typescript
import {
  validateUuid,
  validateEmail,
  validateDateFormat,
  validateLimit,
  validateOffset,
} from '../utils/validation';

// Throws ApiError with 400 status if invalid
const requestId = validateUuid(req.params.id, 'Request ID');
const email = validateEmail(body.email, 'Email');
```

## Data Protection

### Sensitive Data Handling

| Data Type | Storage | Logging | Transmission |
|-----------|---------|---------|--------------|
| API Key | Azure Key Vault / Function settings | Never | HTTPS only |
| User Email | Database | Sanitized | HTTPS only |
| Calendar Events | Fetched via Graph API | Metadata only | HTTPS only |
| Azure AD Secret | Azure Key Vault | Never | Never transmitted |

### Logging Guidelines

```typescript
// ✅ Safe - no sensitive data
logger.info('Request processed', { requestId, userId: 'user123', durationMs: 150 });

// ❌ Unsafe - contains sensitive data
logger.info('Auth', { apiKey, password, accessToken });
```

## Microsoft Graph API Security

### Application Permissions

The backend uses **application permissions** (client credentials flow):

| Permission | Scope | Purpose |
|------------|-------|---------|
| Calendars.Read | Application | Read vacation calendar events |
| Calendars.ReadWrite | Application | Create approved vacation events |
| User.Read.All | Application | Resolve user display names |
| Mail.Send | Application | Send notification emails |

### Token Security

- Tokens are obtained via Azure AD client credentials
- Tokens are cached in memory (default Azure Identity behavior)
- Client secrets should be rotated before expiration

## Security Monitoring

### Key Metrics

Monitor these in Application Insights:

| Metric | Alert Threshold | Indicates |
|--------|-----------------|-----------|
| 401 Unauthorized | > 50/hour | Possible credential compromise |
| 403 Forbidden | > 20/hour | Authorization issues |
| 400 Bad Request | > 100/hour | Possible attack probing |
| Request from unknown origin | Any | CORS bypass attempt |

### Kusto Queries

**Unauthorized Access Attempts**:
```kusto
requests
| where timestamp > ago(24h)
| where resultCode == "401"
| summarize count() by bin(timestamp, 1h), client_IP
| order by count_ desc
```

**Failed Requests by Origin**:
```kusto
requests
| where timestamp > ago(24h)
| where success == false
| extend origin = tostring(customDimensions.origin)
| summarize count() by origin, resultCode
```

## Incident Response

### Suspected API Key Compromise

1. **Immediately** rotate the API key (see runbook)
2. Check Application Insights for unauthorized usage patterns
3. Review Azure audit logs for unusual activity
4. Notify security team if data access is confirmed

### Suspected Data Breach

1. Identify scope of potentially accessed data
2. Preserve logs for investigation
3. Follow organization's breach notification procedures
4. Review and strengthen access controls

## Security Checklist

### Deployment

- [ ] API key is unique per environment
- [ ] ALLOWED_ORIGINS excludes wildcards in production
- [ ] Azure AD client secret is not expired
- [ ] Application Insights alerts are configured
- [ ] HTTPS is enforced (Azure handles this)

### Code Review

- [ ] All SQL uses parameterized queries
- [ ] User input is validated before use
- [ ] Sensitive data is not logged
- [ ] Error messages don't leak internal details
- [ ] CORS headers are properly set

### Regular Maintenance

- [ ] API keys rotated quarterly
- [ ] Azure AD secrets rotated before expiration
- [ ] Dependencies updated (npm audit)
- [ ] Security alerts reviewed weekly
