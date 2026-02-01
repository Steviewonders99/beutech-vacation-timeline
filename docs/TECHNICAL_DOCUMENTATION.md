# Beutech Vacation Timeline Widget
## Technical Documentation & Architecture Guide

**Version:** 1.0
**Last Updated:** February 2026
**Platform:** Staffbase Custom Widget + Azure Functions Backend

---

## Executive Summary: What This Widget Does

### The Problem
Managing team vacations is chaotic. Employees email their manager, managers track approvals in spreadsheets, and nobody knows who's out until someone misses a meeting. HR spends hours manually updating calendars.

### The Solution
**Beutech Vacation Timeline** is a one-stop vacation management widget that lives inside your Staffbase intranet. Employees see it every day, right where they already work.

### What It Does (In Plain English)

| Feature | What It Means |
|---------|---------------|
| 📅 **Visual Calendar** | See who's on vacation at a glance - by day, week, or month |
| 📝 **Request Time Off** | Employees submit vacation requests in 30 seconds |
| ✅ **Approve/Reject** | Managers handle approvals with one click |
| 📧 **Outlook Sync** | Approved vacations appear in company Outlook calendars automatically |
| 🌍 **Multi-Language** | Works in English, German, French, and Spanish |
| 📱 **Mobile-Ready** | Works on phones, tablets, and desktops |

### Who Benefits

| Role | Benefit |
|------|---------|
| **Employees** | Request time off without leaving Staffbase. See team availability instantly. |
| **Managers** | Approve requests from anywhere. No more lost email threads. |
| **HR** | Zero manual calendar updates. Full audit trail of all requests. |
| **IT** | Self-contained widget. Secure API. Easy to deploy and maintain. |

