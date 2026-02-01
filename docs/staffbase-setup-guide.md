# Staffbase Setup Guide

This guide walks you through setting up the Vacation Timeline widget in Staffbase Studio.

## Prerequisites

Before you begin, ensure you have:

1. **Backend Deployed**: The Azure Functions backend is deployed and accessible
2. **API Key**: You have the API key for the backend
3. **Admin Access**: You have admin access to Staffbase Studio
4. **Widget Bundle**: The built widget bundle is hosted (e.g., on Azure Storage or CDN)

## Step 1: Upload Widget Bundle

1. Build the widget:
   ```bash
   cd apps/widget
   npm install
   npm run build
   ```

2. Upload the generated `dist/beutech.vacation-timeline.js` file to a publicly accessible location:
   - Azure Blob Storage with public read access
   - Your CDN
   - Any static file hosting

3. Note the URL where the bundle is hosted (e.g., `https://yourcdn.com/widgets/beutech.vacation-timeline.js`)

## Step 2: Register Custom Widget in Staffbase

1. Log in to **Staffbase Studio** as an admin

2. Navigate to **Settings** → **Custom Widgets** (or **Extensions** depending on your Staffbase version)

3. Click **Add Custom Widget**

4. Fill in the registration form:
   - **Name**: Vacation Timeline
   - **Description**: Multi-user vacation timeline widget
   - **Widget URL**: The URL from Step 1
   - **Icon**: Upload a 32x32 PNG/SVG icon (optional)

5. Click **Save**

## Step 3: Configure Widget Instance

1. Navigate to a page where you want to add the widget

2. In the page editor, click **Add Widget** → **Custom Widgets** → **Vacation Timeline**

3. The configuration panel will appear with these settings:

### Required Settings

| Setting | Description | Example |
|---------|-------------|---------|
| **API Base URL** | Full URL of your Azure Functions backend | `https://func-vacationtimeline-prod.azurewebsites.net` |
| **API Key** | The API key for authentication | `your-secure-api-key` |

### Calendar Settings

| Setting | Description | Options |
|---------|-------------|---------|
| **Calendar Mode** | How to fetch vacation data | `shared` or `perUser` |
| **Shared Calendar Mailbox** | Email of shared calendar (if mode=shared) | `vacations@company.com` |
| **Vacation Category** | Outlook category name (if mode=perUser) | `Vacation` |

### Display Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Default View** | Initial calendar view | `week` |
| **Max Users** | Maximum users to display | `20` |
| **M365 Fallback Domain** | Domain for UPN construction | `company.com` |

4. Click **Save** to apply the configuration

## Step 4: Verify User Context Integration

The widget automatically reads the logged-in Staffbase user's context to:
- Highlight "my vacations" in the timeline
- Enable the "Only Me" filter

For this to work correctly:

### Option A: Email-Based Mapping (Recommended)
Ensure users have their email address set in Staffbase, and that email matches their Microsoft 365 UPN.

### Option B: Custom Profile Field
1. In Staffbase Admin, create a custom user profile field called `m365Upn`
2. Populate this field with each user's Microsoft 365 UPN
3. The widget will read from `profileFields.m365Upn`

### Option C: Fallback Domain
Configure **M365 Fallback Domain** in the widget settings. The widget will construct UPNs as `{staffbaseUserId}@{domain}`.

## Step 5: Test the Widget

1. Preview the page or open it in the Staffbase app

2. Verify:
   - [ ] Widget loads without errors
   - [ ] Vacation events appear in the timeline
   - [ ] View toggle (Day/Week/Month/Timeline) works
   - [ ] Date navigation (Today, Previous, Next) works
   - [ ] User filter shows available users
   - [ ] "Only Me" filter highlights your vacations
   - [ ] Colors are consistent per user

3. If you see errors, check:
   - API Base URL is correct and accessible
   - API Key matches the backend configuration
   - CORS is configured to allow your Staffbase domain

## Troubleshooting

### "Widget configuration is incomplete"
The API Base URL or API Key is missing. Edit the widget configuration in Staffbase Studio.

### "Missing or invalid API key"
The API key doesn't match. Verify the key in both Staffbase Studio and Azure Function App settings.

### "Failed to fetch vacations"
Network or backend issue. Check:
- Backend is running (`curl https://your-func.azurewebsites.net/api/vacations`)
- CORS allows your Staffbase domain
- Graph API permissions are granted and consented

### "No vacations scheduled"
Normal if there are no events in the selected date range. Try expanding the date range or adding test events to the calendar.

### User context not detected
- Ensure the page is viewed by a logged-in user (not in anonymous preview)
- Check that the user's email or profile field is correctly populated

## Security Notes

1. **API Key Protection**: The API key is stored in widget configuration, which is only visible to Staffbase admins

2. **CORS Restrictions**: In production, configure `ALLOWED_ORIGINS` in the backend to only allow your Staffbase domain

3. **HTTPS Only**: Ensure both the widget bundle and backend are served over HTTPS

## Next Steps

- Review the [Architecture Diagram](./architecture-diagram.md) to understand the data flow
- See the [Runbook](./runbook-support.md) for operational procedures
