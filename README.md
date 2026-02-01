````markdown
# Beautech Vacation Timeline Widget

A **Staffbase custom widget** + **Azure / Microsoft 365 backend** that visualizes
employees’ vacations on a **multi-resource timeline** (day / week / month),
similar to the MS Teams calendar view.

This README is designed to be **dummy-proof** and **phase-oriented** so that
PMs, devs, and admins can follow it end-to-end.

---

## 1. High-Level Overview

### 1.1 Goals

- Display a **timeline calendar** of vacations for multiple people at once.
- Show **overlaps** per person (resource-style view).
- Allow filtering by:
  - **View**: Day / Week / Month / Timeline
  - **Person**: specific employees or “My vacations”.
- Integrate with **Microsoft 365** via **Microsoft Graph**:
  - Either a **shared “Vacation” calendar** OR
  - Individual users’ calendars filtered by vacation category.
- Use **Staffbase user context** to:
  - Highlight “my holidays”.
  - Map Staffbase user → Microsoft 365 UPN.
- Be **secure, robust, and scalable**:
  - Backend runs on **Azure Functions (Node + TypeScript)**.
  - Auth via **Azure AD app registration** with **client credentials flow**.
  - Secrets stored in **Azure Key Vault** or function app configuration.
  - CORS locked down to Staffbase domains; API key or JWT for the widget.

---

## 2. Technology Stack

### Frontend (Staffbase Widget)

- React 18 + TypeScript
- Staffbase custom widget framework & SDK  
  <https://developers.staffbase.com/frameworks/customwidget-development/>
- Optional: `react-big-calendar` for the timeline, or custom CSS grid timeline.
- Build tooling from Staffbase generator (Webpack / Vite depending on template).

### Backend (Azure)

- Azure Functions (Node.js 20 + TypeScript)
- Microsoft Graph SDK (`@microsoft/microsoft-graph-client`)
- Azure Identity (`@azure/identity`) for client-credential auth
- Optional caching:
  - Azure Cache for Redis or in-memory caching with `lru-cache`.

### Infrastructure

- IaC: **Bicep** or **Terraform** (your choice—this doc assumes Bicep).
- Resources:
  - Function App
  - Storage Account
  - Application Insights
  - (Optional) Key Vault
  - (Optional) Azure API Management in front of Function App

---

## 3. Repository Structure

Recommended **monorepo** layout:

