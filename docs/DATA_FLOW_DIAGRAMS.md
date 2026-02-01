# Data Flow Diagrams
## Beutech Vacation Timeline Widget

This document provides visual flowcharts showing how data moves through the system.

---

## 1. System Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                              STAFFBASE PLATFORM                                 │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                      VACATION TIMELINE WIDGET                             │  │
│  │                                                                           │  │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │  │
│  │   │  Calendar   │  │     My      │  │  Approvals  │  │  New Request  │  │  │
│  │   │    Tab      │  │  Requests   │  │    Tab      │  │    Button     │  │  │
│  │   │             │  │    Tab      │  │ (Supervisor)│  │               │  │  │
│  │   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───────┬───────┘  │  │
│  │          │                │                │                  │          │  │
│  │          └────────────────┴────────────────┴──────────────────┘          │  │
│  │                                    │                                      │  │
│  │                          ┌─────────▼─────────┐                           │  │
│  │                          │                   │                           │  │
│  │                          │    React Hooks    │                           │  │
│  │                          │  ────────────────  │                           │  │
│  │                          │  useVacationData  │                           │  │
│  │                          │  useMyRequests    │                           │  │
│  │                          │  useApprovals     │                           │  │
│  │                          │                   │                           │  │
│  │                          └─────────┬─────────┘                           │  │
│  │                                    │                                      │  │
│  │                          ┌─────────▼─────────┐                           │  │
│  │                          │    API Client     │                           │  │
│  │                          │   (x-api-key)     │                           │  │
│  │                          └─────────┬─────────┘                           │  │
│  └────────────────────────────────────┼──────────────────────────────────────┘  │
└───────────────────────────────────────┼──────────────────────────────────────────┘
                                        │
                                        │ HTTPS + API Key
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                           AZURE FUNCTIONS BACKEND                               │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                           API ENDPOINTS                                   │  │
│  │                                                                           │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │  │
│  │  │     GET      │ │     POST     │ │     GET      │ │    POST      │    │  │
│  │  │  /vacations  │ │  /requests   │ │  /requests   │ │   /approve   │    │  │
│  │  │              │ │              │ │              │ │   /reject    │    │  │
│  │  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘    │  │
│  │         │                │                │                │             │  │
│  └─────────┼────────────────┼────────────────┼────────────────┼─────────────┘  │
│            │                │                │                │                 │
│  ┌─────────▼────────────────▼────────────────▼────────────────▼─────────────┐  │
│  │                         SERVICE LAYER                                     │  │
│  │                                                                           │  │
│  │   vacationService    requestService    managerService    notifyService   │  │
│  │                                                                           │  │
│  └─────────┬────────────────┬────────────────┬────────────────┬─────────────┘  │
└────────────┼────────────────┼────────────────┼────────────────┼─────────────────┘
             │                │                │                │
             ▼                ▼                ▼                ▼
    ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
    │                │ │                │ │                │ │                │
    │  Microsoft     │ │   PostgreSQL   │ │  Microsoft     │ │    Email       │
    │  Graph API     │ │   Database     │ │  Graph API     │ │   Service      │
    │                │ │                │ │  (Manager)     │ │                │
    │  ┌──────────┐  │ │  ┌──────────┐  │ │                │ │                │
    │  │ Outlook  │  │ │  │ Requests │  │ │                │ │                │
    │  │ Calendar │  │ │  │  Table   │  │ │                │ │                │
    │  └──────────┘  │ │  └──────────┘  │ │                │ │                │
    │                │ │                │ │                │ │                │
    └────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘
