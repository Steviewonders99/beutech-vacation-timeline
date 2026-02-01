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

import type { WidgetConfiguration } from '../types/config';

/**
 * Configuration for building SAML deep links.
 */
export interface DeepLinkConfig {
  staffbaseHost: string;
  pluginId: string;
  pluginInstanceId: string;
  targetUrl?: string;
}

/**
 * Build a Staffbase SAML deep link URL.
 *
 * The deep link format is:
 * https://{staffbaseHost}/content/{pluginId}/{pluginInstanceId}/deeplinking?target={encodedTargetUrl}
 *
 * @see https://developers.staffbase.com/guides/deeplink-into-saml/
 */
export function buildSamlDeepLink(config: DeepLinkConfig): string {
  const { staffbaseHost, pluginId, pluginInstanceId, targetUrl } = config;

  // Build base deep link URL
  let url = `https://${staffbaseHost}/content/${pluginId}/${pluginInstanceId}/deeplinking`;

  // Append target URL if provided
  if (targetUrl) {
    const encodedTarget = encodeURIComponent(targetUrl);
    url += `?target=${encodedTarget}`;
  }

  return url;
}

/**
 * Build an Outlook calendar deep link from widget configuration.
 * Returns null if deep linking is not properly configured.
 */
export function buildOutlookDeepLink(config: Partial<WidgetConfiguration>): string | null {
  const {
    enableOutlookDeepLink,
    staffbaseHost,
    samlPluginId,
    samlPluginInstanceId,
    outlookCalendarUrl,
  } = config;

  // Check if deep linking is enabled and configured
  if (!enableOutlookDeepLink) {
    return null;
  }

  if (!staffbaseHost || !samlPluginId || !samlPluginInstanceId) {
    console.warn(
      'Outlook deep link is enabled but not fully configured. ' +
      'Please set staffbaseHost, samlPluginId, and samlPluginInstanceId.'
    );
    return null;
  }

  return buildSamlDeepLink({
    staffbaseHost,
    pluginId: samlPluginId,
    pluginInstanceId: samlPluginInstanceId,
    targetUrl: outlookCalendarUrl || 'https://outlook.office.com/calendar',
  });
}

/**
 * Build a direct Outlook calendar URL (without SAML SSO).
 * This is a fallback when SAML is not configured but users still want
 * a quick link to their calendar.
 */
export function buildDirectOutlookUrl(date?: Date): string {
  const baseUrl = 'https://outlook.office.com/calendar';

  if (date) {
    // Format date as YYYY-MM-DD for OWA URL
    const dateStr = date.toISOString().split('T')[0];
    return `${baseUrl}/view/month/${dateStr}`;
  }

  return baseUrl;
}

/**
 * Opens a URL in a new browser tab/window.
 */
export function openInNewTab(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}