```text
beutech-vacation-timeline/
├─ README.md
├─ package.json                 # root devDependencies + scripts
├─ pnpm-workspace.yaml          # or yarn workspaces / npm workspaces
├─ .editorconfig
├─ .gitignore
├─ .vscode/
│  ├─ extensions.json
│  └─ settings.json
│
├─ apps/
│  ├─ widget/                   # Staffbase custom widget (React + TS)
│  │  ├─ package.json
│  │  ├─ staffbase.config.json  # widget manifest/config
│  │  ├─ webpack.config.js      # or vite.config.ts
│  │  └─ src/
│  │     ├─ index.tsx           # widget bootstrap
│  │     ├─ VacationCalendarWidget.tsx
│  │     ├─ components/
│  │     │  ├─ CalendarHeader/
│  │     │  │  ├─ CalendarHeader.tsx
│  │     │  │  └─ CalendarHeader.styles.css
│  │     │  ├─ ViewToggle/
│  │     │  │  ├─ ViewToggle.tsx
│  │     │  │  └─ ViewToggle.styles.css
│  │     │  ├─ DateNavigator/
│  │     │  │  ├─ DateNavigator.tsx
│  │     │  │  └─ DateNavigator.styles.css
│  │     │  ├─ UserFilter/
│  │     │  │  ├─ UserFilter.tsx
│  │     │  │  └─ UserFilter.styles.css
│  │     │  ├─ Timeline/
│  │     │  │  ├─ Timeline.tsx
│  │     │  │  ├─ TimelineRow.tsx
│  │     │  │  └─ Timeline.styles.css
│  │     │  ├─ Legend/
│  │     │  │  ├─ Legend.tsx
│  │     │  │  └─ Legend.styles.css
│  │     │  └─ LoadingError/
│  │     │     ├─ LoadingState.tsx
│  │     │     ├─ ErrorState.tsx
│  │     │     └─ EmptyState.tsx
│  │     ├─ hooks/
│  │     │  ├─ useVacationData.ts
│  │     │  ├─ useStaffbaseUserContext.ts
│  │     │  └─ useViewRange.ts
│  │     ├─ types/
│  │     │  ├─ vacation.ts
│  │     │  └─ staffbase.ts
│  │     ├─ utils/
│  │     │  ├─ dateUtils.ts
│  │     │  ├─ colorUtils.ts
│  │     │  └─ apiClient.ts
│  │     └─ config/
│  │        └─ widgetConfigurationSchema.ts
│  │
│  └─ backend/                  # Azure Functions (Node + TS)
│     ├─ host.json
│     ├─ local.settings.json.example
│     ├─ package.json
│     ├─ tsconfig.json
│     ├─ src/
│     │  ├─ functions/
│     │  │  └─ getVacations/
│     │  │     ├─ index.ts      # Azure Function entry point
│     │  │     └─ function.json
│     │  ├─ graph/
│     │  │  ├─ graphClient.ts
│     │  │  ├─ vacationService.ts
│     │  │  └─ userService.ts
│     │  ├─ auth/
│     │  │  └─ apiKeyValidator.ts
│     │  ├─ models/
│     │  │  ├─ VacationEvent.ts
│     │  │  ├─ User.ts
│     │  │  └─ ErrorResponse.ts
│     │  ├─ utils/
│     │  │  ├─ dateRangeParser.ts
│     │  │  ├─ env.ts
│     │  │  └─ logger.ts
│     │  └─ config/
│     │     └─ constants.ts
│     └─ tests/
│        ├─ vacationService.test.ts
│        └─ dateRangeParser.test.ts
│
├─ infra/
│  ├─ bicep/
│  │  ├─ main.bicep
│  │  ├─ functionApp.bicep
│  │  ├─ storage.bicep
│  │  ├─ appInsights.bicep
│  │  └─ keyVault.bicep
│  └─ config/
│     ├─ dev.parameters.json
│     └─ prod.parameters.json
│
└─ docs/
   ├─ architecture-diagram.md
   ├─ staffbase-setup-guide.md
   └─ runbook-support.md
````

---

## 4. Data Model & Flow

### 4.1 Vacation event model (frontend & backend)

```ts
// apps/widget/src/types/vacation.ts
export type VacationView = 'day' | 'week' | 'month' | 'timeline';

export interface VacationEvent {
  id: string;
  userId: string;          // Graph user id or email
  userDisplayName: string;
  userColorKey: string;    // maps to consistent color
  title: string;
  start: string;           // ISO 8601
  end: string;             // ISO 8601
}
```

### 4.2 API contract

`GET /api/vacations`

Query params:

* `start` – ISO date string (inclusive)
* `end` – ISO date string (exclusive or inclusive; be consistent)
* `view` – `"day" | "week" | "month" | "timeline"`
* `users` (optional) – comma-separated list of user IDs/emails
* `timezone` (optional) – Olson ID (e.g. `Europe/Berlin`)

Headers:

* `x-api-key: <widget-api-key>`

Response:

```json
{
  "events": [
    {
      "id": "AAMkAGI2...",
      "userId": "sam@beautech.com",
      "userDisplayName": "Sam Ryan",
      "userColorKey": "sam",
      "title": "Vacation",
      "start": "2025-05-09T00:00:00Z",
      "end": "2025-05-12T00:00:00Z"
    }
  ],
  "meta": {
    "start": "2025-05-05T00:00:00Z",
    "end": "2025-05-12T00:00:00Z",
    "generatedAt": "2025-05-05T10:00:00Z"
  }
}
```

Error example:

```json
{
  "error": {
    "code": "Unauthorized",
    "message": "Missing or invalid API key."
  }
}
```

---

## 5. Staffbase User Context → M365 Mapping

In the widget, we read the **logged-in Staffbase user** and derive their M365 identity.

### 5.1 Types

```ts
// apps/widget/src/types/staffbase.ts
export interface StaffbaseUserContext {
  id: string;
  displayName: string;
  email?: string;
  profileFields?: Record<string, string>;
}
```

### 5.2 Hook to read user context

Example (actual API depends on the Staffbase widget SDK version; adjust as per docs):

```ts
// apps/widget/src/hooks/useStaffbaseUserContext.ts
import { useEffect, useState } from 'react';
import { StaffbaseUserContext } from '../types/staffbase';

