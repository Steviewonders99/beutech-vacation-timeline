# Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STAFFBASE PLATFORM                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Vacation Timeline Widget                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │ CalendarHeader│  │  UserFilter  │  │       Timeline           │  │   │
│  │  │ - ViewToggle  │  │ - All/OnlyMe │  │  - TimelineRow per user  │  │   │
│  │  │ - DateNav     │  │ - Multi-sel  │  │  - VacationBar events    │  │   │
│  │  └──────────────┘  └──────────────┘  │  - Today marker          │  │   │
│  │                                       └──────────────────────────┘  │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                     React Hooks                              │   │   │
│  │  │  useViewRange    useVacationData    useStaffbaseUserContext │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    │ Widget SDK                             │
│                                    │ (User Context)                         │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     │ HTTPS + x-api-key
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AZURE                                          │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                     Azure Functions (Node.js)                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    GET /api/vacations                            │  │ │
│  │  │  ┌────────────┐  ┌────────────────┐  ┌────────────────────────┐ │  │ │
│  │  │  │ API Key    │→ │ Date Range     │→ │   Vacation Service     │ │  │ │
│  │  │  │ Validator  │  │ Parser         │  │   - Shared Calendar    │ │  │ │
│  │  │  └────────────┘  └────────────────┘  │   - Per-User Calendars │ │  │ │
│  │  │                                       └────────────────────────┘ │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                    │                                   │ │
│  │                                    │ Client Credentials Flow           │ │
│  │                                    ▼                                   │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    Graph Client                                  │  │ │
│  │  │  - ClientSecretCredential (Azure Identity)                      │  │ │
│  │  │  - Microsoft Graph SDK                                          │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Storage     │  │ App Insights │  │  Key Vault   │  │  AAD App     │   │
│  │  Account     │  │  (Logging)   │  │  (Secrets)   │  │  Registration│   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ Graph API
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MICROSOFT 365                                       │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                       Microsoft Graph                                  │ │
│  │  ┌─────────────────────────────┐  ┌─────────────────────────────────┐ │ │
│  │  │    Shared Vacation          │  │      Per-User Calendars         │ │ │
│  │  │    Calendar Mailbox         │  │  (filtered by "Vacation"        │ │ │
│  │  │    /users/{mailbox}/        │  │   category)                     │ │ │
│  │  │    calendarView             │  │  /users/{upn}/calendarView      │ │ │
│  │  └─────────────────────────────┘  └─────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Widget Initialization
1. Staffbase loads the custom widget
2. Widget SDK provides user context (email, profile fields)
3. Widget derives M365 UPN from Staffbase user

### 2. Vacation Data Request
1. Widget calculates view range (day/week/month/timeline)
2. API client sends GET /api/vacations with:
   - `start`, `end`: ISO date strings
   - `view`: Current view type
   - `users`: Optional user filter
   - `x-api-key`: Authentication header

### 3. Backend Processing
1. API key validator checks authentication
2. Date range parser validates parameters
3. Vacation service queries Graph API:
   - **Shared mode**: Single calendar mailbox
   - **Per-user mode**: Multiple user calendars filtered by category
4. Events normalized to VacationEvent format
5. User display names enriched if needed

### 4. Widget Rendering
1. Events grouped by user
2. Timeline renders:
   - Date header columns
   - User rows with colored vacation bars
   - Today marker
3. User filter allows selection
4. Legend shows color assignments

## Security Model

```
┌─────────────────────────────────────────────────────────────────┐
│                      Security Layers                             │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: CORS                                                  │
│  - Restricts origins to Staffbase domains                       │
│  - Prevents unauthorized cross-origin requests                  │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: API Key                                               │
│  - x-api-key header required on all requests                    │
│  - Stored securely in Function App settings / Key Vault         │
│  - Constant-time comparison prevents timing attacks             │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: Azure AD (Backend → Graph)                            │
│  - Client credentials flow (no user interaction)                │
│  - App registration with limited Graph permissions              │
│  - Calendars.Read / Calendars.Read.Shared / User.Read.All       │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: HTTPS                                                 │
│  - All traffic encrypted in transit                             │
│  - Function App configured HTTPS-only                           │
└─────────────────────────────────────────────────────────────────┘
```
