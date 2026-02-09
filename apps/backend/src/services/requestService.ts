/**
 * Service for managing time-off requests.
 * Handles the business logic for creating, retrieving, approving, and rejecting requests.
 */

import { query, queryOne } from '../db/client';
import { getManager, getUserInfo } from '../graph/managerService';
import { graphPost } from '../graph/graphClient';
import {
  TimeOffRequest,
  TimeOffRequestRow,
  toTimeOffRequest,
  CreateTimeOffRequestInput,
  ListRequestsParams,
} from '../models/TimeOffRequest';
import { ApiError, ErrorCodes } from '../models/ErrorResponse';
import { Logger } from '../utils/logger';
import { getConfig } from '../utils/env';
import {
  notifySupervisorOfNewRequest,
  notifyRequesterOfApproval,
  notifyRequesterOfRejection,
} from './notificationService';

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
 * Creates a new time-off request.
 *
 * Process:
 * 1. Validate input (dates, format)
 * 2. Get requester's manager from Microsoft Graph
 * 3. Insert request into database
 * 4. Send notifications to supervisor
 *
 * @param input - Request creation input
 * @param logger - Optional logger instance
 * @returns The created request
 */
export async function createRequest(
  input: CreateTimeOffRequestInput,
  logger?: Logger
): Promise<TimeOffRequest> {
  logger?.startOperation('createRequest', {
    requesterEmail: input.requesterEmail,
    startDate: input.startDate,
    endDate: input.endDate,
  });

  const startTime = Date.now();

  // Validate dates
  if (!isValidDateFormat(input.startDate) || !isValidDateFormat(input.endDate)) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      'Dates must be in YYYY-MM-DD format',
      400
    );
  }

  if (new Date(input.endDate) < new Date(input.startDate)) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      'End date must be on or after start date',
      400
    );
  }

  if (!isNotInPast(input.startDate)) {
    throw new ApiError(
      ErrorCodes.ValidationError,
      'Start date cannot be in the past',
      400
    );
  }

  try {
    // Get requester's user info
    const requesterInfo = await getUserInfo(input.requesterEmail, logger);
    logger?.debug('Got requester info', { requesterId: requesterInfo.id });

    // Get manager (supervisor) from Microsoft Graph
    const manager = await getManager(input.requesterEmail, logger);
    logger?.debug('Got manager info', {
      managerEmail: manager.email,
      managerId: manager.id,
    });

    // Insert into database
    const sql = `
      INSERT INTO time_off_requests (
        requester_email, requester_name, requester_id,
        supervisor_email, supervisor_name, supervisor_id,
        start_date, end_date, leave_type, reason,
        status
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6,
        $7, $8, $9, $10,
        'pending'
      )
      RETURNING *
    `;

    const params = [
      input.requesterEmail,
      input.requesterName,
      requesterInfo.id,
      manager.email,
      manager.displayName,
      manager.id,
      input.startDate,
      input.endDate,
      input.leaveType || 'vacation',
      input.reason || null,
    ];

    const rows = await query<TimeOffRequestRow>(sql, params, logger);

    if (rows.length === 0) {
      throw new Error('Insert did not return a row');
    }

    const request = toTimeOffRequest(rows[0]);

    // Send notifications (async, don't block on failure)
    const config = getConfig();
    const senderEmail = config.vacationCalendarMailbox || input.requesterEmail;

    // Pass API base URL for actionable email buttons
    notifySupervisorOfNewRequest(request, senderEmail, config.apiBaseUrl, logger).catch((err) => {
      logger?.warn('Failed to send supervisor notification', {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    logger?.endOperation('createRequest', startTime, {
      requestId: request.id,
      supervisorEmail: request.supervisorEmail,
    });

    return request;
  } catch (error) {
    logger?.error('Failed to create request', {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      ErrorCodes.InternalError,
      `Failed to create time-off request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

/**
 * Lists time-off requests based on filters.
 *
 * @param params - Query parameters
 * @param logger - Optional logger instance
 * @returns Array of requests
 */
export async function listRequests(
  params: ListRequestsParams,
  logger?: Logger
): Promise<TimeOffRequest[]> {
  logger?.startOperation('listRequests', { ...params });
  const startTime = Date.now();

  try {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    // Filter by role
    if (params.role === 'requester') {
      conditions.push(`requester_email = $${paramIndex++}`);
      values.push(params.email);
    } else if (params.role === 'supervisor') {
      conditions.push(`supervisor_email = $${paramIndex++}`);
      values.push(params.email);
    }

    // Filter by status
    if (params.status && params.status !== 'all') {
      conditions.push(`status = $${paramIndex++}`);
      values.push(params.status);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate and sanitize limit/offset to prevent injection
    const limit = Math.min(Math.max(0, params.limit || 50), 100);
    const offset = Math.max(0, params.offset || 0);

    // Use parameterized queries for LIMIT and OFFSET to prevent SQL injection
    const sql = `
      SELECT *
      FROM time_off_requests
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++}
      OFFSET $${paramIndex++}
    `;
    values.push(limit, offset);

    const rows = await query<TimeOffRequestRow>(sql, values, logger);
    const requests = rows.map(toTimeOffRequest);

    logger?.endOperation('listRequests', startTime, {
      count: requests.length,
    });

    return requests;
  } catch (error) {
    logger?.error('Failed to list requests', {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    throw new ApiError(
      ErrorCodes.InternalError,
      'Failed to retrieve time-off requests',
      500
    );
  }
}

/**
 * Gets a single request by ID.
 *
 * @param id - Request UUID
 * @param logger - Optional logger instance
 * @returns The request or null if not found
 */
export async function getRequestById(
  id: string,
  logger?: Logger
): Promise<TimeOffRequest | null> {
  const sql = 'SELECT * FROM time_off_requests WHERE id = $1';
  const row = await queryOne<TimeOffRequestRow>(sql, [id], logger);

  return row ? toTimeOffRequest(row) : null;
}

/**
 * Creates a calendar event for an approved vacation.
 */
async function createCalendarEvent(
  request: TimeOffRequest,
  logger?: Logger
): Promise<string> {
  const config = getConfig();

  if (!config.vacationCalendarMailbox) {
    throw new ApiError(
      ErrorCodes.ConfigurationError,
      'Vacation calendar mailbox not configured',
      500
    );
  }

  logger?.info('Creating calendar event', {
    requestId: request.id,
    mailbox: config.vacationCalendarMailbox,
  });

  // Create all-day event
  const event = {
    subject: `${request.requesterName} - ${request.leaveType.charAt(0).toUpperCase() + request.leaveType.slice(1)}`,
    start: {
      dateTime: `${request.startDate}T00:00:00`,
      timeZone: config.defaultTimezone,
    },
    end: {
      // All-day events need end date to be the day AFTER the last day
      dateTime: `${addDays(request.endDate, 1)}T00:00:00`,
      timeZone: config.defaultTimezone,
    },
    isAllDay: true,
    showAs: 'oof', // Out of Office
    categories: [config.vacationCategory],
    body: {
      contentType: 'text',
      content: request.reason || `Time off: ${request.leaveType}`,
    },
  };

  interface CalendarEventResponse {
    id: string;
  }

  const response = await graphPost<CalendarEventResponse>(
    `/users/${config.vacationCalendarMailbox}/calendar/events`,
    event,
    logger
  );

  logger?.info('Calendar event created', {
    eventId: response.id,
    requestId: request.id,
  });

  return response.id;
}

/**
 * Adds days to a date string.
 */
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Approves a time-off request.
 *
 * Process:
 * 1. Verify request exists and is pending
 * 2. Verify supervisor matches
 * 3. Create calendar event in Microsoft Graph
 * 4. Update request status
 * 5. Notify requester
 *
 * @param requestId - UUID of the request to approve
 * @param supervisorEmail - Email of the approving supervisor
 * @param logger - Optional logger instance
 * @returns The approved request and calendar event ID
 */
export async function approveRequest(
  requestId: string,
  supervisorEmail: string,
  logger?: Logger
): Promise<{ request: TimeOffRequest; calendarEventId: string }> {
  logger?.startOperation('approveRequest', { requestId, supervisorEmail });
  const startTime = Date.now();

  try {
    // Get the request
    const request = await getRequestById(requestId, logger);

    if (!request) {
      throw new ApiError(
        ErrorCodes.NotFound,
        `Time-off request ${requestId} not found`,
        404
      );
    }

    // Verify it's still pending
    if (request.status !== 'pending') {
      throw new ApiError(
        ErrorCodes.BadRequest,
        `Request is already ${request.status}`,
        400
      );
    }

    // Verify supervisor
    if (request.supervisorEmail.toLowerCase() !== supervisorEmail.toLowerCase()) {
      throw new ApiError(
        ErrorCodes.Forbidden,
        'You are not authorized to approve this request',
        403
      );
    }

    // Create calendar event
    const calendarEventId = await createCalendarEvent(request, logger);

    // Update request status
    const updateSql = `
      UPDATE time_off_requests
      SET status = 'approved',
          status_changed_at = NOW(),
          status_changed_by = $2,
          calendar_event_id = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const rows = await query<TimeOffRequestRow>(
      updateSql,
      [requestId, supervisorEmail, calendarEventId],
      logger
    );

    if (rows.length === 0) {
      throw new Error('Update did not return a row');
    }

    const updatedRequest = toTimeOffRequest(rows[0]);

    // Send notification to requester (async)
    const config = getConfig();
    const senderEmail = config.vacationCalendarMailbox || supervisorEmail;

    notifyRequesterOfApproval(updatedRequest, senderEmail, logger).catch(
      (err) => {
        logger?.warn('Failed to send approval notification', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    );

    logger?.endOperation('approveRequest', startTime, {
      requestId,
      calendarEventId,
    });

    return { request: updatedRequest, calendarEventId };
  } catch (error) {
    logger?.error('Failed to approve request', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      ErrorCodes.InternalError,
      `Failed to approve request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

/**
 * Cancels a time-off request (by the requester).
 *
 * @param requestId - UUID of the request to cancel
 * @param requesterEmail - Email of the requester (must match)
 * @param logger - Optional logger instance
 * @returns The cancelled request
 */
export async function cancelRequest(
  requestId: string,
  requesterEmail: string,
  logger?: Logger
): Promise<TimeOffRequest> {
  logger?.startOperation('cancelRequest', { requestId, requesterEmail });
  const startTime = Date.now();

  try {
    // Get the request
    const request = await getRequestById(requestId, logger);

    if (!request) {
      throw new ApiError(
        ErrorCodes.NotFound,
        `Time-off request ${requestId} not found`,
        404
      );
    }

    // Verify it's still pending
    if (request.status !== 'pending') {
      throw new ApiError(
        ErrorCodes.BadRequest,
        `Cannot cancel a request that is already ${request.status}`,
        400
      );
    }

    // Verify requester owns this request
    if (request.requesterEmail.toLowerCase() !== requesterEmail.toLowerCase()) {
      throw new ApiError(
        ErrorCodes.Forbidden,
        'You can only cancel your own requests',
        403
      );
    }

    // Update request status to cancelled
    const updateSql = `
      UPDATE time_off_requests
      SET status = 'cancelled',
          status_changed_at = NOW(),
          status_changed_by = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const rows = await query<TimeOffRequestRow>(
      updateSql,
      [requestId, requesterEmail],
      logger
    );

    if (rows.length === 0) {
      throw new Error('Update did not return a row');
    }

    const updatedRequest = toTimeOffRequest(rows[0]);

    logger?.endOperation('cancelRequest', startTime, { requestId });

    return updatedRequest;
  } catch (error) {
    logger?.error('Failed to cancel request', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      ErrorCodes.InternalError,
      `Failed to cancel request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

/**
 * Checks if a user is a supervisor (has any requests where they are the supervisor).
 *
 * @param email - User's email address
 * @param logger - Optional logger instance
 * @returns True if user is a supervisor
 */
export async function checkIsSupervisor(
  email: string,
  logger?: Logger
): Promise<boolean> {
  try {
    const sql = `
      SELECT EXISTS(
        SELECT 1 FROM time_off_requests
        WHERE supervisor_email = $1
        LIMIT 1
      ) as is_supervisor
    `;

    const rows = await query<{ is_supervisor: boolean }>(sql, [email], logger);
    return rows[0]?.is_supervisor || false;
  } catch (error) {
    logger?.error('Failed to check supervisor status', {
      email,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Rejects a time-off request.
 *
 * @param requestId - UUID of the request to reject
 * @param supervisorEmail - Email of the rejecting supervisor
 * @param reason - Optional reason for rejection
 * @param logger - Optional logger instance
 * @returns The rejected request
 */
export async function rejectRequest(
  requestId: string,
  supervisorEmail: string,
  reason?: string,
  logger?: Logger
): Promise<TimeOffRequest> {
  logger?.startOperation('rejectRequest', { requestId, supervisorEmail });
  const startTime = Date.now();

  try {
    // Get the request
    const request = await getRequestById(requestId, logger);

    if (!request) {
      throw new ApiError(
        ErrorCodes.NotFound,
        `Time-off request ${requestId} not found`,
        404
      );
    }

    // Verify it's still pending
    if (request.status !== 'pending') {
      throw new ApiError(
        ErrorCodes.BadRequest,
        `Request is already ${request.status}`,
        400
      );
    }

    // Verify supervisor
    if (request.supervisorEmail.toLowerCase() !== supervisorEmail.toLowerCase()) {
      throw new ApiError(
        ErrorCodes.Forbidden,
        'You are not authorized to reject this request',
        403
      );
    }

    // Update request status
    const updateSql = `
      UPDATE time_off_requests
      SET status = 'rejected',
          status_changed_at = NOW(),
          status_changed_by = $2,
          rejection_reason = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const rows = await query<TimeOffRequestRow>(
      updateSql,
      [requestId, supervisorEmail, reason || null],
      logger
    );

    if (rows.length === 0) {
      throw new Error('Update did not return a row');
    }

    const updatedRequest = toTimeOffRequest(rows[0]);

    // Send notification to requester (async)
    const config = getConfig();
    const senderEmail = config.vacationCalendarMailbox || supervisorEmail;

    notifyRequesterOfRejection(updatedRequest, senderEmail, logger).catch(
      (err) => {
        logger?.warn('Failed to send rejection notification', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    );

    logger?.endOperation('rejectRequest', startTime, { requestId });

    return updatedRequest;
  } catch (error) {
    logger?.error('Failed to reject request', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      ErrorCodes.InternalError,
      `Failed to reject request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}