```

---

## 2. View Vacations Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          VIEW VACATIONS FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────┐
    │  User   │
    └────┬────┘
         │
         │ 1. Opens widget
         ▼
    ┌─────────────────────────────┐
    │         Widget UI           │
    │  ┌───────────────────────┐  │
    │  │ Calendar View (Week)  │  │
    │  │ Feb 2-8, 2026         │  │
    │  └───────────────────────┘  │
    └─────────────┬───────────────┘
                  │
                  │ 2. Calculate date range
                  ▼
    ┌─────────────────────────────┐
    │    useVacationData Hook     │
    │                             │
    │  start: 2026-02-02          │
    │  end:   2026-02-08          │
    │  view:  week                │
    └─────────────┬───────────────┘
                  │
                  │ 3. API Request
                  │    GET /api/vacations?start=2026-02-02&end=2026-02-08
                  │    Header: x-api-key: xxx
                  ▼
    ┌─────────────────────────────┐
    │    Azure Functions API      │
    │                             │
    │  ┌───────────────────────┐  │
    │  │ 1. Validate API key   │  │
    │  │ 2. Parse date range   │  │
    │  │ 3. Call Graph API     │  │
    │  └───────────────────────┘  │
    └─────────────┬───────────────┘
                  │
                  │ 4. Query Microsoft Graph
                  ▼
    ┌─────────────────────────────┐
    │     Microsoft Graph API     │
    │                             │
    │  GET /users/{mailbox}/      │
    │      calendarView           │
    │  ?startDateTime=...         │
    │  &endDateTime=...           │
    └─────────────┬───────────────┘
                  │
                  │ 5. Return events
                  ▼
    ┌─────────────────────────────┐
    │    Transform Response       │
    │                             │
    │  Graph Event ──► VacationEvent  │
    │  ┌─────────────────────────┐│
    │  │ id: "AAMk..."          ││
    │  │ userId: "user@co.com"  ││
    │  │ userDisplayName: "John"││
    │  │ title: "Vacation"      ││
    │  │ start: "2026-02-05"    ││
    │  │ end: "2026-02-07"      ││
    │  └─────────────────────────┘│
    └─────────────┬───────────────┘
                  │
                  │ 6. Return to widget
                  ▼
    ┌─────────────────────────────┐
    │    Widget Renders           │
    │                             │
    │  ┌───────────────────────┐  │
    │  │ MON TUE WED THU FRI   │  │
    │  │  2   3   4   5   6    │  │
    │  │          ████████████ │  │
    │  │  John    [Vacation  ] │  │
    │  │          ████████████ │  │
    │  └───────────────────────┘  │
    └─────────────────────────────┘
```

---

## 3. Submit Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SUBMIT REQUEST FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────┐
    │ Employee │
    └────┬─────┘
         │
         │ 1. Click "New Request"
         ▼
    ┌─────────────────────────────────────────────┐
    │              Request Modal                   │
    │  ┌─────────────────────────────────────┐    │
    │  │ Request Time Off              [X]   │    │
    │  ├─────────────────────────────────────┤    │
    │  │ Start Date:  [02/15/2026]           │    │
    │  │ End Date:    [02/19/2026]           │    │
    │  │ Leave Type:  [Vacation     ▼]       │    │
    │  │ Reason:      [Family trip    ]      │    │
    │  ├─────────────────────────────────────┤    │
    │  │       [Cancel]  [Submit Request]    │    │
    │  └─────────────────────────────────────┘    │
    └─────────────────────┬───────────────────────┘
                          │
                          │ 2. Submit
                          ▼
    ┌─────────────────────────────────────────────┐
    │           useTimeOffRequest Hook            │
    │                                             │
    │  POST /api/requests                         │
    │  {                                          │
    │    requesterEmail: "john@company.com",      │
    │    requesterName: "John Doe",               │
    │    startDate: "2026-02-15",                 │
    │    endDate: "2026-02-19",                   │
    │    leaveType: "vacation",                   │
    │    reason: "Family trip"                    │
    │  }                                          │
    └─────────────────────┬───────────────────────┘
                          │
                          │ 3. Process request
                          ▼
    ┌─────────────────────────────────────────────┐
    │              Azure Functions                 │
    │                                             │
    │  ┌─────────────────────────────────────┐   │
    │  │ Step 1: Validate input              │   │
    │  │   - Dates not in past               │   │
    │  │   - End >= Start                    │   │
    │  └─────────────────────────────────────┘   │
    │                    │                        │
    │                    ▼                        │
    │  ┌─────────────────────────────────────┐   │
    │  │ Step 2: Get manager from Graph      │   │
    │  │   GET /users/john@co/manager        │   │
    │  │   Response: manager@company.com     │   │
    │  └─────────────────────────────────────┘   │
    │                    │                        │
    │                    ▼                        │
    │  ┌─────────────────────────────────────┐   │
    │  │ Step 3: Insert into database        │   │
    │  │   INSERT INTO time_off_requests     │   │
    │  │   (status: 'pending')               │   │
    │  └─────────────────────────────────────┘   │
    │                    │                        │
    │                    ▼                        │
    │  ┌─────────────────────────────────────┐   │
    │  │ Step 4: Notify supervisor           │   │
    │  │   Send email to manager@company.com │   │
    │  └─────────────────────────────────────┘   │
    └─────────────────────┬───────────────────────┘
                          │
                          │ 4. Return success
                          ▼
    ┌─────────────────────────────────────────────┐
    │              Modal closes                    │
    │                                             │
    │  ┌─────────────────────────────────────┐   │
    │  │ ✓ Request submitted successfully    │   │
    │  │   Your supervisor has been notified │   │
    │  └─────────────────────────────────────┘   │
    └─────────────────────────────────────────────┘
                          │
                          ▼
    ┌─────────────────────────────────────────────┐
    │           My Requests Tab Updated           │
    │                                             │
    │  ┌─────────────────────────────────────┐   │
    │  │ Vacation              [PENDING]     │   │
    │  │ Feb 15 - Feb 19, 2026 (5 days)     │   │
    │  │ Reason: Family trip                 │   │
    │  │ Supervisor: Jane Manager            │   │
    │  └─────────────────────────────────────┘   │
    └─────────────────────────────────────────────┘