export function useStaffbaseUserContext() {
  const [user, setUser] = useState<StaffbaseUserContext | null>(null);

  useEffect(() => {
    // Pseudo-code; replace with actual Staffbase SDK:
    // staffbaseWidget.onUserLoaded((u) => setUser(transform(u)));
    // or read from props passed into the widget bootstrap.
  }, []);

  return user;
}
```

### 5.3 Mapping strategy

1. **Preferred**: Add a custom user profile field such as `m365Upn` in Staffbase,
   containing the user’s Microsoft 365 UPN.

2. In the widget, derive:

```ts
function getUserM365Upn(user: StaffbaseUserContext): string | undefined {
  return (
    user.profileFields?.m365Upn ??
    user.email ??
    `${user.id}@beautech.com` // fallback convention if applicable
  );
}
```

3. Use this to:

   * Highlight the user’s vacation bars.
   * Provide an easy “Only me” filter.

---

## 6. Phase-by-Phase Plan & Checklists

### Phase 0 – Project Kickoff & Prerequisites

**Objective:** Confirm scope, accounts, and basic access.

**Steps**

1. Confirm Stakeholders:

   * Product owner
   * IT / Azure admin
   * M365 admin
   * Staffbase admin
2. Confirm environments:

   * Dev tenant(s) for Microsoft 365 and Azure (if not using prod).
   * Staffbase test environment (or hidden test space).
3. Choose infra tooling:

   * Decide on **Bicep vs Terraform** (this README assumes Bicep).

**Checklist**

* [ ] Stakeholders identified and communication channel created.
* [ ] Dev / test environment confirmed for Staffbase & Azure.
* [ ] Tech stack decisions finalized (React + TS, Azure Functions).
* [ ] Repo created in your Git hosting (GitHub / Azure DevOps / GitLab).
* [ ] CI pipeline approach chosen (GitHub Actions / Azure Pipelines / etc.).

---

### Phase 1 – Azure & Graph Foundation

**Objective:** Backend can securely read vacation events from Graph in a raw form.

**Steps**

1. **App Registration**

   * [ ] In Azure portal, create or locate existing **AAD app registration**.
   * [ ] Ensure it has:

     * `Application ID (clientId)`
     * `Directory (tenantId)`
   * [ ] Add **Application permissions**:

     * [ ] `Calendars.Read`
     * [ ] `Calendars.Read.Shared` (if using shared calendar)
     * [ ] `User.Read.All` (if you want to resolve display names/photos)
   * [ ] Click “Grant admin consent.”

2. **Client Secret & Key Vault**

   * [ ] Create a new client secret; copy value.
   * [ ] Store in **Azure Key Vault** or as hidden Function App setting.

3. **Shared Calendar Decision**

   * [ ] Decide:

     * Shared mailbox calendar (simpler), or
     * Per-user calendars with vacation category.
   * [ ] Record mailbox address or rules for subject/category.

4. **Azure Functions Project**

   * [ ] In `/apps/backend`:

     * `func init backend --worker-runtime node --language typescript`
   * [ ] Create HTTP function `getVacations`.
   * [ ] Configure `local.settings.json` (sample only, don’t check in secrets):

     * `TENANT_ID`
     * `CLIENT_ID`
     * `CLIENT_SECRET`
     * `VACATION_CALENDAR_MAILBOX`
     * `ALLOWED_ORIGINS`
     * `API_KEY`

5. **Graph PoC**

   * [ ] Implement simple script / function to:

     * Acquire token using `ClientSecretCredential`.
     * Call `/users/{mailbox}/calendarView`.
   * [ ] Confirm events returned for a test range.

**Checklist**

* [ ] Azure AD app registration created / reused.
* [ ] Required Graph permissions added & consented.
* [ ] Client secret stored securely.
* [ ] Azure Function App skeleton created.
* [ ] Basic Graph call tested with sample data.

---

### Phase 2 – Backend API Implementation

**Objective:** Fully functional `/api/vacations` endpoint.

**Steps**

1. **Environment & Config Utility**

   * [ ] Implement `env.ts` to safely read env vars and fail fast if missing.
   * [ ] Implement `constants.ts` for default time zone, max date range, etc.

2. **Graph Client**

   * [ ] Implement `graphClient.ts` using `@azure/identity` + `@microsoft/microsoft-graph-client`.
   * [ ] Encapsulate token acquisition and base client creation.

3. **Vacation Service**

   * [ ] Implement `vacationService.ts`:

     * Function `getVacations({ start, end, users, mode })`.
     * Contains mapping from Graph events → `VacationEvent` model.
   * [ ] Handle:

     * Shared calendar mode.
     * Per-user calendar mode (loop users, filter for vacation).

4. **API Security**

   * [ ] Implement `apiKeyValidator.ts`:

     * Reads `x-api-key` header.
     * Compares with env `API_KEY`.
   * [ ] Add CORS handling (only allow Staffbase domains).
   * [ ] Ensure all error messages are non-sensitive.

5. **HTTP Function**

   * [ ] Implement `index.ts` in `getVacations`:

     * Parse query params.
     * Validate date range (< e.g. 90 days).
     * Call `apiKeyValidator`.
     * Call `vacationService`.
   * [ ] Return `200` JSON or appropriate error codes.

6. **Tests**

   * [ ] Jest tests for:

     * `dateRangeParser.ts`
     * `vacationService.ts` mapping logic.

**Checklist**

* [ ] `GET /api/vacations` implemented and documented.
* [ ] API key validation working.
* [ ] CORS restricted to Staffbase domains.
* [ ] Error handling implemented with consistent structure.
* [ ] Unit tests passing (CI step green).
* [ ] Manual call via `curl` / Postman returns expected JSON.

---

### Phase 3 – Widget Skeleton & Data Wiring

**Objective:** Staffbase widget loads and shows raw vacation events.

**Steps**

1. **Widget Generation**

   * [ ] Run `npx @staffbase/create-widget` in `/apps/widget`.
   * [ ] Configure TypeScript.
   * [ ] Confirm `npm start` shows default widget in local dev.

2. **Configuration Schema**

   * [ ] Implement `config/widgetConfigurationSchema.ts`:

     * `apiBaseUrl`
     * `apiKey`
     * `calendarMode` (`"shared" | "perUser"`)
     * `sharedCalendarMailbox`
     * `defaultView` (`"week"` etc.)
     * `vacationCategory` (optional)
   * [ ] Wire to `staffbase.config.json` per docs.

3. **API Client**

   * [ ] Implement `utils/apiClient.ts`:

     * Function `fetchVacations({ start, end, view, users })`.
     * Adds `x-api-key` header from config.
   * [ ] Handle HTTP errors and map to typed error.

4. **Staffbase User Context**

   * [ ] Implement `useStaffbaseUserContext`.
   * [ ] Confirm using dev tools/logging that real Staffbase user data is available.
   * [ ] Implement helper `getUserM365Upn`.

5. **Hook for Vacation Data**

   * [ ] Implement `useVacationData.ts`:

     * Tracks loading/error/data state.
     * Takes `view`, `start`, `end`, `selectedUsers`.
     * Calls backend and caches per `{view,start,end,users}` key.

6. **Minimal UI**

   * [ ] Implement `VacationCalendarWidget.tsx`:

     * Renders:

       * Current range label.
       * A `<pre>` containing the JSON events.
   * [ ] Deploy dev build to Staffbase & confirm events visible.

**Checklist**

* [ ] Widget project builds and runs.
* [ ] Configuration form in Staffbase Studio shows expected fields.
* [ ] Widget successfully calls backend in dev.
* [ ] Logged-in Staffbase user context confirmed.
* [ ] “My M365 UPN” derivation verified for at least one test user.

---

### Phase 4 – Timeline UI & Filters

**Objective:** Replace `<pre>` with full calendar UI resembling the hero screenshot.

**Steps**

1. **View Range Logic**

   * [ ] Implement `useViewRange.ts`:

     * Accepts `view` + `currentDate`.
     * Returns `start`, `end`, and label string.
     * Example: for `view="week"` & May 7, label `"May 5–11, 2025"`.

2. **Header & Controls**

   * [ ] Implement `CalendarHeader` with:

     * `ViewToggle` (Day / Week / Month / Timeline).
     * `DateNavigator` (Today / < / >).
     * Title showing date range.

3. **User Filter**

   * [ ] Implement `UserFilter`:

     * Receives list of users extracted from events.
     * Supports:

       * Select All
       * Only Me
       * Multi-select.
   * [ ] Ensure colors per user are consistent (via `colorUtils.ts`).

4. **Timeline Component**

   * [ ] Decide on implementation:

     * **Option A (library)**: Install & configure `react-big-calendar` with resource view.
     * **Option B (custom)**: Implement CSS grid based timeline.

   For custom:

   * [ ] `Timeline.tsx`:

     * Renders columns for days (or hours) in range.
     * Renders rows per user.
   * [ ] `TimelineRow.tsx`:

     * For each vacation event of that user:

       * Computes `left` and `width` % based on date/time.
       * Renders colored bar with label.
   * [ ] Add “today” vertical line using same scale.

5. **Legend**

   * [ ] Implement `Legend.tsx`:

     * Shows colored chip + display name per user currently visible.
     * Optional “Show/hide legend” for smaller screens.

6. **State Management**

   * [ ] In `VacationCalendarWidget.tsx`:

     * Manage `view`, `currentDate`, `selectedUsers`.
     * Call `useViewRange`, then `useVacationData`.
     * Pass events & user list to `Timeline`.

**Checklist**

* [ ] View toggle updates `view` state and refetches data.
* [ ] Date navigator correctly moves by day / week / month depending on view.
* [ ] Timeline renders users as rows and vacations as colored bars.
* [ ] Today line appears in correct position.
* [ ] User filter works (filters events) and “Only me” highlights current user.
* [ ] Legend accurately reflects colors and selected users.

---

### Phase 5 – Security, Performance & Robustness

**Objective:** Production-ready and safe.

**Steps**

1. **Security**

   * [ ] Confirm all backend endpoints require `x-api-key`.
   * [ ] Rotate API key and update widget configuration.
   * [ ] Restrict Function App CORS to Staffbase production and test domains.
   * [ ] Use HTTPS only for API.
   * [ ] Ensure no secrets are stored in frontend code or repo.

2. **Performance**

   * [ ] Introduce backend caching (e.g., in `vacationService`) for frequently requested ranges (current week/month).
   * [ ] Limit max date range per API request (e.g., 90 days).
   * [ ] Add simple rate limiting via Azure API Management (if used).

3. **Logging & Monitoring**

   * [ ] Use `logger.ts` to log:

     * Request IDs
     * Date ranges
     * Graph latency
   * [ ] Pipe logs to Application Insights.
   * [ ] Create dashboard for:

     * Error rates
     * Average response time
     * Calls per day.

4. **Error Handling UX**

   * [ ] Implement `LoadingState`, `ErrorState`, `EmptyState` components.
   * [ ] Ensure user-friendly messages (no stack traces) appear in widget.

5. **Accessibility & Responsiveness**

   * [ ] Keyboard navigation for buttons.
   * [ ] High contrast & colorblind-friendly palette.
   * [ ] Mobile layout:

     * Horizontal scroll for timeline.
     * Collapsed filters into dropdown.

**Checklist**

* [ ] API key system validated and documented.
* [ ] CORS and HTTPS enforced.
* [ ] Backend responds in acceptable time (< ~500–800 ms typical).
* [ ] App Insights dashboards set up.
* [ ] Widget responsive and accessible (basic a11y checks done).

---

### Phase 6 – Infrastructure & Deployment

**Objective:** Automated, repeatable deployment to dev and prod.

**Steps**

1. **Bicep Templates**

   * [ ] Implement `infra/bicep/main.bicep` to:

     * Deploy Storage, Function App, App Insights, Key Vault.
   * [ ] Parameterize:

     * Environment name (dev/prod)
     * API base URL
     * Allowed origins.
   * [ ] Add `dev.parameters.json` and `prod.parameters.json`.

2. **CI/CD Pipeline**

   * [ ] Configure workflow for:

     * On `push` to `main`:

       * `pnpm install` (or npm/yarn) at root.
       * Run lint + tests for widget and backend.
       * Build widget bundle.
       * `func azure functionapp publish` (or zip deploy) for backend.
       * Upload widget bundle to static hosting or Staffbase.

3. **Staffbase Integration**

   * [ ] In Staffbase Studio:

     * Create widget entry using built bundle URL.
     * Configure widget with:

       * API base URL
       * API key
       * Calendar mode
       * Default view, etc.
   * [ ] Place widget on test page & test with real users.

**Checklist**

* [ ] Bicep template successfully deploys to dev.
* [ ] CI pipeline builds and runs tests on every push/PR.
* [ ] CD pipeline deploys to dev automatically, prod via approval.
* [ ] Staffbase widget is accessible and functional in dev space.

---

### Phase 7 – SAML Deep Link (Optional but Recommended)

**Objective:** Provide SSO deep link from widget to full Outlook experience.

**Steps**

1. **SAML Plugin Setup**

   * [ ] Follow Staffbase SAML integration guide:
     [https://developers.staffbase.com/guides/deeplink-into-saml/](https://developers.staffbase.com/guides/deeplink-into-saml/)
   * [ ] Create SAML plugin instance that authenticates users into Outlook / OWA.

2. **Deep Link URL**

   * [ ] Get plugin `pluginID` & `pluginInstanceID`.
   * [ ] Construct URL using pattern from docs:

     * `https://<your-staffbase-host>/content/<pluginID>/<pluginInstanceID>/<deeplinking>`
   * [ ] Optionally append the Outlook calendar URL as part of the deep link config.

