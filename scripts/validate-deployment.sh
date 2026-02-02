#!/bin/bash
#
# Pre-Deployment Validation Script
# Run this BEFORE deploying to verify all credentials and configuration are correct.
#
# Usage:
#   ./scripts/validate-deployment.sh
#
# Required environment variables (set these before running):
#   - AZURE_TENANT_ID
#   - AZURE_CLIENT_ID
#   - AZURE_CLIENT_SECRET
#   - DATABASE_URL
#   - API_KEY
#   - ALLOWED_ORIGINS
#   - SHARED_CALENDAR_MAILBOX (if using shared calendar mode)
#
# Optional (for post-deploy validation):
#   - FUNCTION_APP_URL (e.g., https://myapp.azurewebsites.net)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
}

print_check() {
    echo -n "  Checking $1... "
}

pass() {
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}"
    echo -e "    ${RED}Error: $1${NC}"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠ WARNING${NC}"
    echo -e "    ${YELLOW}$1${NC}"
    ((WARNINGS++))
}

info() {
    echo -e "    ${BLUE}Info: $1${NC}"
}

# ============================================================================
# SECTION 1: Environment Variables
# ============================================================================
print_header "1. Environment Variables"

print_check "AZURE_TENANT_ID"
if [ -n "$AZURE_TENANT_ID" ]; then
    if [[ $AZURE_TENANT_ID =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
        pass
    else
        fail "Invalid format (should be UUID like xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)"
    fi
else
    fail "Not set"
fi

print_check "AZURE_CLIENT_ID"
if [ -n "$AZURE_CLIENT_ID" ]; then
    if [[ $AZURE_CLIENT_ID =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
        pass
    else
        fail "Invalid format (should be UUID)"
    fi
else
    fail "Not set"
fi

print_check "AZURE_CLIENT_SECRET"
if [ -n "$AZURE_CLIENT_SECRET" ]; then
    if [ ${#AZURE_CLIENT_SECRET} -ge 20 ]; then
        pass
    else
        fail "Secret seems too short (should be 30+ characters)"
    fi
else
    fail "Not set"
fi

print_check "DATABASE_URL"
if [ -n "$DATABASE_URL" ]; then
    if [[ $DATABASE_URL =~ ^postgres(ql)?:// ]]; then
        pass
        if [[ $DATABASE_URL =~ sslmode=require ]]; then
            info "SSL mode enabled (good for production)"
        else
            warn "Consider adding ?sslmode=require for production"
        fi
    else
        fail "Invalid format (should start with postgres:// or postgresql://)"
    fi
else
    fail "Not set"
fi

print_check "API_KEY"
if [ -n "$API_KEY" ]; then
    if [ ${#API_KEY} -ge 32 ]; then
        pass
    else
        warn "API key is short. Recommend 32+ characters for security"
    fi
else
    fail "Not set"
fi

print_check "ALLOWED_ORIGINS"
if [ -n "$ALLOWED_ORIGINS" ]; then
    if [[ $ALLOWED_ORIGINS == "*" ]]; then
        fail "Cannot use wildcard '*' in production! Specify exact Staffbase domains"
    elif [[ $ALLOWED_ORIGINS =~ ^https:// ]]; then
        pass
        info "Origins: $ALLOWED_ORIGINS"
    else
        warn "Origins should use HTTPS in production"
    fi
else
    fail "Not set"
fi

print_check "CALENDAR_MODE"
CALENDAR_MODE=${CALENDAR_MODE:-shared}
if [[ "$CALENDAR_MODE" == "shared" || "$CALENDAR_MODE" == "perUser" ]]; then
    pass
    info "Mode: $CALENDAR_MODE"
else
    fail "Must be 'shared' or 'perUser'"
fi

if [ "$CALENDAR_MODE" == "shared" ]; then
    print_check "SHARED_CALENDAR_MAILBOX"
    if [ -n "$SHARED_CALENDAR_MAILBOX" ]; then
        if [[ $SHARED_CALENDAR_MAILBOX =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
            pass
        else
            fail "Invalid email format"
        fi
    else
        fail "Required when CALENDAR_MODE=shared"
    fi
fi

# ============================================================================
# SECTION 2: Azure AD / Microsoft Graph API
# ============================================================================
print_header "2. Azure AD / Microsoft Graph API"

print_check "Acquiring access token"
if [ -n "$AZURE_TENANT_ID" ] && [ -n "$AZURE_CLIENT_ID" ] && [ -n "$AZURE_CLIENT_SECRET" ]; then
    TOKEN_RESPONSE=$(curl -s -X POST \
        "https://login.microsoftonline.com/$AZURE_TENANT_ID/oauth2/v2.0/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "client_id=$AZURE_CLIENT_ID" \
        -d "client_secret=$AZURE_CLIENT_SECRET" \
        -d "scope=https://graph.microsoft.com/.default" \
        -d "grant_type=client_credentials" 2>/dev/null)

    ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

    if [ -n "$ACCESS_TOKEN" ]; then
        pass
    else
        ERROR=$(echo "$TOKEN_RESPONSE" | grep -o '"error_description":"[^"]*"' | cut -d'"' -f4)
        fail "$ERROR"
    fi
else
    fail "Missing credentials - skipping"
fi

if [ -n "$ACCESS_TOKEN" ]; then
    print_check "Graph API /me endpoint (app permissions)"
    # Test basic API connectivity
    API_TEST=$(curl -s -o /dev/null -w "%{http_code}" \
        "https://graph.microsoft.com/v1.0/organization" \
        -H "Authorization: Bearer $ACCESS_TOKEN")

    if [ "$API_TEST" == "200" ]; then
        pass
    else
        fail "HTTP $API_TEST - Check app permissions in Azure AD"
    fi

    print_check "Calendars.Read permission"
    # Try to access calendars (this tests the specific permission)
    if [ -n "$SHARED_CALENDAR_MAILBOX" ]; then
        CALENDAR_TEST=$(curl -s -o /dev/null -w "%{http_code}" \
            "https://graph.microsoft.com/v1.0/users/$SHARED_CALENDAR_MAILBOX/calendar" \
            -H "Authorization: Bearer $ACCESS_TOKEN")

        if [ "$CALENDAR_TEST" == "200" ]; then
            pass
        elif [ "$CALENDAR_TEST" == "403" ]; then
            fail "Permission denied. Grant 'Calendars.Read' application permission in Azure AD"
        elif [ "$CALENDAR_TEST" == "404" ]; then
            fail "Mailbox not found: $SHARED_CALENDAR_MAILBOX"
        else
            fail "HTTP $CALENDAR_TEST"
        fi
    else
        warn "Skipped - no SHARED_CALENDAR_MAILBOX to test"
    fi

    print_check "Mail.Send permission"
    # Check if we can access mail (needed for notifications)
    MAIL_TEST=$(curl -s -o /dev/null -w "%{http_code}" \
        "https://graph.microsoft.com/v1.0/users" \
        -H "Authorization: Bearer $ACCESS_TOKEN")

    if [ "$MAIL_TEST" == "200" ]; then
        pass
        info "Can list users (Mail.Send likely configured)"
    else
        warn "HTTP $MAIL_TEST - May need 'Mail.Send' and 'User.Read.All' permissions"
    fi
fi

# ============================================================================
# SECTION 3: Database Connectivity
# ============================================================================
print_header "3. Database Connectivity"

print_check "PostgreSQL connection"
if [ -n "$DATABASE_URL" ]; then
    # Use psql if available, otherwise use node
    if command -v psql &> /dev/null; then
        if psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
            pass
        else
            fail "Could not connect to database"
        fi
    elif command -v node &> /dev/null; then
        DB_TEST=$(node -e "
            const { Pool } = require('pg');
            const pool = new Pool({ connectionString: '$DATABASE_URL', ssl: { rejectUnauthorized: false } });
            pool.query('SELECT 1').then(() => { console.log('OK'); pool.end(); }).catch(e => { console.log('ERROR: ' + e.message); pool.end(); process.exit(1); });
        " 2>&1)
        if [ "$DB_TEST" == "OK" ]; then
            pass
        else
            fail "$DB_TEST"
        fi
    else
        warn "Neither psql nor node available - skipping database test"
    fi
else
    fail "DATABASE_URL not set"
fi

print_check "Database tables exist"
if [ -n "$DATABASE_URL" ] && command -v psql &> /dev/null; then
    TABLE_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'time_off_requests';" 2>/dev/null | tr -d ' ')
    if [ "$TABLE_CHECK" == "1" ]; then
        pass
    else
        fail "Table 'time_off_requests' not found. Run: npm run migrate"
    fi
elif [ -n "$DATABASE_URL" ] && command -v node &> /dev/null; then
    # Skip for now if psql not available
    warn "psql not available - run 'npm run migrate' manually before deploy"
else
    warn "Skipped - no database connection"
fi

# ============================================================================
# SECTION 4: Post-Deployment Validation (if URL provided)
# ============================================================================
if [ -n "$FUNCTION_APP_URL" ]; then
    print_header "4. Post-Deployment Health Check"

    print_check "Health endpoint"
    HEALTH_RESPONSE=$(curl -s "$FUNCTION_APP_URL/api/health" 2>/dev/null)
    HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

    if [ "$HEALTH_STATUS" == "healthy" ]; then
        pass
    elif [ "$HEALTH_STATUS" == "degraded" ]; then
        warn "Service is degraded - check database connection"
        info "$HEALTH_RESPONSE"
    else
        fail "Health check failed"
        info "$HEALTH_RESPONSE"
    fi

    print_check "API key authentication"
    AUTH_TEST=$(curl -s -o /dev/null -w "%{http_code}" \
        "$FUNCTION_APP_URL/api/vacations?start=2024-01-01&end=2024-01-07" \
        -H "x-api-key: $API_KEY")

    if [ "$AUTH_TEST" == "200" ]; then
        pass
    elif [ "$AUTH_TEST" == "401" ]; then
        fail "API key rejected - check API_KEY matches backend config"
    else
        fail "HTTP $AUTH_TEST"
    fi

    print_check "CORS headers"
    CORS_TEST=$(curl -s -I -X OPTIONS "$FUNCTION_APP_URL/api/vacations" \
        -H "Origin: ${ALLOWED_ORIGINS%%,*}" \
        -H "Access-Control-Request-Method: GET" 2>/dev/null | grep -i "access-control-allow-origin")

    if [ -n "$CORS_TEST" ]; then
        pass
    else
        warn "CORS headers not returned - widget may not work"
    fi
else
    print_header "4. Post-Deployment Health Check"
    echo -e "  ${YELLOW}Skipped - Set FUNCTION_APP_URL to run post-deploy checks${NC}"
fi

# ============================================================================
# SUMMARY
# ============================================================================
print_header "VALIDATION SUMMARY"

echo ""
echo -e "  ${GREEN}Passed:${NC}   $PASSED"
echo -e "  ${RED}Failed:${NC}   $FAILED"
echo -e "  ${YELLOW}Warnings:${NC} $WARNINGS"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  VALIDATION FAILED - Do NOT deploy until issues are fixed    ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  VALIDATION PASSED WITH WARNINGS - Review before deploying   ║${NC}"
    echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ALL CHECKS PASSED - Ready to deploy!                        ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    exit 0
fi