### The Bottom Line
- **Before:** 15+ minutes to request and approve a vacation
- **After:** Under 2 minutes, fully tracked, automatically synced

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Data Flow Diagrams](#3-data-flow-diagrams)
4. [Features & Capabilities](#4-features--capabilities)
5. [API Reference](#5-api-reference)
6. [User Journeys](#6-user-journeys)
7. [Configuration Guide](#7-configuration-guide)
8. [Security Model](#8-security-model)
9. [Technology Stack](#9-technology-stack)

---

## 1. System Overview

The **Beutech Vacation Timeline** is an enterprise-grade vacation management widget designed for Staffbase. It provides:

- **Visual Timeline**: See team vacations at a glance (day/week/month views)
- **Request Management**: Submit time-off requests directly from the widget
- **Approval Workflow**: Supervisors can approve/reject requests
- **Microsoft 365 Integration**: Syncs with Outlook calendars via Graph API
- **Multi-language Support**: English, German, French, Spanish with auto-detection

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           STAFFBASE PLATFORM                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Vacation Timeline Widget                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │   │
│  │  │ Calendar │  │   My     │  │Approvals │  │   New Request    │ │   │
│  │  │   View   │  │ Requests │  │Dashboard │  │     Modal        │ │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │   │
│  │       │              │              │                 │           │   │
│  │       └──────────────┴──────────────┴─────────────────┘           │   │
│  │                              │                                     │   │
│  │                    ┌─────────▼─────────┐                          │   │
│  │                    │    API Client     │                          │   │
│  │                    │  (x-api-key auth) │                          │   │
│  │                    └─────────┬─────────┘                          │   │
│  └──────────────────────────────┼────────────────────────────────────┘   │
└─────────────────────────────────┼────────────────────────────────────────┘
                                  │ HTTPS
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        AZURE FUNCTIONS BACKEND                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      API Endpoints                                │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │   │
│  │  │    GET     │  │    POST    │  │    GET     │  │   POST     │ │   │
│  │  │ /vacations │  │ /requests  │  │ /requests  │  │  /approve  │ │   │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘ │   │
│  │        │               │               │               │         │   │
│  │        ▼               ▼               ▼               ▼         │   │
│  │  ┌─────────────────────────────────────────────────────────────┐│   │
│  │  │                    Service Layer                             ││   │
│  │  │  vacationService │ requestService │ managerService          ││   │
│  │  └─────────┬────────────────┬──────────────────┬───────────────┘│   │
│  └────────────┼────────────────┼──────────────────┼─────────────────┘   │
└───────────────┼────────────────┼──────────────────┼─────────────────────┘
                │                │                  │
        ┌───────▼───────┐  ┌─────▼─────┐    ┌──────▼──────┐
        │ Microsoft 365 │  │PostgreSQL │    │   Email     │
        │  Graph API    │  │  (Neon)   │    │  Service    │
        └───────────────┘  └───────────┘    └─────────────┘
```

---

## 2. Architecture Diagram

### Component Architecture

```mermaid
flowchart TB
    subgraph Staffbase["Staffbase Platform"]
        Widget["Vacation Timeline Widget"]
        SDK["Staffbase Widget SDK"]
    end

    subgraph Frontend["Frontend Components"]
        Calendar["Calendar View"]
        MyReq["My Requests"]
        Approvals["Approvals Dashboard"]
        Modal["Request Modal"]
    end

    subgraph Hooks["React Hooks"]
        useVacation["useVacationData"]
        useContext["useStaffbaseUserContext"]
        useRequest["useTimeOffRequest"]
        useApprovals["usePendingApprovals"]
    end

    subgraph Backend["Azure Functions"]
        GetVac["GET /vacations"]
        PostReq["POST /requests"]
        GetReq["GET /requests"]
        Approve["POST /approve"]
        Reject["POST /reject"]
    end

    subgraph Services["Backend Services"]
        VacSvc["vacationService"]
        ReqSvc["requestService"]
        MgrSvc["managerService"]
        NotifySvc["notificationService"]
    end

    subgraph External["External Services"]
        Graph["Microsoft Graph API"]
        DB["PostgreSQL Database"]
        Email["Email Service"]
    end

    Widget --> SDK
    Widget --> Frontend
    Frontend --> Hooks
    Hooks --> Backend
    Backend --> Services
    Services --> External
```

### Database Schema

```mermaid
erDiagram
    TIME_OFF_REQUESTS {
        uuid id PK
        varchar requester_email
        varchar requester_name
        varchar supervisor_email
        varchar supervisor_name
        date start_date
        date end_date
        varchar leave_type
        text reason
        varchar status
        timestamp status_changed_at
        varchar status_changed_by
        text rejection_reason
        varchar calendar_event_id
        timestamp created_at
        timestamp updated_at
    }
```

---

## 3. Data Flow Diagrams

### 3.1 View Vacations Flow

```mermaid
sequenceDiagram
    participant User
    participant Widget
    participant Hook as useVacationData
    participant API as Azure Functions
    participant Graph as Microsoft Graph
    participant Calendar as Outlook Calendar

    User->>Widget: Opens widget
    Widget->>Hook: Initialize with date range
    Hook->>API: GET /api/vacations?start=X&end=Y
    API->>API: Validate API key
    API->>Graph: Query calendarView
    Graph->>Calendar: Fetch events
    Calendar-->>Graph: Events data
    Graph-->>API: Calendar events
    API->>API: Transform to VacationEvent[]
    API-->>Hook: { events, meta }
    Hook->>Hook: Extract users, assign colors
    Hook-->>Widget: events[], users[]
    Widget-->>User: Render timeline
```

### 3.2 Submit Request Flow

```mermaid
sequenceDiagram
    participant User
    participant Modal as Request Modal
    participant Hook as useTimeOffRequest
    participant API as Azure Functions
    participant DB as PostgreSQL
    participant Graph as Microsoft Graph
    participant Email as Email Service

    User->>Modal: Fill form & submit
    Modal->>Hook: submitRequest(data)
    Hook->>API: POST /api/requests
    API->>API: Validate input
    API->>Graph: Get user's manager
    Graph-->>API: Manager info
    API->>DB: INSERT request (status: pending)
    DB-->>API: Request created
    API->>Email: Notify supervisor
    Email-->>API: Sent
    API-->>Hook: { request, message }
    Hook-->>Modal: Success
    Modal-->>User: Show confirmation
```

### 3.3 Approval Flow

```mermaid
sequenceDiagram
    participant Supervisor
    participant Dashboard as Approvals Tab
    participant Hook as usePendingApprovals
    participant API as Azure Functions
    participant DB as PostgreSQL
    participant Graph as Microsoft Graph
    participant Calendar as Shared Calendar

    Supervisor->>Dashboard: View pending requests
    Dashboard->>Hook: Fetch pending
    Hook->>API: GET /api/requests?role=supervisor
    API->>DB: Query pending requests
    DB-->>API: Requests[]
    API-->>Hook: { requests }
    Hook-->>Dashboard: Display requests

    Supervisor->>Dashboard: Click "Approve"
    Dashboard->>Hook: approveRequest(id)
    Hook->>API: POST /api/requests/{id}/approve
    API->>DB: Verify request is pending
    API->>Graph: Create calendar event
    Graph->>Calendar: Add event
    Calendar-->>Graph: Event created
    Graph-->>API: calendarEventId
    API->>DB: UPDATE status='approved'
    API->>API: Send notification email
    API-->>Hook: { request, calendarEventId }
    Hook-->>Dashboard: Update UI
    Dashboard-->>Supervisor: Show success
```

### 3.4 User Context Resolution Flow

```mermaid
flowchart TD
    A[Widget Loads] --> B[Call widgetApi.getUserInformation]
    B --> C{User Profile Received}
    C --> D[Extract User Fields]
    D --> E{Has externalId with @?}
    E -->|Yes| F[Use externalId as M365 UPN]
    E -->|No| G{Has email?}
    G -->|Yes| H[Use email as M365 UPN]
    G -->|No| I[Construct: userId@fallbackDomain]
    F --> J[Derive Manager Email]
    H --> J
    I --> J
    J --> K{Manager in Profile?}
    K -->|Yes| L[Use profile manager]
    K -->|No| M[Query Graph API for manager]
    L --> N[Check Supervisor Status]
    M --> N
    N --> O{Has directReports?}
    O -->|Yes| P[isSupervisor = true]
    O -->|No| Q[isSupervisor = false]
    P --> R[Context Ready]
    Q --> R
```

---

## 4. Features & Capabilities

### Feature Matrix

| Feature | Description | User Types |
|---------|-------------|------------|
| **Calendar Views** | Day, Week, Month grid views | All users |
| **Timeline View** | Horizontal resource timeline | All users |
| **User Filtering** | Filter by specific team members | All users |
| **Color Legend** | Color-coded user identification | All users |
| **Date Navigation** | Jump to any date via dropdown | All users |
| **Today Marker** | Visual indicator for current date | All users |
| **Request Submission** | Submit time-off requests | All users |
| **My Requests** | View own request history | All users |
| **Pending Approvals** | Review team requests | Supervisors only |
| **Approve/Reject** | Process pending requests | Supervisors only |
| **Email Notifications** | Alerts for request status | All users |
| **Outlook Deep Link** | Jump to full Outlook calendar | All users |
| **Multi-language** | EN, DE, FR, ES support | All users |

### View Modes

```mermaid
flowchart LR
    subgraph Views["Calendar Views"]
        Day["Day View<br/>Single day focus"]
        Week["Week View<br/>7-day timeline"]
        Month["Month View<br/>Full month grid"]
    end

    subgraph Features["Common Features"]
        Nav["Date Navigation"]
        Filter["User Filter"]
        Today["Today Marker"]
        Legend["Color Legend"]
    end

    Day --> Features
    Week --> Features
    Month --> Features
```

### Request Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft: User opens modal
    Draft --> Pending: Submit request
    Pending --> Approved: Supervisor approves
    Pending --> Rejected: Supervisor rejects
    Approved --> [*]: Calendar event created
    Rejected --> [*]: User notified

    note right of Pending
        - Supervisor notified
        - Visible in Approvals tab
    end note

    note right of Approved
        - Calendar event created
        - Requester notified
        - Shows in timeline
    end note
```

---

## 5. API Reference

### Authentication

All API requests require the `x-api-key` header:

```http
x-api-key: your-api-key-here
```

### Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vacations` | Fetch vacation events |
| GET | `/api/vacations/next-event` | Get next upcoming event |
| POST | `/api/requests` | Create time-off request |
| GET | `/api/requests` | List requests |
| POST | `/api/requests/{id}/approve` | Approve request |
| POST | `/api/requests/{id}/reject` | Reject request |
| GET | `/api/health` | Health check |

### GET /api/vacations

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| start | ISO date | Yes | Start of date range |
| end | ISO date | Yes | End of date range |
| view | string | Yes | `day`, `week`, `month` |
| users | string | No | Comma-separated emails |
| timezone | string | No | IANA timezone |

**Response:**

```json
{
  "events": [
    {
      "id": "AAMkAGI2...",
      "userId": "user@company.com",
      "userDisplayName": "John Doe",
      "userColorKey": "user@company.com",
      "title": "Vacation",
      "start": "2026-02-09T00:00:00Z",
      "end": "2026-02-12T00:00:00Z"
    }
  ],
  "meta": {
    "start": "2026-02-05T00:00:00Z",
    "end": "2026-02-12T00:00:00Z",
    "generatedAt": "2026-02-05T10:00:00.123Z"
  }
}
```

### POST /api/requests

**Request Body:**

```json
{
  "requesterEmail": "user@company.com",
  "requesterName": "John Doe",
  "startDate": "2026-06-01",
  "endDate": "2026-06-05",
  "leaveType": "vacation",
  "reason": "Summer break"
}
```

**Response (201):**

```json
{
  "request": {
    "id": "uuid",
    "status": "pending",
    "supervisorEmail": "manager@company.com",
    "createdAt": "2026-02-01T10:00:00Z"
  },
  "message": "Request submitted. Supervisor notified."
}
```

---

## 6. User Journeys

### Journey 1: Employee Views Team Calendar

```mermaid
journey
    title Employee Views Team Calendar
    section Open Widget
        Navigate to Staffbase: 5: Employee
        Widget loads: 5: System
        See week view: 5: Employee
    section Explore Calendar
        Switch to Month view: 5: Employee
        Filter to specific team: 4: Employee
        Navigate to next month: 5: Employee
    section Find Information
        See colleague's vacation: 5: Employee
        Plan around team absences: 5: Employee
```

### Journey 2: Employee Submits Request

```mermaid
journey
    title Employee Submits Time-Off Request
    section Start Request
        Click New Request: 5: Employee
        Modal opens: 5: System
    section Fill Form
        Select dates: 5: Employee
        Choose leave type: 5: Employee
        Add reason: 4: Employee
    section Submit
        Click Submit: 5: Employee
        See confirmation: 5: System
        Check My Requests tab: 5: Employee
```

### Journey 3: Supervisor Approves Request

```mermaid
journey
    title Supervisor Approves Request
    section Notification
        Receive email alert: 5: Supervisor
        Open widget: 5: Supervisor
    section Review
        Navigate to Approvals tab: 5: Supervisor
        See pending request: 5: System
        Review dates and reason: 5: Supervisor
    section Approve
        Click Approve: 5: Supervisor
        Calendar event created: 5: System
        Employee notified: 5: System
```

---

## 7. Configuration Guide

### Widget Configuration (Staffbase Studio)

```mermaid
flowchart TD
    subgraph Required["Required Settings"]
        URL["Backend URL<br/>Azure Functions endpoint"]
        Key["Security Key<br/>API authentication"]
    end

    subgraph Display["Display Settings"]
        View["Default View<br/>day/week/month"]
        Max["Team Size Limit<br/>Max users shown"]
    end

    subgraph DataSource["Data Source"]
        Mode["Calendar Mode<br/>shared/perUser"]
        Mailbox["Shared Calendar Email<br/>(if shared mode)"]
        Category["Calendar Category<br/>(if perUser mode)"]
    end

    subgraph Advanced["Advanced Settings"]
        Domain["Email Domain<br/>M365 fallback"]
        Outlook["Outlook Button<br/>Enable deep link"]
        SAML["SSO Settings<br/>Plugin IDs"]
    end
```

### Environment Variables (Backend)

| Variable | Description | Example |
|----------|-------------|---------|
| `TENANT_ID` | Azure AD tenant | `xxxxxxxx-xxxx-...` |
| `CLIENT_ID` | App registration ID | `xxxxxxxx-xxxx-...` |
| `CLIENT_SECRET` | App secret | `xxxxx` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://...` |
| `API_KEY` | API authentication key | `secure-key` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `https://company.staffbase.com` |
| `CALENDAR_MODE` | shared or perUser | `shared` |
| `VACATION_CALENDAR_MAILBOX` | Shared calendar email | `vacations@company.com` |

---

## 8. Security Model

### Authentication & Authorization

```mermaid
flowchart TD
    subgraph Frontend["Frontend Security"]
        A[API Key in Config] --> B[Sent with every request]
        C[User Context] --> D[Staffbase SDK validates]
    end

    subgraph Backend["Backend Security"]
        E[API Key Validation] --> F{Valid?}
        F -->|No| G[401 Unauthorized]
        F -->|Yes| H[CORS Check]
        H --> I{Origin allowed?}
        I -->|No| J[Block Request]
        I -->|Yes| K[Process Request]
    end

    subgraph Data["Data Security"]
        L[Parameterized Queries] --> M[Prevent SQL Injection]
        N[Row-level Filtering] --> O[Users see only their data]
        P[Supervisors] --> Q[See only direct reports]
    end

    B --> E
    K --> L
    K --> N
    K --> P
```

### Security Measures

| Layer | Measure | Purpose |
|-------|---------|---------|
| Transport | HTTPS | Encrypt data in transit |
| Authentication | API Key | Validate widget identity |
| Authorization | Role-based | Supervisor vs employee access |
| CORS | Origin whitelist | Block unauthorized domains |
| Database | Parameterized queries | Prevent SQL injection |
| Logging | Structured logs | Audit trail |

---

## 9. Technology Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| i18next | Internationalization |
| Staffbase Widget SDK | Platform integration |
| Webpack | Build tooling |
| CSS Variables | Design system |

### Backend

| Technology | Purpose |
|------------|---------|
| Azure Functions | Serverless compute |
| Node.js 20 | Runtime |
| TypeScript | Type safety |
| Microsoft Graph SDK | M365 integration |
| Neon PostgreSQL | Serverless database |
| Zod | Input validation |

### Infrastructure

| Service | Purpose |
|---------|---------|
| Azure Functions | API hosting |
| Azure Blob Storage | Widget hosting |
| Azure Key Vault | Secrets management |
| Application Insights | Monitoring |
| GitHub Actions | CI/CD |

---

## Appendix: Quick Reference

### Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Server Error |

### Leave Types

| Value | Display |
|-------|---------|
| `vacation` | Vacation |
| `sick` | Sick Leave |
| `personal` | Personal Day |
| `other` | Other |

### Request Statuses

| Status | Description |
|--------|-------------|
| `pending` | Awaiting supervisor action |
| `approved` | Approved, calendar event created |
| `rejected` | Rejected by supervisor |

---

*Documentation generated for Beutech Vacation Timeline Widget v1.0*
