/**
 * User model for Microsoft Graph users.
 */

/**
 * Represents a Microsoft 365 user.
 */
export interface M365User {
  /** User's Object ID */
  id: string;
  /** User Principal Name (usually email) */
  userPrincipalName: string;
  /** Display name */
  displayName: string;
  /** Email address */
  mail?: string;
  /** Job title */
  jobTitle?: string;
  /** Department */
  department?: string;
}

/**
 * Raw user from Microsoft Graph API.
 */
export interface GraphUser {
  id: string;
  userPrincipalName: string;
  displayName: string;
  mail?: string;
  jobTitle?: string;
  department?: string;
}

/**
 * Transforms a Graph user to our M365User format.
 */
export function toM365User(graphUser: GraphUser): M365User {
  return {
    id: graphUser.id,
    userPrincipalName: graphUser.userPrincipalName,
    displayName: graphUser.displayName,
    mail: graphUser.mail,
    jobTitle: graphUser.jobTitle,
    department: graphUser.department,
  };
}
