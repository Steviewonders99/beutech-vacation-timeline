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
 * Hook for fetching and managing vacation data from the backend API.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import type {
  VacationEvent,
  VacationView,
  VacationsMeta,
  TimelineUser,
} from '../types/vacation';
import { createApiClient, ApiError, type ApiClientConfig } from '../utils/apiClient';
import { toISODateString } from '../utils/dateUtils';
import { preassignColors } from '../utils/colorUtils';
import { getStaticMockVacations, shouldUseMockData } from '../utils/mockData';

export interface UseVacationDataOptions {
  /** API client configuration */
  apiConfig: ApiClientConfig;
  /** Start of the date range to fetch */
  startDate: Date;
  /** End of the date range to fetch */
  endDate: Date;
  /** Current view type */
  view: VacationView;
  /** Filter by specific user IDs (optional) */
  selectedUsers?: string[];
  /** Current user's M365 UPN for highlighting */
  currentUserUpn?: string | null;
  /** Timezone for the request */
  timezone?: string;
  /** Whether to skip fetching (e.g., when missing required config) */
  skip?: boolean;
}

export interface UseVacationDataReturn {
  /** Fetched vacation events */
  events: VacationEvent[];
  /** Unique users derived from events */
  users: TimelineUser[];
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Response metadata */
  meta: VacationsMeta | null;
  /** Manually refresh data */
  refresh: () => void;
}

/**
 * Extracts unique users from vacation events.
 */
function extractUsers(
  events: VacationEvent[],
  currentUserUpn: string | null
): TimelineUser[] {
  const userMap = new Map<string, TimelineUser>();

  events.forEach((event) => {
    if (!userMap.has(event.userId)) {
      const isCurrentUser =
        currentUserUpn !== null &&
        (event.userId.toLowerCase() === currentUserUpn.toLowerCase() ||
          event.userColorKey.toLowerCase() === currentUserUpn.toLowerCase());

      userMap.set(event.userId, {
        userId: event.userId,
        displayName: event.userDisplayName,
        colorKey: event.userColorKey,
        isCurrentUser,
      });
    }
  });

  // Sort: current user first, then alphabetically by display name
  return Array.from(userMap.values()).sort((a, b) => {
    if (a.isCurrentUser && !b.isCurrentUser) return -1;
    if (!a.isCurrentUser && b.isCurrentUser) return 1;
    return a.displayName.localeCompare(b.displayName);
  });
}

/**
 * Hook that fetches and manages vacation data from the backend.
 * Handles loading states, errors, caching, and user extraction.
 *
 * @param options - Configuration options
 * @returns Vacation data state and refresh function
 *
 * @example
 * ```tsx
 * const { events, users, isLoading, error, refresh } = useVacationData({
 *   apiConfig: { baseUrl: 'https://api.example.com', apiKey: 'xxx' },
 *   startDate: viewRange.start,
 *   endDate: viewRange.end,
 *   view: 'week',
 *   currentUserUpn: m365Upn,
 * });
 * ```
 */
export function useVacationData(options: UseVacationDataOptions): UseVacationDataReturn {
  const {
    apiConfig,
    startDate,
    endDate,
    view,
    selectedUsers,
    currentUserUpn = null,
    timezone,
    skip = false,
  } = options;

  const [events, setEvents] = useState<VacationEvent[]>([]);
  const [meta, setMeta] = useState<VacationsMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the current request to prevent race conditions
  const requestIdRef = useRef(0);

  // Create API client (memoized to prevent unnecessary recreations)
  const apiClient = useMemo(
    () => createApiClient(apiConfig),
    [apiConfig.baseUrl, apiConfig.apiKey, apiConfig.timeout]
  );

  // Check if we should use mock data (development mode with no real API)
  const useMockData = useMemo(
    () => shouldUseMockData(apiConfig.baseUrl),
    [apiConfig.baseUrl]
  );

  // Fetch vacation data
  const fetchData = useCallback(async () => {
    if (skip) {
      setEvents([]);
      setMeta(null);
      setError(null);
      return;
    }

    // Increment request ID to track this request
    const currentRequestId = ++requestIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      let fetchedEvents: VacationEvent[];
      let fetchedMeta: VacationsMeta;

      if (useMockData) {
        // Use mock data in development
        await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate network delay
        const allMockEvents = getStaticMockVacations();
        // Filter mock events to only those that overlap with the requested date range
        fetchedEvents = allMockEvents.filter((event) => {
          const eventStart = new Date(event.start);
          const eventEnd = new Date(event.end);
          // Event overlaps if it starts before range ends AND ends after range starts
          return eventStart <= endDate && eventEnd >= startDate;
        });
        fetchedMeta = {
          start: toISODateString(startDate),
          end: toISODateString(endDate),
          generatedAt: new Date().toISOString(),
        };
      } else {
        // Fetch from real API
        const response = await apiClient.fetchVacations({
          start: toISODateString(startDate),
          end: toISODateString(endDate),
          view,
          users: selectedUsers,
          timezone,
        });
        fetchedEvents = response.events;
        fetchedMeta = response.meta;
      }

      // Only update state if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        setEvents(fetchedEvents);
        setMeta(fetchedMeta);

        // Pre-assign colors for consistent coloring
        const colorKeys = fetchedEvents.map((e) => e.userColorKey);
        preassignColors([...new Set(colorKeys)]);
      }
    } catch (err) {
      // Only update state if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        if (err instanceof ApiError) {
          setError(`${err.code}: ${err.message}`);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unexpected error occurred');
        }
        setEvents([]);
        setMeta(null);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [apiClient, startDate, endDate, view, selectedUsers, timezone, skip, useMockData]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Extract users from events
  const users = useMemo(
    () => extractUsers(events, currentUserUpn),
    [events, currentUserUpn]
  );

  return {
    events,
    users,
    isLoading,
    error,
    meta,
    refresh: fetchData,
  };
}