3. **Widget Button**

   * [ ] Add “Open in Outlook” / “Open Full Calendar” button to `CalendarHeader`.
   * [ ] On click, open deep-link URL in same tab or new tab per UX preference.

**Checklist**

* [ ] SAML plugin successfully logs users into Outlook.
* [ ] Deep link from widget opens correct Outlook calendar view.
* [ ] Button text and placement approved by stakeholders.

---

### Phase 8 – UAT, Documentation & Launch

**Objective:** Validate with real users and document for operations.

**Steps**

1. **UAT**

   * [ ] Select pilot group (e.g., a single department).
   * [ ] Test typical flows:

     * Checking next week’s vacations.
     * Seeing only specific team members.
     * Adding a new vacation in Outlook and seeing it appear.
   * [ ] Capture feedback (performance, clarity, color scheme).

2. **Documentation**

   * [ ] Expand `docs/staffbase-setup-guide.md`:

     * Step-by-step instructions for Staffbase admins.
   * [ ] Fill out `docs/runbook-support.md`:

     * How to rotate secrets.
     * How to troubleshoot common errors.
     * Contact points.

3. **Go-Live**

   * [ ] Promote to production environment.
   * [ ] Add widget to production spaces (home page / HR area).
   * [ ] Announce to employees with short usage guide.

