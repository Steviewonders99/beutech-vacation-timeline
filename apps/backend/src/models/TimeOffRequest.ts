/**
 * Time-off request models for the approval workflow system.
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
 * Represents a time-off request in the system.
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

  /** Start date of the time off (ISO date string, YYYY-MM-DD) */
  startDate: string;

  /** End date of the time off (ISO date string, YYYY-MM-DD) */
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

  /** Start date (ISO date string, YYYY-MM-DD) */
  startDate: string;

  /** End date (ISO date string, YYYY-MM-DD) */
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
  /** The created request */
  request: TimeOffRequest;

  /** Success message */
  message: string;
}

/**
 * Response when listing time-off requests.
 */
export interface ListTimeOffResponse {
  /** Array of requests */
  requests: TimeOffRequest[];

  /** Total count of requests matching the query */
  count: number;
}

/**
 * Response when approving a request.
 */
export interface ApproveTimeOffResponse {
  /** The approved request */
  request: TimeOffRequest;

  /** Microsoft Graph calendar event ID */
  calendarEventId: string;

  /** Success message */
  message: string;
}

/**
 * Response when rejecting a request.
 */
export interface RejectTimeOffResponse {
  /** The rejected request */
  request: TimeOffRequest;

  /** Success message */
  message: string;
}

/**
 * Query parameters for listing requests.
 */
export interface ListRequestsParams {
  /** Filter by role: requester or supervisor */
  role: 'requester' | 'supervisor';

  /** Email of the user making the query */
  email: string;

  /** Filter by status (optional) */
  status?: RequestStatus | 'all';

  /** Maximum number of results (default 50) */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Input for approving a request.
 */
export interface ApproveRequestInput {
  /** Email of the supervisor approving */
  supervisorEmail: string;
}

/**
 * Input for rejecting a request.
 */
export interface RejectRequestInput {
  /** Email of the supervisor rejecting */
  supervisorEmail: string;

  /** Optional reason for rejection */
  reason?: string;
}

/**
 * Database row shape (snake_case).
 */
export interface TimeOffRequestRow {
  id: string;
  requester_email: string;
  requester_name: string;
  requester_id: string | null;
  supervisor_email: string;
  supervisor_name: string | null;
  supervisor_id: string | null;
  start_date: string;
  end_date: string;
  leave_type: LeaveType;
  reason: string | null;
  status: RequestStatus;
  status_changed_at: string | null;
  status_changed_by: string | null;
  rejection_reason: string | null;
  calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Normalizes a date value to YYYY-MM-DD string.
 * The pg driver returns DATE columns as JavaScript Date objects at runtime,
 * even though the TypeScript interface declares them as strings.
 */
function toDateString(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return value;
}

/**
 * Transforms a database row to a TimeOffRequest object.
 */
export function toTimeOffRequest(row: TimeOffRequestRow): TimeOffRequest {
  return {
    id: row.id,
    requesterEmail: row.requester_email,
    requesterName: row.requester_name,
    requesterId: row.requester_id ?? undefined,
    supervisorEmail: row.supervisor_email,
    supervisorName: row.supervisor_name ?? undefined,
    supervisorId: row.supervisor_id ?? undefined,
    startDate: toDateString(row.start_date),
    endDate: toDateString(row.end_date),
    leaveType: row.leave_type,
    reason: row.reason ?? undefined,
    status: row.status,
    statusChangedAt: row.status_changed_at ?? undefined,
    statusChangedBy: row.status_changed_by ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    calendarEventId: row.calendar_event_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