```

---

## 4. Approval Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APPROVAL FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌────────────────┐
                    │   Supervisor   │
                    │  (Jane Manager)│
                    └───────┬────────┘
                            │
                            │ 1. Receives email notification
                            │    "New time-off request from John Doe"
                            ▼
                    ┌────────────────────────────────┐
                    │     Opens Staffbase Widget     │
                    │     Clicks "Approvals" tab     │
                    └───────────────┬────────────────┘
                                    │
                                    │ 2. Fetch pending requests
                                    │    GET /api/requests?role=supervisor
                                    ▼
                    ┌────────────────────────────────┐
                    │        Approvals Dashboard     │
                    │                                │
                    │  ┌──────────────────────────┐  │
                    │  │ Pending Approvals (1)    │  │
                    │  │                          │  │
                    │  │ ┌──────────────────────┐ │  │
                    │  │ │ [J] John Doe         │ │  │
                    │  │ │ Vacation             │ │  │
                    │  │ │ Feb 15-19, 2026      │ │  │
                    │  │ │ Reason: Family trip  │ │  │
                    │  │ │                      │ │  │
                    │  │ │ [Reject] [Approve]   │ │  │
                    │  │ └──────────────────────┘ │  │
                    │  └──────────────────────────┘  │
                    └───────────────┬────────────────┘
                                    │
                                    │ 3. Click "Approve"
                                    ▼
                    ┌────────────────────────────────┐
                    │     POST /api/requests/{id}/   │
                    │          approve               │
                    └───────────────┬────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
    ┌───────────────────────────┐   ┌───────────────────────────┐
    │   Create Calendar Event   │   │   Update Database         │
    │                           │   │                           │
    │   POST to Graph API       │   │   UPDATE time_off_requests│
    │   /users/{mailbox}/       │   │   SET status = 'approved' │
    │     calendar/events       │   │   calendar_event_id = ... │
    │                           │   │                           │
    │   Creates event in        │   │                           │
    │   shared vacation         │   │                           │
    │   calendar                │   │                           │
    └───────────────────────────┘   └───────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌────────────────────────────────┐
                    │     Send Notification Email    │
                    │                                │
                    │  To: john@company.com          │
                    │  Subject: Time-off approved    │
                    │                                │
                    │  "Your request for Feb 15-19   │
                    │   has been approved"           │
                    └───────────────┬────────────────┘
                                    │
                                    ▼
                    ┌────────────────────────────────┐
                    │       Results                  │
                    │                                │
                    │  ✓ Request approved            │
                    │  ✓ Calendar event created      │
                    │  ✓ Employee notified           │
                    │  ✓ Visible in timeline         │
                    └────────────────────────────────┘
```

