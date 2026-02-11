/**
 * Microsoft Graph client with client-credential authentication.
 * Uses Azure Identity for token acquisition.
 */

import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { getConfig } from '../utils/env';
import { Logger } from '../utils/logger';
import { diagnoseGraphError, logDiagnostic, runStartupDiagnostics } from '../utils/diagnostics';

/**
 * Graph client instance (singleton pattern).
 */
let graphClientInstance: Client | null = null;

/**
 * Creates and configures a Microsoft Graph client using client credentials flow.
 * This is suitable for daemon/service applications that don't require user interaction.
 */
export function getGraphClient(logger?: Logger): Client {
  // Run startup diagnostics on first Graph client creation
  runStartupDiagnostics(logger);

  if (graphClientInstance) {
    return graphClientInstance;
  }

  const config = getConfig();

  logger?.debug('Initializing Graph client', {
    tenantId: config.tenantId,
    clientId: config.clientId,
    hasClientSecret: !!config.clientSecret,
    clientSecretLength: config.clientSecret?.length || 0,
  });

  // Create credential using client secret
  const credential = new ClientSecretCredential(
    config.tenantId,
    config.clientId,
    config.clientSecret
  );

  // Create authentication provider
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  });

  // Create Graph client
  graphClientInstance = Client.initWithMiddleware({
    authProvider,
    debugLogging: false,
  });

  logger?.info('Graph client initialized successfully');

  return graphClientInstance;
}

/**
 * Resets the Graph client instance (useful for testing).
 */
export function resetGraphClient(): void {
  graphClientInstance = null;
}

/**
 * Makes a GET request to the Graph API.
 */
export async function graphGet<T>(
  endpoint: string,
  logger?: Logger
): Promise<T> {
  const client = getGraphClient(logger);
  const startTime = Date.now();

  try {
    logger?.debug('Graph GET request', { endpoint });
    const response = await client.api(endpoint).get();
    logger?.debug('Graph GET response', {
      endpoint,
      durationMs: Date.now() - startTime,
    });
    return response as T;
  } catch (error) {
    const diagnostic = diagnoseGraphError(error, `GET ${endpoint}`);
    logDiagnostic(logger, diagnostic.code, {
      ...diagnostic.context,
      endpoint,
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}

/**
 * Makes a GET request with query parameters.
 */
export async function graphGetWithParams<T>(
  endpoint: string,
  params: Record<string, string>,
  logger?: Logger
): Promise<T> {
  const client = getGraphClient(logger);
  const startTime = Date.now();

  try {
    logger?.debug('Graph GET request with params', { endpoint, params });

    let request = client.api(endpoint);

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      request = request.query({ [key]: value });
    });

    const response = await request.get();

    logger?.debug('Graph GET response', {
      endpoint,
      durationMs: Date.now() - startTime,
    });

    return response as T;
  } catch (error) {
    const diagnostic = diagnoseGraphError(error, `GET ${endpoint} (with params)`);
    logDiagnostic(logger, diagnostic.code, {
      ...diagnostic.context,
      endpoint,
      params,
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}

/**
 * Makes a POST request to the Graph API.
 */
export async function graphPost<T>(
  endpoint: string,
  body: unknown,
  logger?: Logger
): Promise<T> {
  const client = getGraphClient(logger);
  const startTime = Date.now();

  try {
    logger?.debug('Graph POST request', { endpoint });
    const response = await client.api(endpoint).post(body);
    logger?.debug('Graph POST response', {
      endpoint,
      durationMs: Date.now() - startTime,
    });
    return response as T;
  } catch (error) {
    const diagnostic = diagnoseGraphError(error, `POST ${endpoint}`);
    logDiagnostic(logger, diagnostic.code, {
      ...diagnostic.context,
      endpoint,
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}

/**
 * Makes a PATCH request to the Graph API.
 */
export async function graphPatch<T>(
  endpoint: string,
  body: unknown,
  logger?: Logger
): Promise<T> {
  const client = getGraphClient(logger);
  const startTime = Date.now();

  try {
    logger?.debug('Graph PATCH request', { endpoint });
    const response = await client.api(endpoint).patch(body);
    logger?.debug('Graph PATCH response', {
      endpoint,
      durationMs: Date.now() - startTime,
    });
    return response as T;
  } catch (error) {
    const diagnostic = diagnoseGraphError(error, `PATCH ${endpoint}`);
    logDiagnostic(logger, diagnostic.code, {
      ...diagnostic.context,
      endpoint,
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}

/**
 * Makes a DELETE request to the Graph API.
 */
export async function graphDelete(
  endpoint: string,
  logger?: Logger
): Promise<void> {
  const client = getGraphClient(logger);
  const startTime = Date.now();

  try {
    logger?.debug('Graph DELETE request', { endpoint });
    await client.api(endpoint).delete();
    logger?.debug('Graph DELETE completed', {
      endpoint,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    const diagnostic = diagnoseGraphError(error, `DELETE ${endpoint}`);
    logDiagnostic(logger, diagnostic.code, {
      ...diagnostic.context,
      endpoint,
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}
