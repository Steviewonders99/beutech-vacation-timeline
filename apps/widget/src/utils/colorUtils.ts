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

/**
 * Color utilities for consistent user coloring in the vacation timeline.
 * Uses a colorblind-friendly palette and ensures consistent colors per user.
 */

/**
 * A colorblind-friendly palette with good contrast.
 * Based on ColorBrewer qualitative palettes.
 */
const COLOR_PALETTE = [
  '#4E79A7', // Steel Blue
  '#F28E2B', // Orange
  '#E15759', // Red
  '#76B7B2', // Teal
  '#59A14F', // Green
  '#EDC948', // Yellow
  '#B07AA1', // Purple
  '#FF9DA7', // Pink
  '#9C755F', // Brown
  '#BAB0AC', // Gray
  '#86BCB6', // Light Teal
  '#8CD17D', // Light Green
  '#B6992D', // Olive
  '#499894', // Dark Teal
  '#D37295', // Rose
  '#A0CBE8', // Light Blue
  '#FFBE7D', // Light Orange
  '#D4A6C8', // Light Purple
  '#FABFD2', // Light Pink
  '#D7B5A6', // Light Brown
] as const;

/**
 * Cache for user color assignments to ensure consistency.
 */
const userColorCache = new Map<string, string>();

/**
 * Simple hash function to generate a consistent number from a string.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Gets a consistent color for a user based on their color key.
 * The same color key will always return the same color.
 *
 * @param colorKey - A unique identifier for the user (e.g., email, userId)
 * @returns A hex color string
 */
export function getUserColor(colorKey: string): string {
  // Check cache first
  if (userColorCache.has(colorKey)) {
    return userColorCache.get(colorKey)!;
  }

  // Generate consistent color from hash
  const hash = hashString(colorKey);
  const colorIndex = hash % COLOR_PALETTE.length;
  const color = COLOR_PALETTE[colorIndex];

  // Cache the result
  userColorCache.set(colorKey, color);

  return color;
}

/**
 * Gets a lighter version of a color for backgrounds/hover states.
 *
 * @param hexColor - A hex color string (e.g., "#4E79A7")
 * @param opacity - Opacity value between 0 and 1
 * @returns An rgba color string
 */
export function getLighterColor(hexColor: string, opacity: number = 0.2): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Gets a contrasting text color (black or white) for a given background color.
 *
 * @param hexColor - A hex color string
 * @returns "#000000" or "#FFFFFF"
 */
export function getContrastingTextColor(hexColor: string): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Gets the entire color palette for legend display.
 */
export function getColorPalette(): readonly string[] {
  return COLOR_PALETTE;
}

/**
 * Clears the color cache. Useful for testing or when users change.
 */
export function clearColorCache(): void {
  userColorCache.clear();
}

/**
 * Pre-assigns colors to a list of users to ensure no collisions where possible.
 * Should be called when the user list is known to optimize color distribution.
 *
 * @param colorKeys - Array of user color keys
 */
export function preassignColors(colorKeys: string[]): void {
  const usedIndices = new Set<number>();

  colorKeys.forEach((key) => {
    if (userColorCache.has(key)) {
      // Already assigned, mark index as used
      const color = userColorCache.get(key)!;
      const index = COLOR_PALETTE.indexOf(color as typeof COLOR_PALETTE[number]);
      if (index >= 0) usedIndices.add(index);
      return;
    }

    // Find the preferred index from hash
    const hash = hashString(key);
    let colorIndex = hash % COLOR_PALETTE.length;

    // If preferred index is used, find next available
    let attempts = 0;
    while (usedIndices.has(colorIndex) && attempts < COLOR_PALETTE.length) {
      colorIndex = (colorIndex + 1) % COLOR_PALETTE.length;
      attempts++;
    }

    usedIndices.add(colorIndex);
    userColorCache.set(key, COLOR_PALETTE[colorIndex]);
  });
}
