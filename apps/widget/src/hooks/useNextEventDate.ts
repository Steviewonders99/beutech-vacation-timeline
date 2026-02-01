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
 * Hook for fetching the first future event date from the backend API.
 * Used to determine the initial anchor date for the timeline.
 */

import { useEffect, useState, useMemo } from 'react';
import { createApiClient, ApiError, type ApiClientConfig } from '../utils/apiClient';
import { getFirstFutureEventDate, shouldUseMockData } from '../utils/mockData';

export interface UseNextEventDateOptions {
  /** API client configuration */
  apiConfig: ApiClientConfig;
  /** Timezone for the request */
  timezone?: string;
  /** Whether to skip fetching (e.g., when missing required config) */
  skip?: boolean;
}

export interface UseNextEventDateReturn {
  /** The first future event date (as Date), or null if none found */
  nextEventDate: Date | null;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
}

/**
 * Parses a date string (YYYY-MM-DD) into a Date object.
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Hook that fetches the first future vacation event date.
 * Used to initialize the timeline to show upcoming vacations rather than today.
 *
 * @param options - Configuration options
 * @returns The first future event date and loading state
 *
 * @example
 * ```tsx
 * const { nextEventDate, isLoading } = useNextEventDate({
 *   apiConfig: { baseUrl: 'https://api.example.com', apiKey: 'xxx' },
 * });
 *
 * // Use nextEventDate as initial anchor if available
 * const initialDate = nextEventDate ?? new Date();
 * ```
 */
export function useNextEventDate(options: UseNextEventDateOptions): UseNextEventDateReturn {
  const { apiConfig, timezone, skip = false } = options;

  const [nextEventDate, setNextEventDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(!skip);
  const [error, setError] = useState<string | null>(null);

  // Create API client
  const apiClient = useMemo(
    () => createApiClient(apiConfig),
    [apiConfig.baseUrl, apiConfig.apiKey, apiConfig.timeout]
  );

  // Check if we should use mock data
  const useMockData = useMemo(
    () => shouldUseMockData(apiConfig.baseUrl),
    [apiConfig.baseUrl]
  );

  useEffect(() => {
    if (skip) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        let dateStr: string | null;

        if (useMockData) {
          // Use mock data in development
          await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate network delay
          dateStr = getFirstFutureEventDate();
        } else {
          // Fetch from real API
          const response = await apiClient.fetchNextEventDate(timezone);
          dateStr = response.nextEventDate;
        }

        if (!cancelled) {
          if (dateStr) {
            setNextEventDate(parseDate(dateStr));
          } else {
            setNextEventDate(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(`${err.code}: ${err.message}`);
          } else if (err instanceof Error) {
            setError(err.message);
          } else {
            setError('An unexpected error occurred');
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [apiClient, timezone, skip, useMockData]);

  return {
    nextEventDate,
    isLoading,
    error,
  };
}
