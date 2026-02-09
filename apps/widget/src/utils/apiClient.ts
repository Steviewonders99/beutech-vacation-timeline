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
 * API client for communicating with the Azure Functions backend.
 * Handles authentication, error handling, and response parsing.
 */

import type {
  FetchVacationsParams,
  VacationsApiResponse,
  ApiErrorResponse,
  NextEventApiResponse,
} from '../types/vacation';
import type {
  CreateTimeOffRequestInput,
  CreateTimeOffResponse,
  ListTimeOffResponse,
  ListRequestsParams,
  ApproveTimeOffResponse,
  RejectTimeOffResponse,
} from '../types/request';

/**
 * Configuration for the API client.
 */
export interface ApiClientConfig {
  /** Base URL of the Azure Functions backend */
  baseUrl: string;
  /** API key for authentication (optional - origin-based auth used if not provided) */
  apiKey?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Custom error class for API errors.
 */
export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Creates an API client instance with the given configuration.
 */
export function createApiClient(config: ApiClientConfig) {
  const { baseUrl, apiKey, timeout = 30000 } = config;

  /**
   * Makes an authenticated request to the API.
   * If apiKey is provided, it's sent in the header.
   * Otherwise, relies on origin-based authentication (CORS).
   */
  async function request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Build headers - only include API key if provided
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData: ApiErrorResponse | null = null;
        try {
          errorData = await response.json();
        } catch {
          // Response may not be JSON
        }

        const errorMessage = errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        const errorCode = errorData?.error?.code || 'UnknownError';

        throw new ApiError(errorMessage, errorCode, response.status);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError('Request timed out', 'Timeout', 408);
        }
        throw new ApiError(error.message, 'NetworkError', 0);
      }

      throw new ApiError('An unexpected error occurred', 'UnknownError', 0);
    }
  }

  /**
   * Fetches vacation events from the API.
   */
  async function fetchVacations(
    params: FetchVacationsParams
  ): Promise<VacationsApiResponse> {
    const searchParams = new URLSearchParams({
      start: params.start,
      end: params.end,
      view: params.view,
    });

    if (params.users && params.users.length > 0) {
      searchParams.set('users', params.users.join(','));
    }

    if (params.timezone) {
      searchParams.set('timezone', params.timezone);
    }

    return request<VacationsApiResponse>(`/api/vacations?${searchParams.toString()}`);
  }

  /**
   * Fetches the first future event date from the API.
   */
  async function fetchNextEventDate(
    timezone?: string
  ): Promise<NextEventApiResponse> {
    const searchParams = new URLSearchParams();

    if (timezone) {
      searchParams.set('timezone', timezone);
    }

    const queryString = searchParams.toString();
    const endpoint = queryString
      ? `/api/vacations/next-event?${queryString}`
      : '/api/vacations/next-event';

    return request<NextEventApiResponse>(endpoint);
  }

  /**
   * Creates a new time-off request.
   */
  async function createTimeOffRequest(
    data: CreateTimeOffRequestInput
  ): Promise<CreateTimeOffResponse> {
    return request<CreateTimeOffResponse>('/api/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Lists time-off requests.
   */
  async function listTimeOffRequests(
    params: ListRequestsParams
  ): Promise<ListTimeOffResponse> {
    const searchParams = new URLSearchParams({
      role: params.role,
      email: params.email,
    });

    if (params.status) {
      searchParams.set('status', params.status);
    }

    return request<ListTimeOffResponse>(`/api/requests?${searchParams.toString()}`);
  }

  /**
   * Approves a time-off request.
   */
  async function approveTimeOffRequest(
    requestId: string,
    supervisorEmail: string
  ): Promise<ApproveTimeOffResponse> {
    return request<ApproveTimeOffResponse>(`/api/requests/${requestId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ supervisorEmail }),
    });
  }

  /**
   * Rejects a time-off request.
   */
  async function rejectTimeOffRequest(
    requestId: string,
    supervisorEmail: string,
    reason?: string
  ): Promise<RejectTimeOffResponse> {
    return request<RejectTimeOffResponse>(`/api/requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ supervisorEmail, reason }),
    });
  }

  /**
   * Cancels a time-off request (by the requester).
   */
  async function cancelTimeOffRequest(
    requestId: string,
    requesterEmail: string
  ): Promise<{ request: { id: string; status: string }; message: string }> {
    return request(`/api/requests/${requestId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ requesterEmail }),
    });
  }

  /**
   * Checks if a user is a supervisor (has direct reports with requests).
   */
  async function checkIsSupervisor(
    email: string
  ): Promise<{ isSupervisor: boolean; email: string }> {
    return request(`/api/users/is-supervisor?email=${encodeURIComponent(email)}`);
  }

  return {
    fetchVacations,
    fetchNextEventDate,
    createTimeOffRequest,
    listTimeOffRequests,
    approveTimeOffRequest,
    rejectTimeOffRequest,
    cancelTimeOffRequest,
    checkIsSupervisor,
    request,
  };
}

/**
 * Type for the API client returned by createApiClient.
 */
export type ApiClient = ReturnType<typeof createApiClient>;