---

## 5. User Context Resolution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     USER CONTEXT RESOLUTION                                  │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌───────────────────────────┐
    │     Widget Initializes    │
    └─────────────┬─────────────┘
                  │
                  │ widgetApi.getUserInformation()
                  ▼
    ┌───────────────────────────────────────────┐
    │         Staffbase User Profile            │
    │                                           │
    │  {                                        │
    │    id: "user123",                         │
    │    firstName: "John",                     │
    │    lastName: "Doe",                       │
    │    email: "john.doe@company.com",         │
    │    externalId: "john@company.onmicrosoft" │
    │    manager: {...},                        │
    │    directReports: [...]                   │
    │  }                                        │
    └─────────────┬─────────────────────────────┘
                  │
                  │ Derive M365 UPN
                  ▼
    ┌───────────────────────────────────────────┐
    │         M365 UPN Resolution               │
    │                                           │
    │  Priority 1: externalId (if has @)        │
    │     ──► "john@company.onmicrosoft.com"    │
    │                                           │
    │  Priority 2: email                        │
    │     ──► "john.doe@company.com"            │
    │                                           │
    │  Priority 3: id + fallback domain         │
    │     ──► "user123@company.com"             │
    │                                           │
    └─────────────┬─────────────────────────────┘
                  │
                  │ Result: m365Upn
                  ▼
    ┌───────────────────────────────────────────┐
    │         Supervisor Detection              │
    │                                           │
    │  Check: directReports array               │
    │                                           │
    │  IF directReports.length > 0              │
    │     isSupervisor = true                   │
    │     Show "Approvals" tab                  │
    │  ELSE                                     │
    │     isSupervisor = false                  │
    │     Hide "Approvals" tab                  │
    │                                           │
    └─────────────┬─────────────────────────────┘
                  │
                  ▼
    ┌───────────────────────────────────────────┐
    │         Context Ready                     │
    │                                           │
    │  {                                        │
    │    m365Upn: "john@company.onmicrosoft",   │
    │    displayName: "John Doe",               │
    │    managerEmail: "jane@company.com",      │
    │    isSupervisor: false                    │
    │  }                                        │
    │                                           │
    │  ✓ Ready to make API calls                │
    │  ✓ Ready to submit requests               │
    │  ✓ UI configured based on role            │
    └───────────────────────────────────────────┘