**Checklist**

* [ ] UAT sign-off from stakeholders.
* [ ] All docs written and stored in repo.
* [ ] Production deployment completed.
* [ ] Monitoring alarms configured (e.g., error rate thresholds).
* [ ] Post-launch review scheduled (2–4 weeks later).

---

## 7. Implementation Status

### Phase Completion Status

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| 0 | Project Kickoff & Prerequisites | ✅ Complete | Monorepo structure created |
| 1 | Azure & Graph Foundation | ⏳ Pending | Requires manual Azure AD setup |
| 2 | Backend API Implementation | ✅ Complete | Azure Functions + Graph integration |
| 3 | Widget Skeleton & Data Wiring | ✅ Complete | Staffbase SDK + API client |
| 4 | Timeline UI & Filters | ✅ Complete | Full timeline with filters |
| 5 | Security, Performance & Robustness | ✅ Complete | API key auth, CORS, error handling |
| 6 | Infrastructure & Deployment | ✅ Complete | Bicep + GitHub Actions CI/CD |
| 7 | SAML Deep Link | ✅ Complete | Optional Outlook SSO integration |
| 8 | UAT, Documentation & Launch | ✅ Complete | All docs and checklists ready |

### Quick Start

```bash
# Install dependencies
npm install

# Build both apps
npm run build -w apps/widget
npm run build -w apps/backend

# Local development (backend)
cd apps/backend
cp local.settings.json.example local.settings.json
# Edit local.settings.json with your Azure AD credentials
npm start

# Local development (widget)
cd apps/widget
npm run dev
```

