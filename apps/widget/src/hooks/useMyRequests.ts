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
 * Hook for fetching and managing a user's own time-off requests.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createApiClient, ApiError, type ApiClientConfig } from '../utils/apiClient';
import { shouldUseMockData, getMockMyRequests } from '../utils/mockData';
import type { TimeOffRequest, RequestStatus } from '../types/request';

export interface UseMyRequestsOptions {
  /** API client configuration */
  apiConfig: ApiClientConfig;
  /** User's email address */
  userEmail: string | null;
  /** Filter by status (optional, default: 'all') */
  status?: RequestStatus | 'all';
  /** Whether to skip fetching */
  skip?: boolean;
  /** Callback invoked after a successful cancellation (e.g., to refresh calendar data) */
  onCancelSuccess?: () => void;
}

export interface UseMyRequestsReturn {
  /** List of user's time-off requests */
  requests: TimeOffRequest[];
  /** Whether data is loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Refresh the requests */
  refresh: () => void;
  /** Cancel a pending or approved request */
  cancelRequest: (requestId: string) => Promise<void>;
  /** Whether a cancel action is in progress */
  isCancelling: boolean;
}

/**
 * Hook for fetching a user's own time-off requests.
 *
 * @param options - Configuration options
 * @returns User's requests and loading state
 *
 * @example
 * ```tsx
 * const { requests, isLoading, error, refresh } = useMyRequests({
 *   apiConfig: { baseUrl: 'https://api.example.com', apiKey: 'xxx' },
 *   userEmail: 'john@example.com',
 * });
 * ```
 */
export function useMyRequests(options: UseMyRequestsOptions): UseMyRequestsReturn {
  const { apiConfig, userEmail, status = 'all', skip = false, onCancelSuccess } = options;

  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const apiClient = useMemo(
    () => createApiClient(apiConfig),
    [apiConfig.baseUrl, apiConfig.apiKey, apiConfig.timeout]
  );

  // Check if we should use mock data
  const useMockData = shouldUseMockData(apiConfig.baseUrl);

  const fetchRequests = useCallback(async () => {
    if (skip || !userEmail) {
      setRequests([]);
      setError(null);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      // Use mock data in development
      if (useMockData) {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 300));

        let mockRequests = getMockMyRequests(userEmail);

        // Filter by status if needed
        if (status !== 'all') {
          mockRequests = mockRequests.filter((r) => r.status === status);
        }

        if (currentRequestId === requestIdRef.current) {
          setRequests(mockRequests);
        }
        return;
      }

      const response = await apiClient.listTimeOffRequests({
        role: 'requester',
        email: userEmail,
        status,
      });

      if (currentRequestId === requestIdRef.current) {
        setRequests(response.requests);
      }
    } catch (err) {
      if (currentRequestId === requestIdRef.current) {
        const errorMessage =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to fetch requests';
        setError(errorMessage);
        setRequests([]);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [apiClient, userEmail, status, skip, useMockData]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const cancelRequest = useCallback(
    async (requestId: string): Promise<void> => {
      if (!userEmail) {
        throw new Error('User email is required');
      }

      setIsCancelling(true);
      setError(null);

      try {
        // Use mock behavior in development
        if (useMockData) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          // Remove cancelled request from the list
          setRequests((prev) => prev.filter((r) => r.id !== requestId));
          return;
        }

        await apiClient.cancelTimeOffRequest(requestId, userEmail);
        // Remove cancelled request from the list
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        // Brief delay before refreshing calendar data to allow Microsoft Graph
        // to propagate the event deletion (eventual consistency).
        await new Promise((resolve) => setTimeout(resolve, 1500));
        // Notify parent to refresh calendar data (calendar event has been deleted)
        onCancelSuccess?.();
      } catch (err) {
        const errorMessage =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to cancel request';
        setError(errorMessage);
        throw err;
      } finally {
        setIsCancelling(false);
      }
    },
    [apiClient, userEmail, useMockData, onCancelSuccess]
  );

  return {
    requests,
    isLoading,
    error,
    refresh: fetchRequests,
    cancelRequest,
    isCancelling,
  };
}
