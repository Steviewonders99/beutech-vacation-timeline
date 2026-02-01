/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { UiSchema } from "@rjsf/utils";
import { JSONSchema7 } from "json-schema";

/**
 * Configuration schema for the Vacation Timeline widget.
 * These settings are configured by admins in Staffbase Studio.
 * @see https://rjsf-team.github.io/react-jsonschema-form/docs/
 */
export const configurationSchema: JSONSchema7 = {
  type: "object",
  required: ["apiBaseUrl", "apiKey"],
  properties: {
    // ============================================
    // REQUIRED SETTINGS
    // ============================================
    apiBaseUrl: {
      type: "string",
      title: "🔗 Backend URL",
      description: "The web address where your vacation data is hosted",
      format: "uri",
    },
    apiKey: {
      type: "string",
      title: "🔑 Security Key",
      description: "Secret key to securely connect to your vacation data",
    },

    // ============================================
    // DISPLAY SETTINGS
    // ============================================
    darkMode: {
      type: "boolean",
      title: "🌙 Dark Mode",
      description: "Use dark colors for the widget background and text",
      default: false,
    },
    defaultView: {
      type: "string",
      title: "📅 Default View",
      description: "How the calendar looks when users first open it",
      enum: ["day", "week", "month"],
      enumNames: ["Day - Single day view", "Week - 7 day view (Recommended)", "Month - Full month grid"],
      default: "week",
    },
    maxUsers: {
      type: "integer",
      title: "👥 Team Size Limit",
      description: "Maximum number of team members to show at once",
      default: 20,
      minimum: 1,
      maximum: 100,
    },

    // ============================================
    // DATA SOURCE SETTINGS
    // ============================================
    calendarMode: {
      type: "string",
      title: "📊 Data Source",
      description: "Where vacation data comes from",
      enum: ["shared", "perUser"],
      enumNames: ["Shared Calendar - One team calendar for all vacations", "Individual Calendars - Each person's own calendar"],
      default: "shared",
    },
    sharedCalendarMailbox: {
      type: "string",
      title: "📧 Shared Calendar Email",
      description: "Email address of your team's shared vacation calendar",
      format: "email",
    },
    vacationCategory: {
      type: "string",
      title: "🏷️ Calendar Category",
      description: "The label used for vacation events in Outlook",
      default: "Vacation",
    },

    // ============================================
    // ADVANCED SETTINGS
    // ============================================
    m365FallbackDomain: {
      type: "string",
      title: "🌐 Email Domain",
      description: "Your company's email domain (e.g., company.com)",
    },
    enableOutlookDeepLink: {
      type: "boolean",
      title: "🔗 Show 'Open in Outlook' Button",
      description: "Add a button to open the full Outlook calendar",
      default: false,
    },
    staffbaseHost: {
      type: "string",
      title: "🏢 Staffbase Address",
      description: "Your Staffbase web address (e.g., company.staffbase.com)",
    },
    samlPluginId: {
      type: "string",
      title: "🔐 SSO Plugin ID",
      description: "Plugin ID from Staffbase Admin (for single sign-on)",
    },
    samlPluginInstanceId: {
      type: "string",
      title: "🔐 SSO Instance ID",
      description: "Instance ID from Staffbase Admin (for single sign-on)",
    },
    outlookCalendarUrl: {
      type: "string",
      title: "📅 Outlook Web Address",
      description: "Where to open Outlook calendar (usually leave as default)",
      format: "uri",
      default: "https://outlook.office.com/calendar",
    },
  },
};

/**
 * UI customization schema for the configuration form.
 * @see https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema
 */
export const uiSchema: UiSchema = {
  "ui:order": [
    // Required first
    "apiBaseUrl",
    "apiKey",
    // Display settings
    "darkMode",
    "defaultView",
    "maxUsers",
    // Data source
    "calendarMode",
    "sharedCalendarMailbox",
    "vacationCategory",
    // Advanced
    "m365FallbackDomain",
    "enableOutlookDeepLink",
    "staffbaseHost",
    "samlPluginId",
    "samlPluginInstanceId",
    "outlookCalendarUrl",
  ],
  apiBaseUrl: {
    "ui:placeholder": "https://your-company-api.azurewebsites.net",
    "ui:help": "Provided by your IT team during setup",
  },
  apiKey: {
    "ui:widget": "password",
    "ui:help": "Provided by your IT team - keep this private!",
  },
  darkMode: {
    "ui:widget": "checkbox",
    "ui:help": "Enable for a sleek dark appearance",
  },
  defaultView: {
    "ui:widget": "select",
    "ui:help": "Week view is recommended for most teams",
  },
  maxUsers: {
    "ui:widget": "updown",
    "ui:help": "20 is good for most teams, increase for larger departments",
  },
  calendarMode: {
    "ui:widget": "radio",
    "ui:help": "Choose 'Shared Calendar' if your team uses one calendar for all time-off",
  },
  sharedCalendarMailbox: {
    "ui:placeholder": "team-vacations@yourcompany.com",
    "ui:help": "Only needed if using 'Shared Calendar' mode above",
  },
  vacationCategory: {
    "ui:placeholder": "Vacation",
    "ui:help": "Only needed if using 'Individual Calendars' mode",
  },
  m365FallbackDomain: {
    "ui:placeholder": "yourcompany.com",
    "ui:help": "Your company's email domain - ask IT if unsure",
  },
  enableOutlookDeepLink: {
    "ui:widget": "checkbox",
    "ui:help": "Adds a button so users can jump to full Outlook",
  },
  staffbaseHost: {
    "ui:placeholder": "company.staffbase.com",
    "ui:help": "Only needed if 'Open in Outlook' button is enabled",
  },
  samlPluginId: {
    "ui:placeholder": "outlook-plugin",
    "ui:help": "Ask your IT admin for this ID",
  },
  samlPluginInstanceId: {
    "ui:placeholder": "abc123",
    "ui:help": "Ask your IT admin for this ID",
  },
  outlookCalendarUrl: {
    "ui:placeholder": "https://outlook.office.com/calendar",
    "ui:help": "Leave blank to use the default Outlook calendar",
  },
};