```

---

## 6. Calendar Modes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CALENDAR MODES                                       │
└─────────────────────────────────────────────────────────────────────────────┘


    ┌─────────────────────────────────────────────────────────────────────────┐
    │                     MODE 1: SHARED CALENDAR                              │
    │                                                                          │
    │   All vacations stored in one shared mailbox calendar                    │
    │   Best for: Small/medium teams, centralized management                   │
    │                                                                          │
    │   ┌─────────────┐                                                        │
    │   │   Widget    │                                                        │
    │   └──────┬──────┘                                                        │
    │          │                                                               │
    │          │ GET /api/vacations                                            │
    │          ▼                                                               │
    │   ┌─────────────────────┐                                                │
    │   │   Backend queries   │                                                │
    │   │   Graph API:        │                                                │
    │   │                     │                                                │
    │   │   GET /users/       │                                                │
    │   │   vacations@co.com/ │◄──── Shared mailbox                            │
    │   │   calendarView      │                                                │
    │   └─────────────────────┘                                                │
    │                                                                          │
    │   Config: calendarMode = "shared"                                        │
    │           sharedCalendarMailbox = "vacations@company.com"                │
    │                                                                          │
    └─────────────────────────────────────────────────────────────────────────┘


    ┌─────────────────────────────────────────────────────────────────────────┐
    │                     MODE 2: PER-USER CALENDARS                           │
    │                                                                          │
    │   Each user's vacation events in their own calendar                      │
    │   Best for: Larger orgs, decentralized management                        │
    │                                                                          │
    │   ┌─────────────┐                                                        │
    │   │   Widget    │                                                        │
    │   └──────┬──────┘                                                        │
    │          │                                                               │
    │          │ GET /api/vacations?users=a@co,b@co,c@co                       │
    │          ▼                                                               │
    │   ┌─────────────────────┐                                                │
    │   │   Backend queries   │                                                │
    │   │   Graph API for     │                                                │
    │   │   each user:        │                                                │
    │   │                     │                                                │
    │   │   GET /users/a@co/  │◄──── User A's calendar                         │
    │   │   calendarView      │                                                │
    │   │   ?$filter=category │                                                │
    │   │                     │                                                │
    │   │   GET /users/b@co/  │◄──── User B's calendar                         │
    │   │   calendarView      │                                                │
    │   │   ?$filter=category │                                                │
    │   │                     │                                                │
    │   │   GET /users/c@co/  │◄──── User C's calendar                         │
    │   │   calendarView      │                                                │
    │   │   ?$filter=category │                                                │
    │   └─────────────────────┘                                                │
    │                                                                          │
    │   Config: calendarMode = "perUser"                                       │
    │           vacationCategory = "Vacation"                                  │
    │                                                                          │
    └─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Request Status Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       REQUEST STATUS LIFECYCLE                               │
└─────────────────────────────────────────────────────────────────────────────┘


                              ┌─────────────┐
                              │   DRAFT     │
                              │  (in modal) │
                              └──────┬──────┘
                                     │
                                     │ User clicks "Submit"
                                     ▼
         ┌───────────────────────────────────────────────────────┐
         │                                                        │
         │                      PENDING                           │
         │                                                        │
         │   • Stored in database                                 │
         │   • Supervisor notified via email                      │
         │   • Visible in "My Requests" tab                       │
         │   • Visible in supervisor's "Approvals" tab            │
         │                                                        │
         └────────────────────────┬───────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
         ┌──────────────────────┐    ┌──────────────────────┐
         │                      │    │                      │
         │      APPROVED        │    │      REJECTED        │
         │                      │    │                      │
         │ • Calendar event     │    │ • Rejection reason   │
         │   created in Outlook │    │   stored             │
         │ • Requester notified │    │ • Requester notified │
         │ • Shows in timeline  │    │ • Shows in My        │
         │                      │    │   Requests with      │
         │                      │    │   reason             │
         └──────────────────────┘    └──────────────────────┘


    ┌─────────────────────────────────────────────────────────────────────────┐
    │                       DATABASE RECORD STATES                             │
    └─────────────────────────────────────────────────────────────────────────┘

    PENDING:
    ┌────────────────────────────────────────────────────────────┐
    │  id: "abc-123"                                             │
    │  status: "pending"                                         │
    │  requester_email: "john@company.com"                       │
    │  supervisor_email: "jane@company.com"                      │
    │  start_date: "2026-02-15"                                  │
    │  end_date: "2026-02-19"                                    │
    │  created_at: "2026-02-01T10:00:00Z"                        │
    │  calendar_event_id: NULL                                   │
    │  rejection_reason: NULL                                    │
    └────────────────────────────────────────────────────────────┘

    APPROVED:
    ┌────────────────────────────────────────────────────────────┐
    │  id: "abc-123"                                             │
    │  status: "approved"                                        │
    │  status_changed_at: "2026-02-02T14:30:00Z"                 │
    │  status_changed_by: "jane@company.com"                     │
    │  calendar_event_id: "AAMkAGI2..."  ◄── Graph event ID      │
    │  rejection_reason: NULL                                    │
    └────────────────────────────────────────────────────────────┘

    REJECTED:
    ┌────────────────────────────────────────────────────────────┐
    │  id: "abc-123"                                             │
    │  status: "rejected"                                        │
    │  status_changed_at: "2026-02-02T14:30:00Z"                 │
    │  status_changed_by: "jane@company.com"                     │
    │  calendar_event_id: NULL                                   │
    │  rejection_reason: "Insufficient coverage during Q1 close" │
    └────────────────────────────────────────────────────────────┘
```

