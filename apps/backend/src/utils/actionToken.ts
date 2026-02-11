/**
 * Action Token utility for secure approve/reject links.
 *
 * Generates and validates signed tokens that allow managers to
 * approve or reject requests directly from email or Teams.
 */

import crypto from 'crypto';
import { getConfig } from './env';
import { DiagnosticCode } from './diagnostics';

/**
 * Action types that can be performed via token.
 * - 'approve': Directly approve the request
 * - 'reject': Directly reject (used internally after form submission)
 * - 'reject_form': Show rejection form to collect reason
 */
export type ActionType = 'approve' | 'reject' | 'reject_form';

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
 * Uses ACTION_TOKEN_SECRET if set, otherwise derives from API_KEY.
 */
function getSigningKey(): string {
  const config = getConfig();
  const explicitSecret = process.env.ACTION_TOKEN_SECRET;

  if (explicitSecret) {
    // Check if secret is strong enough
    if (explicitSecret.length < 32) {
      console.warn(`[${DiagnosticCode.ACTION_TOKEN_WEAK}] ACTION_TOKEN_SECRET is short (${explicitSecret.length} chars). Recommend 32+ characters for security.`);
    }
    return crypto
      .createHash('sha256')
      .update(explicitSecret)
      .digest('hex');
  }

  // Fallback: derive from API key (less secure, log warning)
  console.warn(`[${DiagnosticCode.ACTION_TOKEN_WEAK}] ACTION_TOKEN_SECRET not set. Deriving from API_KEY. Set ACTION_TOKEN_SECRET for better security.`);
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
    console.error(`[${DiagnosticCode.ACTION_TOKEN_WEAK}] Token format invalid: expected 2 parts, got ${parts.length}`);
    throw new Error('Invalid token format');
  }

  const [payloadB64, providedSignature] = parts;

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', getSigningKey())
    .update(payloadB64)
    .digest('base64url');

  if (providedSignature !== expectedSignature) {
    console.error(`[${DiagnosticCode.ACTION_TOKEN_WEAK}] Token signature mismatch. This can happen if ACTION_TOKEN_SECRET or API_KEY changed after the email was sent.`);
    throw new Error('Invalid token signature');
  }

  // Decode payload
  let payload: ActionTokenPayload;
  try {
    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    payload = JSON.parse(payloadStr);
  } catch (e) {
    console.error(`[${DiagnosticCode.ACTION_TOKEN_WEAK}] Failed to decode token payload: ${e instanceof Error ? e.message : String(e)}`);
    throw new Error('Invalid token payload');
  }

  // Check expiration
  if (Date.now() > payload.expiresAt) {
    const expiredAgo = Math.round((Date.now() - payload.expiresAt) / (1000 * 60 * 60));
    console.warn(`[${DiagnosticCode.ACTION_TOKEN_WEAK}] Token expired ${expiredAgo} hours ago. Tokens are valid for 24 hours.`);
    throw new Error('Token has expired');
  }

  // Validate required fields
  if (!payload.requestId || !payload.action || !payload.supervisorEmail) {
    console.error(`[${DiagnosticCode.ACTION_TOKEN_WEAK}] Token payload missing required fields: requestId=${!!payload.requestId}, action=${!!payload.action}, supervisorEmail=${!!payload.supervisorEmail}`);
    throw new Error('Invalid token payload');
  }

  if (payload.action !== 'approve' && payload.action !== 'reject' && payload.action !== 'reject_form') {
    console.error(`[${DiagnosticCode.ACTION_TOKEN_WEAK}] Invalid action type: ${payload.action}`);
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
  // Use 'reject_form' to show a form where supervisor can enter rejection reason
  const rejectToken = generateActionToken(requestId, 'reject_form', supervisorEmail);

  return {
    approveUrl: `${baseUrl}/requests/action?token=${encodeURIComponent(approveToken)}`,
    rejectUrl: `${baseUrl}/requests/action?token=${encodeURIComponent(rejectToken)}`,
  };
}
