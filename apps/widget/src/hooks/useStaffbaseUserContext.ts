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
 * Hook for accessing the current Staffbase user context.
 * Uses the Staffbase Widget SDK to retrieve user information.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { WidgetApi, SBUserProfile } from '@staffbase/widget-sdk';
import { shouldUseMockOrgData, getMockOrgData } from '../utils/mockData';

export interface StaffbaseManager {
  /** Manager's Staffbase user ID */
  id: string;
  /** Manager's display name */
  displayName: string;
  /** Manager's email address */
  email?: string;
}

export interface StaffbaseUser {
  /** Staffbase user ID */
  id: string;
  /** User's first name */
  firstName: string;
  /** User's last name */
  lastName: string;
  /** User's display name (firstName + lastName) */
  displayName: string;
  /** User's email address */
  email?: string;
  /** User's external ID (often maps to M365 UPN) */
  externalId?: string;
  /** User's department */
  department?: string;
  /** User's location */
  location?: string;
  /** User's position/job title */
  position?: string;
  /** User's manager (from system_manager profile field) */
  manager?: StaffbaseManager;
  /** Whether this user has direct reports (is a supervisor) */
  hasDirectReports?: boolean;
  /** Raw profile from Staffbase SDK */
  rawProfile: SBUserProfile;
}

export interface UseStaffbaseUserContextReturn {
  /** Current user information */
  user: StaffbaseUser | null;
  /** Whether user data is loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** The user's Microsoft 365 UPN (if derivable) */
  m365Upn: string | null;
  /** The user's manager email (for sending time-off requests) */
  managerEmail: string | null;
  /** Whether this user is a supervisor with direct reports */
  isSupervisor: boolean;
}

/**
 * Extract manager info from the profile's custom fields.
 * The manager is typically stored in system_manager or manager profile field.
 */
function extractManager(profile: SBUserProfile): StaffbaseManager | undefined {
  // Check for manager in profile fields
  // Staffbase stores manager in various ways depending on configuration
  const rawProfile = profile as unknown as Record<string, unknown>;

  // Try system_manager field (object with user details)
  const systemManager = rawProfile.system_manager as Record<string, unknown> | undefined;
  if (systemManager && typeof systemManager === 'object') {
    return {
      id: (systemManager.id as string) || '',
      displayName: (systemManager.displayName as string) ||
        [systemManager.firstName, systemManager.lastName].filter(Boolean).join(' ') as string ||
        '',
      email: (systemManager.email as string) ||
        (systemManager.primaryEmail as string) ||
        (systemManager.publicEmailAddress as string),
    };
  }

  // Try manager field (might be just an ID or email)
  const manager = rawProfile.manager as string | Record<string, unknown> | undefined;
  if (manager) {
    if (typeof manager === 'string') {
      // Manager is just an ID or email
      return {
        id: manager,
        displayName: manager,
        email: manager.includes('@') ? manager : undefined,
      };
    }
    if (typeof manager === 'object') {
      return {
        id: (manager.id as string) || '',
        displayName: (manager.displayName as string) ||
          [manager.firstName, manager.lastName].filter(Boolean).join(' ') as string ||
          '',
        email: (manager.email as string) ||
          (manager.primaryEmail as string),
      };
    }
  }

  // Try profile.profile for nested custom fields
  const nestedProfile = rawProfile.profile as Record<string, unknown> | undefined;
  if (nestedProfile?.system_manager || nestedProfile?.manager) {
    const nestedManager = (nestedProfile.system_manager || nestedProfile.manager) as Record<string, unknown>;
    if (typeof nestedManager === 'object') {
      return {
        id: (nestedManager.id as string) || '',
        displayName: (nestedManager.displayName as string) || '',
        email: (nestedManager.email as string),
      };
    }
  }

  return undefined;
}

/**
 * Check if user has direct reports based on profile fields.
 */
function checkHasDirectReports(profile: SBUserProfile): boolean {
  const rawProfile = profile as unknown as Record<string, unknown>;

  // Check for directReports or subordinates array
  const directReports = rawProfile.directReports as unknown[] | undefined;
  if (Array.isArray(directReports) && directReports.length > 0) {
    return true;
  }

  // Check nested profile
  const nestedProfile = rawProfile.profile as Record<string, unknown> | undefined;
  if (nestedProfile) {
    const nestedReports = nestedProfile.directReports as unknown[] | undefined;
    if (Array.isArray(nestedReports) && nestedReports.length > 0) {
      return true;
    }
  }

  // Check for isSupervisor or isManager flag
  if (rawProfile.isSupervisor === true || rawProfile.isManager === true) {
    return true;
  }

  return false;
}

