/**
 * i18n Configuration for Vacation Timeline Widget
 * Auto-detects language from Staffbase contentLanguage prop
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import es from './locales/es.json';

// Supported languages
export const SUPPORTED_LANGUAGES = ['en', 'de', 'fr', 'es'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Language display names
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
};

// Default fallback language
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/**
 * Parse Staffbase contentLanguage format (e.g., "en_US", "de_DE") to ISO language code
 * @param contentLanguage - Staffbase language string
 * @returns ISO language code (e.g., "en", "de")
 */
export function parseStaffbaseLanguage(contentLanguage: string | undefined): SupportedLanguage {
  if (!contentLanguage) {
    return DEFAULT_LANGUAGE;
  }

  // Staffbase format is typically "en_US", "de_DE", "fr_FR", etc.
  // Extract the language code (first 2 characters before underscore)
  const languageCode = contentLanguage.split('_')[0].toLowerCase();

  // Check if this language is supported
  if (SUPPORTED_LANGUAGES.includes(languageCode as SupportedLanguage)) {
    return languageCode as SupportedLanguage;
  }

  // Fallback to English for unsupported languages
  return DEFAULT_LANGUAGE;
}

// Initialize i18next
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
    fr: { translation: fr },
    es: { translation: es },
  },
  lng: DEFAULT_LANGUAGE, // Will be updated by the component
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false, // React already escapes values
  },
  // Pluralization
  pluralSeparator: '_',
  // Return empty string for missing keys (fallback to key)
  returnEmptyString: false,
  // Debug mode (disable in production)
  debug: false,
});

/**
 * Change the current language
 * @param language - Language code to switch to
 */
export function changeLanguage(language: string): Promise<void> {
  const parsedLang = parseStaffbaseLanguage(language);
  return i18n.changeLanguage(parsedLang).then(() => undefined);
}

/**
 * Get the current language
 */
export function getCurrentLanguage(): SupportedLanguage {
  return i18n.language as SupportedLanguage;
}

export default i18n;
