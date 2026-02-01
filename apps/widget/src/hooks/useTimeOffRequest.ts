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
 * Hook for submitting time-off requests.
 */

import { useState, useCallback, useMemo } from 'react';
import { createApiClient, ApiError, type ApiClientConfig } from '../utils/apiClient';
import { shouldUseMockData } from '../utils/mockData';
import type { TimeOffRequest, CreateTimeOffRequestInput } from '../types/request';

export interface UseTimeOffRequestOptions {
  /** API client configuration */
  apiConfig: ApiClientConfig;
}

export interface UseTimeOffRequestReturn {
  /** Submit a new time-off request */
  submitRequest: (data: CreateTimeOffRequestInput) => Promise<TimeOffRequest>;
  /** Whether a request is being submitted */
  isSubmitting: boolean;
  /** Error message if submission failed */
  error: string | null;
  /** The last successfully created request */
  lastCreatedRequest: TimeOffRequest | null;
  /** Reset the error and success state */
  reset: () => void;
}

/**
 * Validates date format (YYYY-MM-DD).
 */
function isValidDateFormat(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

/**
 * Validates that a date is not in the past.
 */
function isNotInPast(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
}

/**
 * Hook for submitting time-off requests.
 *
 * @param options - Configuration options
 * @returns Functions and state for submitting requests
 *
 * @example
 * ```tsx
 * const { submitRequest, isSubmitting, error } = useTimeOffRequest({
 *   apiConfig: { baseUrl: 'https://api.example.com', apiKey: 'xxx' },
 * });
 *
 * const handleSubmit = async () => {
 *   try {
 *     await submitRequest({
 *       requesterEmail: 'john@example.com',
 *       requesterName: 'John Doe',
 *       startDate: '2025-02-10',
 *       endDate: '2025-02-14',
 *       leaveType: 'vacation',
 *       reason: 'Family trip',
 *     });
 *   } catch (err) {
 *     // Error is also available in the error state
 *   }
 * };
 * ```
 */
export function useTimeOffRequest(options: UseTimeOffRequestOptions): UseTimeOffRequestReturn {
  const { apiConfig } = options;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCreatedRequest, setLastCreatedRequest] = useState<TimeOffRequest | null>(null);

  const apiClient = useMemo(
    () => createApiClient(apiConfig),
    [apiConfig.baseUrl, apiConfig.apiKey, apiConfig.timeout]
  );

  // Check if we should use mock data
  const useMockData = shouldUseMockData(apiConfig.baseUrl);

  const submitRequest = useCallback(
    async (data: CreateTimeOffRequestInput): Promise<TimeOffRequest> => {
      // Client-side validation
      if (!data.requesterEmail) {
        throw new Error('Requester email is required');
      }
      if (!data.requesterName) {
        throw new Error('Requester name is required');
      }
      if (!data.startDate || !isValidDateFormat(data.startDate)) {
        throw new Error('Start date is required in YYYY-MM-DD format');
      }
      if (!data.endDate || !isValidDateFormat(data.endDate)) {
        throw new Error('End date is required in YYYY-MM-DD format');
      }
      if (new Date(data.endDate) < new Date(data.startDate)) {
        throw new Error('End date must be on or after start date');
      }
      if (!isNotInPast(data.startDate)) {
        throw new Error('Start date cannot be in the past');
      }

      setIsSubmitting(true);
      setError(null);

      try {
        // Use mock behavior in development
        if (useMockData) {
          // Simulate network delay
          await new Promise((resolve) => setTimeout(resolve, 800));

          const mockRequest: TimeOffRequest = {
            id: `mock-new-${Date.now()}`,
            requesterEmail: data.requesterEmail,
            requesterName: data.requesterName,
            supervisorEmail: 'manager@company.com',
            supervisorName: 'John Manager',
            startDate: data.startDate,
            endDate: data.endDate,
            leaveType: data.leaveType || 'vacation',
            reason: data.reason,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          setLastCreatedRequest(mockRequest);
          return mockRequest;
        }

        const response = await apiClient.createTimeOffRequest(data);
        setLastCreatedRequest(response.request);
        return response.request;
      } catch (err) {
        const errorMessage =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to submit request';
        setError(errorMessage);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [apiClient, useMockData]
  );

  const reset = useCallback(() => {
    setError(null);
    setLastCreatedRequest(null);
  }, []);

  return {
    submitRequest,
    isSubmitting,
    error,
    lastCreatedRequest,
    reset,
  };
}
