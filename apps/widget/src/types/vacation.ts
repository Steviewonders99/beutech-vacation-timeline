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
 * Vacation event types used throughout the widget.
 * These types match the API contract defined in the backend.
 */

/** Available calendar view modes */
export type VacationView = 'day' | 'week' | 'month' | 'timeline';

/**
 * Represents a single vacation event.
 * This is the normalized format returned by the backend API.
 */
export interface VacationEvent {
  /** Unique identifier from Microsoft Graph */
  id: string;
  /** User's Microsoft 365 ID or email (UPN) */
  userId: string;
  /** User's display name for the timeline row label */
  userDisplayName: string;
  /** Consistent color key for this user (used with colorUtils) */
  userColorKey: string;
  /** Event title (usually "Vacation" or similar) */
  title: string;
  /** Start date/time in ISO 8601 format */
  start: string;
  /** End date/time in ISO 8601 format */
  end: string;
}

/**
 * Response metadata from the vacations API.
 */
export interface VacationsMeta {
  /** Requested range start (ISO 8601) */
  start: string;
  /** Requested range end (ISO 8601) */
  end: string;
  /** When the response was generated (ISO 8601) */
  generatedAt: string;
}

/**
 * Full API response from GET /api/vacations.
 */
export interface VacationsApiResponse {
  events: VacationEvent[];
  meta: VacationsMeta;
}

/**
 * API error response structure.
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Response from GET /api/vacations/next-event.
 */
export interface NextEventApiResponse {
  /** The start date of the first future event (YYYY-MM-DD), or null if none found */
  nextEventDate: string | null;
  /** When the response was generated (ISO 8601) */
  generatedAt: string;
}

/**
 * Represents a user in the vacation timeline.
 * Derived from vacation events for filtering and display.
 */
export interface TimelineUser {
  /** User's Microsoft 365 ID or email */
  userId: string;
  /** User's display name */
  displayName: string;
  /** Assigned color key for consistent coloring */
  colorKey: string;
  /** Whether this is the current Staffbase user */
  isCurrentUser: boolean;
}

/**
 * State for the vacation data hook.
 */
export interface VacationDataState {
  events: VacationEvent[];
  users: TimelineUser[];
  isLoading: boolean;
  error: string | null;
  meta: VacationsMeta | null;
}

/**
 * Parameters for fetching vacation data.
 */
export interface FetchVacationsParams {
  start: string;
  end: string;
  view: VacationView;
  users?: string[];
  timezone?: string;
}

/**
 * View range information calculated from view type and anchor date.
 */
export interface ViewRange {
  /** Start of the view range */
  start: Date;
  /** End of the view range */
  end: Date;
  /** Human-readable label for the range (e.g., "May 5-11, 2025") */
  label: string;
}
