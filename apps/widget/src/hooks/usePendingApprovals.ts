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
 * Hook for supervisors to view and manage pending time-off approvals.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createApiClient, ApiError, type ApiClientConfig } from '../utils/apiClient';
import { shouldUseMockData, getMockPendingApprovals } from '../utils/mockData';
import type { TimeOffRequest } from '../types/request';

export interface UsePendingApprovalsOptions {
  /** API client configuration */
  apiConfig: ApiClientConfig;
  /** Supervisor's email address */
  supervisorEmail: string | null;
  /** Whether to skip fetching */
  skip?: boolean;
}

export interface UsePendingApprovalsReturn {
  /** List of pending requests requiring approval */
  pendingRequests: TimeOffRequest[];
  /** Whether data is loading */
  isLoading: boolean;
  /** Error message if operation failed */
  error: string | null;
  /** Approve a request */
  approveRequest: (requestId: string) => Promise<void>;
  /** Reject a request */
  rejectRequest: (requestId: string, reason?: string) => Promise<void>;
  /** Whether an action (approve/reject) is in progress */
  isActioning: boolean;
  /** Refresh the pending requests */
  refresh: () => void;
}

/**
 * Hook for supervisors to view and manage pending approvals.
 *
 * @param options - Configuration options
 * @returns Pending requests and action handlers
 *
 * @example
 * ```tsx
 * const {
 *   pendingRequests,
 *   isLoading,
 *   approveRequest,
 *   rejectRequest,
 * } = usePendingApprovals({
 *   apiConfig: { baseUrl: 'https://api.example.com', apiKey: 'xxx' },
 *   supervisorEmail: 'jane@example.com',
 * });
 *
 * // Approve a request
 * await approveRequest('request-uuid');
 *
 * // Reject with reason
 * await rejectRequest('request-uuid', 'Conflicting schedules');
 * ```
 */
export function usePendingApprovals(
  options: UsePendingApprovalsOptions
): UsePendingApprovalsReturn {
  const { apiConfig, supervisorEmail, skip = false } = options;

  const [pendingRequests, setPendingRequests] = useState<TimeOffRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActioning, setIsActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const apiClient = useMemo(
    () => createApiClient(apiConfig),
    [apiConfig.baseUrl, apiConfig.apiKey, apiConfig.timeout]
  );

  // Check if we should use mock data
  const useMockData = shouldUseMockData(apiConfig.baseUrl);

  const fetchPendingRequests = useCallback(async () => {
    if (skip || !supervisorEmail) {
      setPendingRequests([]);
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

        const mockApprovals = getMockPendingApprovals(supervisorEmail);

        if (currentRequestId === requestIdRef.current) {
          setPendingRequests(mockApprovals);
        }
        return;
      }

      const response = await apiClient.listTimeOffRequests({
        role: 'supervisor',
        email: supervisorEmail,
        status: 'pending',
      });

      if (currentRequestId === requestIdRef.current) {
        setPendingRequests(response.requests);
      }
    } catch (err) {
      if (currentRequestId === requestIdRef.current) {
        const errorMessage =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to fetch pending requests';
        setError(errorMessage);
        setPendingRequests([]);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [apiClient, supervisorEmail, skip, useMockData]);

  useEffect(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  const approveRequest = useCallback(
    async (requestId: string): Promise<void> => {
      if (!supervisorEmail) {
        throw new Error('Supervisor email is required');
      }

      setIsActioning(true);
      setError(null);

      try {
        // Use mock behavior in development
        if (useMockData) {
          // Simulate network delay
          await new Promise((resolve) => setTimeout(resolve, 500));
          // Remove from pending list
          setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
          return;
        }

        await apiClient.approveTimeOffRequest(requestId, supervisorEmail);
        // Remove from pending list
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      } catch (err) {
        const errorMessage =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to approve request';
        setError(errorMessage);
        throw err;
      } finally {
        setIsActioning(false);
      }
    },
    [apiClient, supervisorEmail, useMockData]
  );

  const rejectRequest = useCallback(
    async (requestId: string, reason?: string): Promise<void> => {
      if (!supervisorEmail) {
        throw new Error('Supervisor email is required');
      }

      setIsActioning(true);
      setError(null);

      try {
        // Use mock behavior in development
        if (useMockData) {
          // Simulate network delay
          await new Promise((resolve) => setTimeout(resolve, 500));
          // Remove from pending list
          setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
          return;
        }

        await apiClient.rejectTimeOffRequest(requestId, supervisorEmail, reason);
        // Remove from pending list
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      } catch (err) {
        const errorMessage =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to reject request';
        setError(errorMessage);
        throw err;
      } finally {
        setIsActioning(false);
      }
    },
    [apiClient, supervisorEmail, useMockData]
  );

  return {
    pendingRequests,
    isLoading,
    error,
    approveRequest,
    rejectRequest,
    isActioning,
    refresh: fetchPendingRequests,
  };
}
