/**
 * Service for fetching user information from Microsoft Graph.
 */

import { graphGet, graphGetWithParams } from './graphClient';
import { Logger } from '../utils/logger';
import { M365User, GraphUser, toM365User } from '../models/User';
import { ApiError, ErrorCodes } from '../models/ErrorResponse';

/**
 * Graph API response for users list.
 */
interface UsersResponse {
  value: GraphUser[];
  '@odata.nextLink'?: string;
}

/**
 * Gets a user by their email or ID.
 */
export async function getUser(
  userId: string,
  logger?: Logger
): Promise<M365User | null> {
  logger?.debug('Fetching user', { userId });

  try {
    const graphUser = await graphGet<GraphUser>(
      `/users/${userId}?$select=id,userPrincipalName,displayName,mail,jobTitle,department`,
      logger
    );

    return toM365User(graphUser);
  } catch (error) {
    logger?.warn('Failed to fetch user', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Gets multiple users by their emails or IDs.
 */
export async function getUsers(
  userIds: string[],
  logger?: Logger
): Promise<M365User[]> {
  if (userIds.length === 0) {
    return [];
  }

  logger?.debug('Fetching users', { count: userIds.length });

  // Fetch users in parallel
  const results = await Promise.all(
    userIds.map((id) => getUser(id, logger))
  );

  // Filter out nulls (users that couldn't be found)
  return results.filter((user): user is M365User => user !== null);
}

/**
 * Lists users from the organization.
 * Note: Requires User.Read.All permission.
 */
export async function listUsers(
  options: {
    filter?: string;
    top?: number;
    select?: string[];
  } = {},
  logger?: Logger
): Promise<M365User[]> {
  const { filter, top = 100, select } = options;

  logger?.debug('Listing users', { filter, top });

  try {
    const params: Record<string, string> = {
      $top: String(top),
      $select: select?.join(',') || 'id,userPrincipalName,displayName,mail,jobTitle,department',
    };

    if (filter) {
      params.$filter = filter;
    }

    const response = await graphGetWithParams<UsersResponse>('/users', params, logger);

    return response.value.map(toM365User);
  } catch (error) {
    logger?.error('Failed to list users', {
      error: error instanceof Error ? error.message : String(error),
    });

    throw new ApiError(
      ErrorCodes.GraphError,
      `Failed to list users: ${error instanceof Error ? error.message : 'Unknown error'}`,
      502
    );
  }
}

/**
 * Enriches vacation events with user display names.
 * Useful when events only contain email addresses.
 */
export async function enrichWithUserNames(
  events: Array<{ userId: string; userDisplayName: string }>,
  logger?: Logger
): Promise<void> {
  // Get unique user IDs that need enrichment
  const userIdsToFetch = [...new Set(
    events
      .filter((e) => !e.userDisplayName || e.userDisplayName === e.userId)
      .map((e) => e.userId)
  )];

  if (userIdsToFetch.length === 0) {
    return;
  }

  logger?.debug('Enriching events with user names', {
    userCount: userIdsToFetch.length,
  });

  // Fetch user info
  const users = await getUsers(userIdsToFetch, logger);
  const userMap = new Map(users.map((u) => [u.userPrincipalName.toLowerCase(), u]));

  // Update events with display names
  events.forEach((event) => {
    const user = userMap.get(event.userId.toLowerCase());
    if (user) {
      event.userDisplayName = user.displayName;
    }
  });
}
