/**
 * Azure Function: POST /api/events/rename
 *
 * One-time migration endpoint to rename calendar event subjects.
 * Searches for events containing a term and replaces old text with new text.
 * Supports dry-run mode to preview changes before applying.
 *
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
import { renameEventSubjects } from '../../graph/vacationService';
import { ApiError, ErrorCodes, createErrorResponse } from '../../models/ErrorResponse';

interface RenameEventsInput {
  searchTerm: string;
  oldText: string;
  newText: string;
  dryRun?: boolean;
}

async function renameEventsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const config = getConfig();
  const logger = createLogger(context, config.logLevel);
  const corsHeaders = getCorsHeaders(request, logger);

  if (request.method === 'OPTIONS') {
    return { status: 204, headers: corsHeaders };
  }

  logger.startOperation('renameEvents');
  const startTime = Date.now();

  try {
    validateApiKey(request, logger);

    const body = JSON.parse(await request.text()) as RenameEventsInput;

    if (!body.searchTerm || !body.oldText || !body.newText) {
      throw new ApiError(
        ErrorCodes.ValidationError,
        'searchTerm, oldText, and newText are all required',
        400
      );
    }

    const dryRun = body.dryRun !== false; // default to dry-run for safety

    logger.info('Renaming calendar events', {
      searchTerm: body.searchTerm,
      oldText: body.oldText,
      newText: body.newText,
      dryRun,
    });

    const result = await renameEventSubjects(
      body.searchTerm.trim(),
      body.oldText,
      body.newText,
      dryRun,
      logger
    );

    logger.endOperation('renameEvents', startTime, {
      renamedCount: result.renamed,
      dryRun,
    });

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({
        success: true,
        dryRun,
        message: dryRun
          ? `Found ${result.renamed} event(s) that would be renamed`
          : `Renamed ${result.renamed} event(s)`,
        ...result,
      }),
    };
  } catch (error) {
    logger.error('Rename events failed', {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    if (error instanceof ApiError) {
      return {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify(error.toResponse()),
      };
    }

    return {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify(
        createErrorResponse(
          ErrorCodes.InternalError,
          'Failed to rename events. Please try again later.'
        )
      ),
    };
  }
}

app.http('renameEvents', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'events/rename',
  handler: renameEventsHandler,
});

export default renameEventsHandler;