---

## 8. Security Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SECURITY FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐
    │   Widget    │
    │  (Browser)  │
    └──────┬──────┘
           │
           │ 1. Every API request includes:
           │    - Header: x-api-key: {configured key}
           │    - Header: Origin: https://company.staffbase.com
           │
           ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                    AZURE FUNCTIONS                               │
    │                                                                  │
    │  ┌────────────────────────────────────────────────────────────┐ │
    │  │                    REQUEST RECEIVED                         │ │
    │  └───────────────────────────┬────────────────────────────────┘ │
    │                              │                                   │
    │                              ▼                                   │
    │  ┌────────────────────────────────────────────────────────────┐ │
    │  │              STEP 1: API KEY VALIDATION                     │ │
    │  │                                                             │ │
    │  │   Extract x-api-key header                                  │ │
    │  │   Compare with env.API_KEY (constant-time)                  │ │
    │  │                                                             │ │
    │  │   ┌─────────────┐     ┌─────────────┐                      │ │
    │  │   │  Missing?   │────►│ 401 Error   │                      │ │
    │  │   └─────────────┘     │ "API key    │                      │ │
    │  │                       │  required"  │                      │ │
    │  │   ┌─────────────┐     └─────────────┘                      │ │
    │  │   │  Invalid?   │────►│ 401 Error   │                      │ │
    │  │   └─────────────┘     │ "Invalid    │                      │ │
    │  │                       │  API key"   │                      │ │
    │  │   ┌─────────────┐     └─────────────┘                      │ │
    │  │   │   Valid ✓   │                                          │ │
    │  │   └──────┬──────┘                                          │ │
    │  └──────────┼─────────────────────────────────────────────────┘ │
    │             │                                                    │
    │             ▼                                                    │
    │  ┌────────────────────────────────────────────────────────────┐ │
    │  │              STEP 2: CORS VALIDATION                        │ │
    │  │                                                             │ │
    │  │   Extract Origin header                                     │ │
    │  │   Check against ALLOWED_ORIGINS list                        │ │
    │  │                                                             │ │
    │  │   ┌─────────────┐     ┌─────────────┐                      │ │
    │  │   │Not allowed? │────►│ No CORS     │                      │ │
    │  │   └─────────────┘     │ headers     │                      │ │
    │  │                       │ (blocked)   │                      │ │
    │  │   ┌─────────────┐     └─────────────┘                      │ │
    │  │   │  Allowed ✓  │                                          │ │
    │  │   └──────┬──────┘                                          │ │
    │  └──────────┼─────────────────────────────────────────────────┘ │
    │             │                                                    │
    │             ▼                                                    │
    │  ┌────────────────────────────────────────────────────────────┐ │
    │  │              STEP 3: INPUT VALIDATION                       │ │
    │  │                                                             │ │
    │  │   - Validate date formats                                   │ │
    │  │   - Validate email formats                                  │ │
    │  │   - Check required fields                                   │ │
    │  │   - Sanitize strings                                        │ │
    │  └──────────┬─────────────────────────────────────────────────┘ │
    │             │                                                    │
    │             ▼                                                    │
    │  ┌────────────────────────────────────────────────────────────┐ │
    │  │              STEP 4: AUTHORIZATION                          │ │
    │  │                                                             │ │
    │  │   For supervisor endpoints:                                 │ │
    │  │   - Verify supervisor owns the request                      │ │
    │  │   - Check request belongs to their direct report            │ │
    │  └──────────┬─────────────────────────────────────────────────┘ │
    │             │                                                    │
    │             ▼                                                    │
    │  ┌────────────────────────────────────────────────────────────┐ │
    │  │              PROCESS REQUEST ✓                              │ │
    │  └────────────────────────────────────────────────────────────┘ │
    └─────────────────────────────────────────────────────────────────┘
```

---

*Document Version: 1.0 | Last Updated: February 2026*
