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
 * Types for time-off request functionality.
 */

/**
 * Status of a time-off request.
 */
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/**
 * Type of leave being requested.
 */
export type LeaveType = 'vacation' | 'sick' | 'personal' | 'other';

/**
 * Represents a time-off request.
 */
export interface TimeOffRequest {
  /** Unique identifier (UUID) */
  id: string;
  /** Email of the person requesting time off */
  requesterEmail: string;
  /** Display name of the requester */
  requesterName: string;
  /** Microsoft 365 user ID of the requester */
  requesterId?: string;
  /** Email of the supervisor who needs to approve */
  supervisorEmail: string;
  /** Display name of the supervisor */
  supervisorName?: string;
  /** Microsoft 365 user ID of the supervisor */
  supervisorId?: string;
  /** Start date of the time off (YYYY-MM-DD) */
  startDate: string;
  /** End date of the time off (YYYY-MM-DD) */
  endDate: string;
  /** Type of leave */
  leaveType: LeaveType;
  /** Optional reason or notes for the request */
  reason?: string;
  /** Current status of the request */
  status: RequestStatus;
  /** When the status was last changed (ISO timestamp) */
  statusChangedAt?: string;
  /** Who changed the status (email) */
  statusChangedBy?: string;
  /** Reason for rejection (if rejected) */
  rejectionReason?: string;
  /** Microsoft Graph calendar event ID (created on approval) */
  calendarEventId?: string;
  /** When the request was created (ISO timestamp) */
  createdAt: string;
  /** When the request was last updated (ISO timestamp) */
  updatedAt: string;
}

/**
 * Input for creating a new time-off request.
 */
export interface CreateTimeOffRequestInput {
  /** Email of the person requesting time off */
  requesterEmail: string;
  /** Display name of the requester */
  requesterName: string;
  /** Start date (YYYY-MM-DD) */
  startDate: string;
  /** End date (YYYY-MM-DD) */
  endDate: string;
  /** Type of leave (defaults to 'vacation') */
  leaveType?: LeaveType;
  /** Optional reason or notes */
  reason?: string;
}

/**
 * Response when creating a time-off request.
 */
export interface CreateTimeOffResponse {
  request: TimeOffRequest;
  message: string;
}

/**
 * Response when listing time-off requests.
 */
export interface ListTimeOffResponse {
  requests: TimeOffRequest[];
  count: number;
}

/**
 * Response when approving a request.
 */
export interface ApproveTimeOffResponse {
  request: TimeOffRequest;
  calendarEventId: string;
  message: string;
}

/**
 * Response when rejecting a request.
 */
export interface RejectTimeOffResponse {
  request: TimeOffRequest;
  message: string;
}

/**
 * Parameters for listing requests.
 */
export interface ListRequestsParams {
  /** Filter by role: requester or supervisor */
  role: 'requester' | 'supervisor';
  /** Email of the user making the query */
  email: string;
  /** Filter by status (optional) */
  status?: RequestStatus | 'all';
}
