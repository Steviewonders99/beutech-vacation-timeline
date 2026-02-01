# SAML Deep Link Setup Guide

This guide explains how to configure the "Open in Outlook" button that provides Single Sign-On (SSO) access to the full Outlook calendar.

## Overview

The SAML deep link feature allows users to click a button in the widget and be seamlessly authenticated into Outlook Web Access (OWA) using their Staffbase SSO credentials. This is achieved through Staffbase's SAML plugin functionality.

## Prerequisites

1. Staffbase Enterprise license with SAML plugin capability
2. Azure AD configured as identity provider for both Staffbase and Microsoft 365
3. Admin access to Staffbase Studio

## Step 1: Create SAML Plugin in Staffbase

1. Log in to **Staffbase Studio** as an admin

2. Navigate to **Settings** → **Plugins & Extensions** → **SAML Plugins**

3. Click **Add SAML Plugin**

4. Configure the plugin:

   | Field | Value |
   |-------|-------|
   | **Name** | Outlook Calendar SSO |
   | **Target URL** | `https://outlook.office.com/calendar` |
   | **Entity ID** | (From your Microsoft 365 SAML config) |
   | **SSO URL** | (From your Microsoft 365 SAML config) |

5. Save the plugin and note down:
   - **Plugin ID** (shown in URL or settings)
   - **Plugin Instance ID** (shown after creation)

## Step 2: Configure Azure AD (If Not Already Done)

If you haven't already configured SAML SSO between Staffbase and Microsoft 365:

1. In **Azure Portal**, navigate to **Enterprise Applications**

2. Find or create an application for Staffbase SAML

3. Configure SAML settings:
   - **Identifier (Entity ID)**: Your Staffbase entity ID
   - **Reply URL**: Your Staffbase ACS URL
   - **Sign-on URL**: Your Staffbase login URL

4. Download the **Federation Metadata XML** or note the:
   - **Login URL** (SSO URL)
   - **Azure AD Identifier** (Entity ID)
   - **Certificate** (Base64)

5. Configure Staffbase with these Azure AD SAML details

## Step 3: Configure Widget in Staffbase Studio

1. Navigate to the page with the Vacation Timeline widget

2. Edit the widget configuration

3. Enable and configure SAML deep link settings:

   | Setting | Description | Example |
   |---------|-------------|---------|
   | **Enable 'Open in Outlook' Button** | Check to enable | ✓ |
   | **Staffbase Host** | Your Staffbase domain | `company.staffbase.com` |
   | **SAML Plugin ID** | From Step 1 | `outlook-calendar-sso` |
   | **SAML Plugin Instance ID** | From Step 1 | `abc123xyz` |
   | **Outlook Calendar URL** | (Optional) Custom URL | `https://outlook.office.com/calendar` |

4. Save the configuration

## Step 4: Test the Integration

1. Preview the page or open it in the Staffbase app

2. Verify the "Open in Outlook" button appears in the header

3. Click the button and confirm:
   - You're authenticated via SSO (no separate login)
   - Outlook calendar opens correctly

## How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Deep Link Flow                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User clicks "Open in Outlook" button                                │
│                     │                                                    │
│                     ▼                                                    │
│  2. Widget opens deep link URL:                                         │
│     https://{staffbaseHost}/content/{pluginId}/{instanceId}/deeplinking │
│     ?target=https://outlook.office.com/calendar                         │
│                     │                                                    │
│                     ▼                                                    │
│  3. Staffbase authenticates user via SAML assertion                     │
│                     │                                                    │
│                     ▼                                                    │
│  4. User redirected to Outlook with active session                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## URL Format Reference

The deep link URL follows this format:

```
https://{staffbaseHost}/content/{pluginId}/{pluginInstanceId}/deeplinking?target={encodedTargetUrl}
```

Where:
- `{staffbaseHost}` - Your Staffbase domain (e.g., `company.staffbase.com`)
- `{pluginId}` - The SAML plugin identifier
- `{pluginInstanceId}` - The specific instance ID
- `{encodedTargetUrl}` - URL-encoded target (e.g., `https%3A%2F%2Foutlook.office.com%2Fcalendar`)

## Troubleshooting

### Button Doesn't Appear

- Verify "Enable 'Open in Outlook' Button" is checked
- Confirm all three required fields are filled:
  - Staffbase Host
  - SAML Plugin ID
  - SAML Plugin Instance ID

### "Invalid Plugin" Error

- Verify the Plugin ID matches exactly (case-sensitive)
- Confirm the SAML plugin is active in Staffbase

### SSO Fails / Login Prompt Appears

- Check Azure AD SAML configuration
- Verify the user has accounts in both Staffbase and Microsoft 365
- Ensure SAML plugin is properly configured in Staffbase

### Wrong Calendar Opens

- Verify the Outlook Calendar URL setting
- Default is `https://outlook.office.com/calendar`
- For on-premises Exchange, use your OWA URL

## Security Considerations

1. **HTTPS Only**: All URLs must use HTTPS
2. **Same Identity Provider**: Users must authenticate through the same identity provider for both Staffbase and Microsoft 365
3. **Session Security**: SAML assertions are time-limited and cannot be replayed

## References

- [Staffbase SAML Deep Link Guide](https://developers.staffbase.com/guides/deeplink-into-saml/)
- [Azure AD SAML Configuration](https://learn.microsoft.com/en-us/azure/active-directory/manage-apps/configure-saml-single-sign-on)
- [Outlook Web Access URLs](https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/outlook-on-the-web/outlook-on-the-web)
