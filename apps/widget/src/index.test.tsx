/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Tests for widget registration.
 */

describe('Widget registration', () => {
  it('should export VacationTimeline component', async () => {
    const { VacationTimeline } = await import('./vacation-timeline');

    expect(VacationTimeline).toBeDefined();
    expect(typeof VacationTimeline).toBe('function');
  });

  it('should export configuration schema', async () => {
    const { configurationSchema, uiSchema } = await import('./configuration-schema');

    expect(configurationSchema).toBeDefined();
    expect(configurationSchema.type).toBe('object');
    // No required fields - production defaults are used if config is empty
    expect(configurationSchema.required).toEqual([]);

    expect(uiSchema).toBeDefined();
    expect(uiSchema.apiKey).toBeDefined();
  });

  it('should have correct widget attributes defined', async () => {
    // The widget attributes should include all configuration properties
    const expectedAttributes = [
      'apiBaseUrl',
      'apiKey',
      'calendarMode',
      'sharedCalendarMailbox',
      'defaultView',
      'vacationCategory',
      'maxUsers',
      'm365FallbackDomain',
      'enableOutlookDeepLink',
      'staffbaseHost',
      'samlPluginId',
      'samlPluginInstanceId',
      'outlookCalendarUrl',
    ];

    // These should all be defined in the configuration schema
    const { configurationSchema } = await import('./configuration-schema');

    expectedAttributes.forEach((attr) => {
      expect(configurationSchema.properties).toHaveProperty(attr);
    });
  });
});
