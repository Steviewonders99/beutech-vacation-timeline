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

import { BlockAttributes } from "widget-sdk";
import { VacationView } from "./vacation";

/**
 * Widget configuration passed from Staffbase Studio.
 * These values are set by admins when configuring the widget.
 * Matches the configurationSchema in configuration-schema.ts
 */
export interface WidgetConfiguration extends BlockAttributes {
  /** Base URL of the Azure Functions backend */
  apiBaseUrl: string;
  /** API key for authenticating with the backend */
  apiKey: string;
  /** Whether to use shared calendar or per-user calendars */
  calendarMode: 'shared' | 'perUser';
  /** Email of the shared vacation calendar mailbox (if using shared mode) */
  sharedCalendarMailbox?: string;
  /** Default view when widget loads */
  defaultView: VacationView;
  /** Enable dark mode styling */
  darkMode?: boolean;
  /** Outlook category name for vacation events (if using perUser mode) */
  vacationCategory?: string;
  /** Maximum number of users to display */
  maxUsers?: number;
  /** Domain to use when constructing M365 UPN from Staffbase user ID */
  m365FallbackDomain?: string;

  // SAML Deep Link settings (optional)
  /** Enable the "Open in Outlook" button */
  enableOutlookDeepLink?: boolean;
  /** Staffbase host for deep link URL (e.g., "company.staffbase.com") */
  staffbaseHost?: string;
  /** SAML plugin ID for Outlook SSO */
  samlPluginId?: string;
  /** SAML plugin instance ID */
  samlPluginInstanceId?: string;
  /** Custom Outlook calendar URL (defaults to OWA calendar) */
  outlookCalendarUrl?: string;
}

/**
 * Production configuration for Beautech deployment.
 * These values are used when Staffbase Studio config is not available.
 *
 * SECURITY: No API key needed - backend authenticates via trusted origin (CORS).
 * Requests from team.beautech.aero are automatically trusted.
 */
export const PRODUCTION_CONFIG = {
  apiBaseUrl: 'https://vacation-timeline-fgcmcrc0c5ezfuf5.centralus-01.azurewebsites.net',
  // API key not needed - origin-based auth is used
  sharedCalendarMailbox: 'vacations@beautech.aero',
  m365FallbackDomain: 'beautech.aero',
};

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: Partial<WidgetConfiguration> = {
  // Use production values as defaults
  apiBaseUrl: PRODUCTION_CONFIG.apiBaseUrl,
  sharedCalendarMailbox: PRODUCTION_CONFIG.sharedCalendarMailbox,
  m365FallbackDomain: PRODUCTION_CONFIG.m365FallbackDomain,
  // Other defaults
  calendarMode: 'shared',
  defaultView: 'week',
  darkMode: false,
  vacationCategory: 'Leave Request',
  maxUsers: 20,
  enableOutlookDeepLink: false,
  outlookCalendarUrl: 'https://outlook.office.com/calendar',
};

/**
 * Merge provided configuration with defaults.
 */
export function getConfigWithDefaults(config: Partial<WidgetConfiguration>): WidgetConfiguration {
  return {
    ...DEFAULT_CONFIG,
    ...config,
  } as WidgetConfiguration;
}
