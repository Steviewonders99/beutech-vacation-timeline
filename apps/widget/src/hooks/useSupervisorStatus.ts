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
 * Hook for checking if the current user is a supervisor.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { createApiClient, ApiError, type ApiClientConfig } from '../utils/apiClient';
import { shouldUseMockData } from '../utils/mockData';

export interface UseSupervisorStatusOptions {
  /** API client configuration */
  apiConfig: ApiClientConfig;
  /** User's email address */
  email: string | null;
  /** Whether to skip the check */
  skip?: boolean;
}

export interface UseSupervisorStatusReturn {
  /** Whether the user is a supervisor */
  isSupervisor: boolean;
  /** Whether the check is loading */
  isLoading: boolean;
  /** Error message if check failed */
  error: string | null;
}

/**
 * Hook that checks if the current user is a supervisor.
 * A user is a supervisor if they have any requests where they are the supervisor.
 */
export function useSupervisorStatus(
  options: UseSupervisorStatusOptions
): UseSupervisorStatusReturn {
  const { apiConfig, email, skip = false } = options;

  const [isSupervisor, setIsSupervisor] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const apiClient = useMemo(
    () => createApiClient(apiConfig),
    [apiConfig.baseUrl, apiConfig.apiKey, apiConfig.timeout]
  );

  // Check if we should use mock data
  const useMockData = shouldUseMockData(apiConfig.baseUrl);

  useEffect(() => {
    if (skip || !email) {
      setIsSupervisor(false);
      setError(null);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    async function checkStatus() {
      try {
        // Use mock data in development
        if (useMockData) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          // Mock: users with "manager" or "supervisor" in email are supervisors
          const isMockSupervisor = email.toLowerCase().includes('manager') ||
                                    email.toLowerCase().includes('supervisor');
          if (currentRequestId === requestIdRef.current) {
            setIsSupervisor(isMockSupervisor);
          }
          return;
        }

        // Use existing endpoint - if user has ANY requests as supervisor, they are a supervisor
        const response = await apiClient.listTimeOffRequests({
          role: 'supervisor',
          email: email,
          status: 'all',
        });

        if (currentRequestId === requestIdRef.current) {
          // If we get any requests back, user is a supervisor
          setIsSupervisor(response.requests.length > 0);
        }
      } catch (err) {
        if (currentRequestId === requestIdRef.current) {
          const errorMessage =
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : 'Failed to check supervisor status';
          setError(errorMessage);
          setIsSupervisor(false);
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    }

    checkStatus();
  }, [apiClient, email, skip, useMockData]);

  return {
    isSupervisor,
    isLoading,
    error,
  };
}
