/**
 * Service for fetching manager information from Microsoft Graph.
 * Used to determine the supervisor for time-off request approvals.
 */

import { graphGet } from './graphClient';
import { Logger } from '../utils/logger';
import { ApiError, ErrorCodes } from '../models/ErrorResponse';

/**
 * Manager information from Microsoft Graph.
 */
export interface ManagerInfo {
  /** Microsoft 365 user ID */
  id: string;
  /** Email address (UPN) */
  email: string;
  /** Display name */
  displayName: string;
}

/**
 * Raw Graph API response for manager endpoint.
 */
interface GraphManagerResponse {
  id: string;
  mail?: string;
  userPrincipalName: string;
  displayName: string;
}

/**
 * Gets the manager of a user from Microsoft Graph.
 *
 * @param userEmail - Email or UPN of the user to get the manager for
 * @param logger - Optional logger instance
 * @returns Manager information
 * @throws ApiError if user has no manager or user not found
 *
 * @example
 * ```typescript
 * const manager = await getManager('john.doe@company.com', logger);
 * console.log(manager.email); // 'jane.smith@company.com'
 * ```
 */
export async function getManager(
  userEmail: string,
  logger?: Logger
): Promise<ManagerInfo> {
  logger?.startOperation('getManager', { userEmail });
  const startTime = Date.now();

  try {
    const endpoint = `/users/${encodeURIComponent(userEmail)}/manager`;

    const response = await graphGet<GraphManagerResponse>(endpoint, logger);

    const manager: ManagerInfo = {
      id: response.id,
      email: response.mail || response.userPrincipalName,
      displayName: response.displayName,
    };

    logger?.endOperation('getManager', startTime, {
      managerEmail: manager.email,
    });

    return manager;
  } catch (error) {
    logger?.error('Failed to get manager', {
      userEmail,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    // Check if it's a "no manager" error (404 or specific error code)
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('404') || errorMessage.includes('Resource not found') || errorMessage.includes('does not exist')) {
      throw new ApiError(
        ErrorCodes.NotFound,
        `No manager found for user ${userEmail}. Please ensure the user has a manager assigned in Azure AD.`,
        404
      );
    }

    throw new ApiError(
      ErrorCodes.GraphError,
      `Failed to retrieve manager for ${userEmail}: ${errorMessage}`,
      502
    );
  }
}

/**
 * Gets user information from Microsoft Graph.
 *
 * @param userEmail - Email or UPN of the user
 * @param logger - Optional logger instance
 * @returns User information including ID
 */
export async function getUserInfo(
  userEmail: string,
  logger?: Logger
): Promise<{ id: string; email: string; displayName: string; department?: string }> {
  logger?.debug('Getting user info', { userEmail });

  try {
    const endpoint = `/users/${encodeURIComponent(userEmail)}?$select=id,mail,userPrincipalName,displayName,department`;

    interface GraphUserResponse {
      id: string;
      mail?: string;
      userPrincipalName: string;
      displayName: string;
      department?: string;
    }

    const response = await graphGet<GraphUserResponse>(endpoint, logger);

    return {
      id: response.id,
      email: response.mail || response.userPrincipalName,
      displayName: response.displayName,
      department: response.department,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    throw new ApiError(
      ErrorCodes.GraphError,
      `Failed to retrieve user info for ${userEmail}: ${errorMessage}`,
      502
    );
  }
}
