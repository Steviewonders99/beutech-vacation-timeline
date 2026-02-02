/**
 * Action Token utility for secure approve/reject links.
 *
 * Generates and validates signed tokens that allow managers to
 * approve or reject requests directly from email or Teams.
 */

import crypto from 'crypto';
import { getConfig } from './env';

/**
 * Action types that can be performed via token.
 */
export type ActionType = 'approve' | 'reject';

/**
 * Payload encoded in the action token.
 */
export interface ActionTokenPayload {
  /** Request ID */
  requestId: string;
  /** Action to perform */
  action: ActionType;
  /** Supervisor email (for verification) */
  supervisorEmail: string;
  /** Token expiration timestamp (ms) */
  expiresAt: number;
}

/**
 * Token expiration time (24 hours).
 */
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Gets the secret key for signing tokens.
 * Uses API_KEY as the base and derives a signing key from it.
 */
function getSigningKey(): string {
  const config = getConfig();
  // Derive a signing key from the API key
  return crypto
    .createHash('sha256')
    .update(`action-token-${config.apiKey}`)
    .digest('hex');
}

/**
 * Generates a signed action token.
 *
 * @param requestId - The request ID to act on
 * @param action - The action to perform (approve/reject)
 * @param supervisorEmail - Email of the supervisor
 * @returns Base64URL-encoded signed token
 */
export function generateActionToken(
  requestId: string,
  action: ActionType,
  supervisorEmail: string
): string {
  const payload: ActionTokenPayload = {
    requestId,
    action,
    supervisorEmail: supervisorEmail.toLowerCase(),
    expiresAt: Date.now() + TOKEN_EXPIRY_MS,
  };

  // Encode payload
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr).toString('base64url');

  // Create signature
  const signature = crypto
    .createHmac('sha256', getSigningKey())
    .update(payloadB64)
    .digest('base64url');

  // Return token as payload.signature
  return `${payloadB64}.${signature}`;
}

/**
 * Validates and decodes an action token.
 *
 * @param token - The token to validate
 * @returns The decoded payload if valid
 * @throws Error if token is invalid or expired
 */
export function validateActionToken(token: string): ActionTokenPayload {
  // Split token into payload and signature
  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid token format');
  }

  const [payloadB64, providedSignature] = parts;

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', getSigningKey())
    .update(payloadB64)
    .digest('base64url');

  if (providedSignature !== expectedSignature) {
    throw new Error('Invalid token signature');
  }

  // Decode payload
  let payload: ActionTokenPayload;
  try {
    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    payload = JSON.parse(payloadStr);
  } catch {
    throw new Error('Invalid token payload');
  }

  // Check expiration
  if (Date.now() > payload.expiresAt) {
    throw new Error('Token has expired');
  }

  // Validate required fields
  if (!payload.requestId || !payload.action || !payload.supervisorEmail) {
    throw new Error('Invalid token payload');
  }

  if (payload.action !== 'approve' && payload.action !== 'reject') {
    throw new Error('Invalid action type');
  }

  return payload;
}

/**
 * Generates approve and reject URLs for a request.
 *
 * @param baseUrl - The API base URL
 * @param requestId - The request ID
 * @param supervisorEmail - The supervisor's email
 * @returns Object containing approve and reject URLs
 */
export function generateActionUrls(
  baseUrl: string,
  requestId: string,
  supervisorEmail: string
): { approveUrl: string; rejectUrl: string } {
  const approveToken = generateActionToken(requestId, 'approve', supervisorEmail);
  const rejectToken = generateActionToken(requestId, 'reject', supervisorEmail);

  return {
    approveUrl: `${baseUrl}/requests/action?token=${encodeURIComponent(approveToken)}`,
    rejectUrl: `${baseUrl}/requests/action?token=${encodeURIComponent(rejectToken)}`,
  };
}