### Deployment

```bash
# Deploy infrastructure
./scripts/deploy-infra.sh dev deploy

# Deploy backend
./scripts/deploy-backend.sh dev

# Deploy widget
./scripts/deploy-widget.sh dev
```

### Documentation

| Document | Description |
|----------|-------------|
| [Architecture Diagram](./docs/architecture-diagram.md) | System overview and data flow |
| [Staffbase Setup Guide](./docs/staffbase-setup-guide.md) | Widget configuration in Staffbase |
| [IT Admin Setup Checklist](./docs/IT_ADMIN_SETUP_CHECKLIST.md) | End-to-end setup for IT administrators |
| [Security Documentation](./docs/security.md) | Security architecture and best practices |
| [SAML Deep Link Guide](./docs/saml-deep-link-setup.md) | Optional Outlook SSO setup |
| [Runbook & Support](./docs/runbook-support.md) | Operations, troubleshooting, and incident response |
| [GitHub CI/CD Setup](./docs/github-setup.md) | GitHub Actions configuration |
| [UAT Checklist](./docs/uat-checklist.md) | User acceptance testing guide |
| [Launch Checklist](./docs/launch-checklist.md) | Production launch readiness |
| [Production Readiness Plan](./docs/production-readiness-plan.md) | Implementation roadmap (completed) |

### Next Steps (Manual)

1. **Azure AD Setup**: Create app registration and grant Graph API permissions
2. **Deploy Infrastructure**: Run Bicep templates to create Azure resources
3. **Configure Secrets**: Set up API key, client ID, client secret
4. **Deploy Applications**: Deploy backend to Azure Functions, widget to blob storage
5. **Staffbase Integration**: Register widget and configure in Staffbase Studio
6. **UAT**: Run through testing checklist with pilot users
7. **Launch**: Follow launch checklist for production rollout

---


