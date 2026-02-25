/**
 * Azure Function: GET /api/debug/headers
 *
 * TEMPORARY debug endpoint — echoes request headers back to the caller.
 * Uses Access-Control-Allow-Origin: * so it works regardless of origin.
 * DELETE THIS FILE after debugging is complete.
 */

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';

async function debugHeadersHandler(
  request: HttpRequest,
  _context: InvocationContext
): Promise<HttpResponseInit> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const url = new URL(request.url);

  return {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      method: request.method,
      url: request.url,
      hostname: url.hostname,
      requestHeaders: headers,
      origin: request.headers.get('Origin') || '(none)',
      userAgent: request.headers.get('User-Agent') || '(none)',
      referer: request.headers.get('Referer') || '(none)',
    }, null, 2),
  };
}

app.http('debugHeaders', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'debug/headers',
  handler: debugHeadersHandler,
});

export default debugHeadersHandler;
