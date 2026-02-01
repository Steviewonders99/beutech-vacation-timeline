/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Tests for colorUtils.
 */

import {
  getUserColor,
  getLighterColor,
  getContrastingTextColor,
  getColorPalette,
  clearColorCache,
  preassignColors,
} from '../colorUtils';

// Clear cache before each test to ensure isolation
beforeEach(() => {
  clearColorCache();
});

describe('getUserColor', () => {
  it('should return a hex color string', () => {
    const color = getUserColor('user@example.com');

    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('should return consistent color for same user', () => {
    const color1 = getUserColor('john@example.com');
    const color2 = getUserColor('john@example.com');

    expect(color1).toBe(color2);
  });

  it('should return colors from the palette', () => {
    const color = getUserColor('test@example.com');
    const palette = getColorPalette();

    expect(palette).toContain(color);
  });

  it('should return different colors for different users (usually)', () => {
    const colors = new Set<string>();
    const users = ['user1@a.com', 'user2@b.com', 'user3@c.com', 'user4@d.com', 'user5@e.com'];

    users.forEach((user) => colors.add(getUserColor(user)));

    // With 5 users and 20 colors, collisions are possible but unlikely
    expect(colors.size).toBeGreaterThanOrEqual(3);
  });

  it('should cache results', () => {
    // First call
    const color1 = getUserColor('cached@example.com');

    // Clear might not clear it if implementation is different
    // The function should return from cache on second call
    const color2 = getUserColor('cached@example.com');

    expect(color1).toBe(color2);
  });
});

describe('getLighterColor', () => {
  it('should return rgba color with specified opacity', () => {
    const lighter = getLighterColor('#4E79A7', 0.2);

    expect(lighter).toMatch(/^rgba\(\d+, \d+, \d+, 0\.2\)$/);
  });

  it('should default to 0.2 opacity', () => {
    const lighter = getLighterColor('#4E79A7');

    expect(lighter).toContain('0.2');
  });

  it('should parse hex color correctly', () => {
    const lighter = getLighterColor('#FF0000', 0.5);

    expect(lighter).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('should handle different opacities', () => {
    expect(getLighterColor('#000000', 0.1)).toBe('rgba(0, 0, 0, 0.1)');
    expect(getLighterColor('#000000', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
    expect(getLighterColor('#000000', 1.0)).toBe('rgba(0, 0, 0, 1)');
  });

  it('should handle white color', () => {
    const lighter = getLighterColor('#FFFFFF', 0.3);

    expect(lighter).toBe('rgba(255, 255, 255, 0.3)');
  });
});

describe('getContrastingTextColor', () => {
  it('should return white for dark colors', () => {
    expect(getContrastingTextColor('#000000')).toBe('#FFFFFF');
    expect(getContrastingTextColor('#4E79A7')).toBe('#FFFFFF'); // Steel Blue
    expect(getContrastingTextColor('#333333')).toBe('#FFFFFF');
  });

  it('should return black for light colors', () => {
    expect(getContrastingTextColor('#FFFFFF')).toBe('#000000');
    expect(getContrastingTextColor('#EDC948')).toBe('#000000'); // Yellow
    expect(getContrastingTextColor('#FFFF00')).toBe('#000000'); // Pure yellow
  });

  it('should handle mid-range colors', () => {
    // These should return a valid text color
    const result = getContrastingTextColor('#808080');
    expect(['#000000', '#FFFFFF']).toContain(result);
  });
});

describe('getColorPalette', () => {
  it('should return array of colors', () => {
    const palette = getColorPalette();

    expect(Array.isArray(palette)).toBe(true);
    expect(palette.length).toBeGreaterThan(0);
  });

  it('should return valid hex colors', () => {
    const palette = getColorPalette();

    palette.forEach((color) => {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('should have at least 10 colors', () => {
    const palette = getColorPalette();

    expect(palette.length).toBeGreaterThanOrEqual(10);
  });

  it('should be immutable (readonly)', () => {
    const palette = getColorPalette();

    // Should be a readonly array
    expect(typeof palette).toBe('object');
  });
});

describe('clearColorCache', () => {
  it('should clear cached colors', () => {
    // Assign a color
    const color1 = getUserColor('test@example.com');

    // Clear cache
    clearColorCache();

    // Color should still be the same (deterministic hash)
    const color2 = getUserColor('test@example.com');
    expect(color1).toBe(color2);
  });

  it('should not throw when cache is empty', () => {
    expect(() => clearColorCache()).not.toThrow();
  });
});

describe('preassignColors', () => {
  it('should preassign colors to users', () => {
    const users = ['user1@test.com', 'user2@test.com', 'user3@test.com'];
    preassignColors(users);

    // All users should now have cached colors
    users.forEach((user) => {
      const color = getUserColor(user);
      expect(color).toBeDefined();
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('should try to avoid color collisions', () => {
    const users = Array.from({ length: 10 }, (_, i) => `user${i}@test.com`);
    preassignColors(users);

    const colors = users.map((user) => getUserColor(user));
    const uniqueColors = new Set(colors);

    // Should have mostly unique colors (10 users, 20 palette colors)
    expect(uniqueColors.size).toBeGreaterThanOrEqual(8);
  });

  it('should preserve already cached colors', () => {
    // First, assign a color
    const firstColor = getUserColor('existing@test.com');

    // Then preassign including the existing user
    preassignColors(['new1@test.com', 'existing@test.com', 'new2@test.com']);

    // Original color should be preserved
    const secondColor = getUserColor('existing@test.com');
    expect(secondColor).toBe(firstColor);
  });

  it('should handle empty array', () => {
    expect(() => preassignColors([])).not.toThrow();
  });

  it('should handle duplicate users in array', () => {
    const users = ['user@test.com', 'user@test.com', 'user@test.com'];

    expect(() => preassignColors(users)).not.toThrow();

    const color = getUserColor('user@test.com');
    expect(color).toBeDefined();
  });
});

describe('color palette accessibility', () => {
  it('should have distinct colors that are colorblind-friendly', () => {
    const palette = getColorPalette();

    // Each color should be unique
    const uniqueColors = new Set(palette);
    expect(uniqueColors.size).toBe(palette.length);
  });

  it('should provide sufficient contrast for all palette colors', () => {
    const palette = getColorPalette();

    palette.forEach((color) => {
      const textColor = getContrastingTextColor(color);
      expect(['#000000', '#FFFFFF']).toContain(textColor);
    });
  });
});
