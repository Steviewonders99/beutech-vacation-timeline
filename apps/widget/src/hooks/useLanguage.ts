/**
 * Hook for managing language based on Staffbase contentLanguage
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, parseStaffbaseLanguage, SupportedLanguage } from '../i18n';

/**
 * Hook to sync i18n language with Staffbase contentLanguage
 * @param contentLanguage - Staffbase contentLanguage prop (e.g., "en_US", "de_DE")
 */
export function useLanguage(contentLanguage: string | undefined): {
  language: SupportedLanguage;
  t: ReturnType<typeof useTranslation>['t'];
  ready: boolean;
} {
  const { t, i18n, ready } = useTranslation();

  useEffect(() => {
    const targetLang = parseStaffbaseLanguage(contentLanguage);

    // Only change if different from current language
    if (i18n.language !== targetLang) {
      changeLanguage(contentLanguage || 'en');
    }
  }, [contentLanguage, i18n]);

  return {
    language: i18n.language as SupportedLanguage,
    t,
    ready,
  };
}

export default useLanguage;