/**
 * Transforms a Staffbase SDK user profile into our normalized format.
 */
function transformUser(profile: SBUserProfile): StaffbaseUser {
  const manager = extractManager(profile);
  const hasDirectReports = checkHasDirectReports(profile);

  return {
    id: profile.id,
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    displayName: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.id,
    email: profile.primaryEmail ?? profile.publicEmailAddress,
    externalId: profile.externalID,
    department: profile.department,
    location: profile.location,
    position: profile.position,
    manager,
    hasDirectReports,
    rawProfile: profile,
  };
}

/**
 * Hook that provides access to the current Staffbase user context.
 * Automatically fetches user information using the Widget SDK.
 *
 * @param widgetApi - The Staffbase Widget API instance
 * @param m365FallbackDomain - Optional domain to use when constructing M365 UPN
 * @returns User context state
 *
 * @example
 * ```tsx
 * const { user, m365Upn, isLoading, error } = useStaffbaseUserContext(widgetApi, 'company.com');
 *
 * if (isLoading) return <LoadingState />;
 * if (error) return <ErrorState message={error} />;
 *
 * return <div>Welcome, {user?.displayName}</div>;
 * ```
 */
export function useStaffbaseUserContext(
  widgetApi: WidgetApi | null,
  m365FallbackDomain?: string
): UseStaffbaseUserContextReturn {
  const [user, setUser] = useState<StaffbaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derive M365 UPN from user data
  const deriveM365Upn = useCallback(
    (staffbaseUser: StaffbaseUser | null): string | null => {
      if (!staffbaseUser) return null;

      // Priority 1: External ID (often contains M365 UPN)
      if (staffbaseUser.externalId && staffbaseUser.externalId.includes('@')) {
        return staffbaseUser.externalId;
      }

      // Priority 2: Email address
      if (staffbaseUser.email) {
        return staffbaseUser.email;
      }

      // Priority 3: Construct from ID and fallback domain
      if (m365FallbackDomain) {
        return `${staffbaseUser.id}@${m365FallbackDomain}`;
      }

      return null;
    },
    [m365FallbackDomain]
  );

  useEffect(() => {
    if (!widgetApi) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchUser() {
      try {
        setIsLoading(true);
        setError(null);

        const profile = await widgetApi.getUserInformation();

        // DEBUG: Log the full Staffbase user profile to find M365 UPN
        console.log('🔍 Staffbase User Profile:', {
          id: profile?.id,
          firstName: profile?.firstName,
          lastName: profile?.lastName,
          externalId: profile?.externalID,
          primaryEmail: profile?.primaryEmail,
          publicEmail: profile?.publicEmailAddress,
          department: profile?.department,
          position: profile?.position,
          raw: profile
        });

        if (!cancelled && profile) {
          setUser(transformUser(profile));
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load user information';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchUser();

    return () => {
      cancelled = true;
    };
  }, [widgetApi]);

  const m365Upn = deriveM365Upn(user);

  // DEBUG: Log the derived M365 UPN
  if (user && !isLoading) {
    console.log('🔑 Derived M365 UPN:', {
      upn: m365Upn,
      source: user.externalId?.includes('@') ? 'externalId' : user.email ? 'email' : 'fallback',
      managerEmail: user.manager?.email,
      hasDirectReports: user.hasDirectReports
    });
  }

  // Check if we should use mock org data (development mode)
  const useMockOrg = useMemo(() => shouldUseMockOrgData(), []);

  // Get mock org data if in development
  const mockOrgData = useMemo(() => {
    if (useMockOrg && m365Upn) {
      return getMockOrgData(m365Upn);
    }
    return null;
  }, [useMockOrg, m365Upn]);

  // Derive manager email (prefer real data, fallback to mock)
  const managerEmail = user?.manager?.email || mockOrgData?.manager?.email || null;

  // Determine if user is a supervisor (prefer real data, fallback to mock)
  const isSupervisor = user?.hasDirectReports || mockOrgData?.hasDirectReports || false;

  return {
    user,
    isLoading,
    error,
    m365Upn,
    managerEmail,
    isSupervisor,
  };
}
