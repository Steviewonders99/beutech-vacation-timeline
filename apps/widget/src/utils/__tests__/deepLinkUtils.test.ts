/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Tests for deepLinkUtils.
 */

import {
  buildSamlDeepLink,
  buildOutlookDeepLink,
  buildDirectOutlookUrl,
  DeepLinkConfig,
} from '../deepLinkUtils';

describe('buildSamlDeepLink', () => {
  it('should build basic deep link URL', () => {
    const config: DeepLinkConfig = {
      staffbaseHost: 'company.staffbase.com',
      pluginId: 'outlook-sso',
      pluginInstanceId: 'instance123',
    };

    const url = buildSamlDeepLink(config);

    expect(url).toBe(
      'https://company.staffbase.com/content/outlook-sso/instance123/deeplinking'
    );
  });

  it('should include encoded target URL when provided', () => {
    const config: DeepLinkConfig = {
      staffbaseHost: 'company.staffbase.com',
      pluginId: 'outlook-sso',
      pluginInstanceId: 'instance123',
      targetUrl: 'https://outlook.office.com/calendar',
    };

    const url = buildSamlDeepLink(config);

    expect(url).toContain('deeplinking?target=');
    expect(url).toContain(encodeURIComponent('https://outlook.office.com/calendar'));
  });

  it('should handle target URL with special characters', () => {
    const config: DeepLinkConfig = {
      staffbaseHost: 'company.staffbase.com',
      pluginId: 'plugin',
      pluginInstanceId: 'instance',
      targetUrl: 'https://outlook.office.com/calendar?date=2025-01-01&view=month',
    };

    const url = buildSamlDeepLink(config);

    // URL should be properly encoded
    expect(url).toContain('target=');
    expect(url).not.toContain('&view='); // Should be encoded
    expect(url).toContain('%26'); // & encoded
  });

  it('should not add target parameter when targetUrl is empty', () => {
    const config: DeepLinkConfig = {
      staffbaseHost: 'company.staffbase.com',
      pluginId: 'plugin',
      pluginInstanceId: 'instance',
      targetUrl: '',
    };

    const url = buildSamlDeepLink(config);

    expect(url).not.toContain('target=');
    expect(url.endsWith('/deeplinking')).toBe(true);
  });
});

describe('buildOutlookDeepLink', () => {
  it('should return null when enableOutlookDeepLink is false', () => {
    const url = buildOutlookDeepLink({
      enableOutlookDeepLink: false,
      staffbaseHost: 'company.staffbase.com',
      samlPluginId: 'plugin',
      samlPluginInstanceId: 'instance',
    });

    expect(url).toBeNull();
  });

  it('should return null when enableOutlookDeepLink is undefined', () => {
    const url = buildOutlookDeepLink({
      staffbaseHost: 'company.staffbase.com',
      samlPluginId: 'plugin',
      samlPluginInstanceId: 'instance',
    });

    expect(url).toBeNull();
  });

  it('should return null when staffbaseHost is missing', () => {
    // Spy on console.warn to verify warning is logged
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const url = buildOutlookDeepLink({
      enableOutlookDeepLink: true,
      samlPluginId: 'plugin',
      samlPluginInstanceId: 'instance',
    });

    expect(url).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('should return null when samlPluginId is missing', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const url = buildOutlookDeepLink({
      enableOutlookDeepLink: true,
      staffbaseHost: 'company.staffbase.com',
      samlPluginInstanceId: 'instance',
    });

    expect(url).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('should return null when samlPluginInstanceId is missing', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const url = buildOutlookDeepLink({
      enableOutlookDeepLink: true,
      staffbaseHost: 'company.staffbase.com',
      samlPluginId: 'plugin',
    });

    expect(url).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('should build valid URL when all required fields are present', () => {
    const url = buildOutlookDeepLink({
      enableOutlookDeepLink: true,
      staffbaseHost: 'company.staffbase.com',
      samlPluginId: 'outlook-sso',
      samlPluginInstanceId: 'abc123',
    });

    expect(url).toBeDefined();
    expect(url).toContain('https://company.staffbase.com/content/outlook-sso/abc123/deeplinking');
    expect(url).toContain('target=');
    expect(url).toContain(encodeURIComponent('https://outlook.office.com/calendar'));
  });

  it('should use custom outlookCalendarUrl when provided', () => {
    const url = buildOutlookDeepLink({
      enableOutlookDeepLink: true,
      staffbaseHost: 'company.staffbase.com',
      samlPluginId: 'plugin',
      samlPluginInstanceId: 'instance',
      outlookCalendarUrl: 'https://custom.outlook.url/my-calendar',
    });

    expect(url).toContain(encodeURIComponent('https://custom.outlook.url/my-calendar'));
  });

  it('should use default OWA URL when outlookCalendarUrl is not provided', () => {
    const url = buildOutlookDeepLink({
      enableOutlookDeepLink: true,
      staffbaseHost: 'company.staffbase.com',
      samlPluginId: 'plugin',
      samlPluginInstanceId: 'instance',
    });

    expect(url).toContain(encodeURIComponent('https://outlook.office.com/calendar'));
  });
});

describe('buildDirectOutlookUrl', () => {
  it('should return base calendar URL without date', () => {
    const url = buildDirectOutlookUrl();

    expect(url).toBe('https://outlook.office.com/calendar');
  });

  it('should include formatted date when provided', () => {
    const date = new Date(2025, 4, 15); // May 15, 2025
    const url = buildDirectOutlookUrl(date);

    expect(url).toContain('https://outlook.office.com/calendar/view/month/');
    expect(url).toContain('2025-05-15');
  });

  it('should handle different dates', () => {
    const january = new Date(2025, 0, 1);
    const december = new Date(2025, 11, 31);

    expect(buildDirectOutlookUrl(january)).toContain('2025-01-01');
    expect(buildDirectOutlookUrl(december)).toContain('2025-12-31');
  });
});
