/**
 * Azure Function: DELETE /api/events/{id}
 *
 * Deletes a calendar event from the shared calendar.
 * Requires x-api-key header for authentication.
 */

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { getConfig } from '../../utils/env';
import { createLogger } from '../../utils/logger';
import { validateApiKey, getCorsHeaders } from '../../auth/apiKeyValidator';
import { deleteCalendarEvent, deleteEventsBySubject } from '../../graph/vacationService';
import { ApiError, ErrorCodes, createErrorResponse } from '../../models/ErrorResponse';

interface DeleteBySubjectInput {
  searchTerm: string;
}

/**
 * Handler for DELETE /api/events/{id}
 * Also supports POST /api/events/delete-by-subject for bulk deletion by subject search
 */
async function deleteEventHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const config = getConfig();
  const logger = createLogger(context, config.logLevel);
  const corsHeaders = getCorsHeaders(request, logger);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 204,
      headers: corsHeaders,
    };
  }

  logger.startOperation('deleteEvent');
  const startTime = Date.now();

  try {
    // Validate API key
    validateApiKey(request, logger);

    // Get event ID from route
    const eventId = request.params.id;

    if (!eventId) {
      throw new ApiError(ErrorCodes.ValidationError, 'Event ID is required', 400);
    }

    logger.info('Deleting calendar event', { eventId });

    await deleteCalendarEvent(eventId, logger);

    logger.endOperation('deleteEvent', startTime, { eventId });

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
      body: JSON.stringify({
        success: true,
        message: 'Event deleted successfully',
        eventId,
      }),
    };
  } catch (error) {
    logger.error('Delete event failed', {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    if (error instanceof ApiError) {
      return {
        status: error.statusCode,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
        body: JSON.stringify(error.toResponse()),
      };
    }

    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
      body: JSON.stringify(
        createErrorResponse(
          ErrorCodes.InternalError,
          'Failed to delete event. Please try again later.'
        )
      ),
    };
  }
}

/**
 * Handler for POST /api/events/delete-by-subject
 * Deletes events matching a subject search term
 */
async function deleteBySubjectHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const config = getConfig();
  const logger = createLogger(context, config.logLevel);
  const corsHeaders = getCorsHeaders(request, logger);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 204,
      headers: corsHeaders,
    };
  }

  logger.startOperation('deleteEventsBySubject');
  const startTime = Date.now();

  try {
    // Validate API key
    validateApiKey(request, logger);

    // Parse request body (use request.text() to support text/plain Content-Type
    // which the widget sends to avoid CORS preflight)
    const body = JSON.parse(await request.text()) as DeleteBySubjectInput;

    if (!body.searchTerm || body.searchTerm.trim().length < 2) {
      throw new ApiError(
        ErrorCodes.ValidationError,
        'searchTerm is required and must be at least 2 characters',
        400
      );
    }

    logger.info('Deleting events by subject', { searchTerm: body.searchTerm });

    const result = await deleteEventsBySubject(body.searchTerm.trim(), logger);

    logger.endOperation('deleteEventsBySubject', startTime, {
      searchTerm: body.searchTerm,
      deletedCount: result.deleted,
    });

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
      body: JSON.stringify({
        success: true,
        message: `Deleted ${result.deleted} event(s)`,
        ...result,
      }),
    };
  } catch (error) {
    logger.error('Delete events by subject failed', {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    if (error instanceof ApiError) {
      return {
        status: error.statusCode,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
        body: JSON.stringify(error.toResponse()),
      };
    }

    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
      body: JSON.stringify(
        createErrorResponse(
          ErrorCodes.InternalError,
          'Failed to delete events. Please try again later.'
        )
      ),
    };
  }
}

// Register the functions
app.http('deleteEvent', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'events/{id}',
  handler: deleteEventHandler,
});

app.http('deleteEventsBySubject', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'events/delete-by-subject',
  handler: deleteBySubjectHandler,
});

export { deleteEventHandler, deleteBySubjectHandler };
