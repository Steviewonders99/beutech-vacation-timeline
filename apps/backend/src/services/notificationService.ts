/**
 * Notification service for sending emails and Teams messages.
 * Uses Microsoft Graph API to send notifications about time-off requests.
 */

import { graphPost } from '../graph/graphClient';
import { Logger } from '../utils/logger';
import { TimeOffRequest } from '../models/TimeOffRequest';

/**
 * Email message structure for Graph API.
 */
interface GraphEmailMessage {
  message: {
    subject: string;
    body: {
      contentType: 'HTML' | 'Text';
      content: string;
    };
    toRecipients: Array<{
      emailAddress: {
        address: string;
      };
    }>;
  };
  saveToSentItems: boolean;
}

/**
 * Teams chat message structure for Graph API.
 */
interface TeamsActivityPayload {
  topic: {
    source: string;
    value: string;
    webUrl?: string;
  };
  activityType: string;
  previewText: {
    content: string;
  };
  templateParameters: Array<{
    name: string;
    value: string;
  }>;
}

/**
 * Formats a date for display in notifications.
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Calculates the number of days in a date range.
 */
function getDayCount(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both days
}

/**
 * Generates HTML email content for a new time-off request (sent to supervisor).
 */
function generateNewRequestEmailHtml(request: TimeOffRequest): string {
  const dayCount = getDayCount(request.startDate, request.endDate);
  const dayWord = dayCount === 1 ? 'day' : 'days';

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ed9236, #f5a623); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #fff; border: 1px solid #e5e5e5; border-top: none; padding: 20px; border-radius: 0 0 8px 8px; }
    .detail-row { display: flex; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
    .detail-label { font-weight: 600; width: 120px; color: #666; }
    .detail-value { flex: 1; }
    .action-section { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; }
    .footer { margin-top: 20px; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">New Time-Off Request</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">Awaiting your approval</p>
    </div>
    <div class="content">
      <p><strong>${request.requesterName}</strong> has submitted a time-off request that requires your approval.</p>

      <div class="detail-row">
        <span class="detail-label">Employee:</span>
        <span class="detail-value">${request.requesterName} (${request.requesterEmail})</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Leave Type:</span>
        <span class="detail-value" style="text-transform: capitalize;">${request.leaveType}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Dates:</span>
        <span class="detail-value">${formatDate(request.startDate)} - ${formatDate(request.endDate)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Duration:</span>
        <span class="detail-value">${dayCount} ${dayWord}</span>
      </div>
      ${request.reason ? `
      <div class="detail-row">
        <span class="detail-label">Reason:</span>
        <span class="detail-value">${request.reason}</span>
      </div>
      ` : ''}

      <div class="action-section">
        <p style="margin: 0;"><strong>Action Required:</strong> Please review and approve or reject this request in the Vacation Timeline widget.</p>
      </div>

      <div class="footer">
        <p>This is an automated message from the Beutech Vacation Timeline system.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generates HTML email content for an approved request (sent to requester).
 */
function generateApprovalEmailHtml(request: TimeOffRequest): string {
  const dayCount = getDayCount(request.startDate, request.endDate);
  const dayWord = dayCount === 1 ? 'day' : 'days';

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #fff; border: 1px solid #e5e5e5; border-top: none; padding: 20px; border-radius: 0 0 8px 8px; }
    .detail-row { display: flex; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
    .detail-label { font-weight: 600; width: 120px; color: #666; }
    .detail-value { flex: 1; }
    .success-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px; margin-top: 20px; }
    .footer { margin-top: 20px; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">Time-Off Request Approved!</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">Your request has been approved</p>
    </div>
    <div class="content">
      <p>Great news! Your time-off request has been <strong>approved</strong> by ${request.supervisorName || request.supervisorEmail}.</p>

      <div class="detail-row">
        <span class="detail-label">Leave Type:</span>
        <span class="detail-value" style="text-transform: capitalize;">${request.leaveType}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Dates:</span>
        <span class="detail-value">${formatDate(request.startDate)} - ${formatDate(request.endDate)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Duration:</span>
        <span class="detail-value">${dayCount} ${dayWord}</span>
      </div>

      <div class="success-box">
        <p style="margin: 0;"><strong>Calendar Event Created:</strong> This time off has been added to the vacation calendar.</p>
      </div>

      <div class="footer">
        <p>This is an automated message from the Beutech Vacation Timeline system.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generates HTML email content for a rejected request (sent to requester).
 */
function generateRejectionEmailHtml(request: TimeOffRequest): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #fff; border: 1px solid #e5e5e5; border-top: none; padding: 20px; border-radius: 0 0 8px 8px; }
    .detail-row { display: flex; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
    .detail-label { font-weight: 600; width: 120px; color: #666; }
    .detail-value { flex: 1; }
    .reason-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin-top: 20px; }
    .footer { margin-top: 20px; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">Time-Off Request Not Approved</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">Your request was not approved</p>
    </div>
    <div class="content">
      <p>Unfortunately, your time-off request has been <strong>declined</strong> by ${request.supervisorName || request.supervisorEmail}.</p>

      <div class="detail-row">
        <span class="detail-label">Leave Type:</span>
        <span class="detail-value" style="text-transform: capitalize;">${request.leaveType}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Dates:</span>
        <span class="detail-value">${formatDate(request.startDate)} - ${formatDate(request.endDate)}</span>
      </div>

      ${request.rejectionReason ? `
      <div class="reason-box">
        <p style="margin: 0;"><strong>Reason:</strong> ${request.rejectionReason}</p>
      </div>
      ` : ''}

      <p>Please contact your supervisor if you have questions or would like to discuss alternative dates.</p>

      <div class="footer">
        <p>This is an automated message from the Beutech Vacation Timeline system.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Sends an email via Microsoft Graph API.
 *
 * @param fromEmail - Email address to send from (must have Send.Mail permission)
 * @param toEmail - Recipient email address
 * @param subject - Email subject
 * @param htmlBody - HTML content of the email
 * @param logger - Optional logger instance
 */
export async function sendEmail(
  fromEmail: string,
  toEmail: string,
  subject: string,
  htmlBody: string,
  logger?: Logger
): Promise<void> {
  logger?.info('Sending email', { fromEmail, toEmail, subject });

  const message: GraphEmailMessage = {
    message: {
      subject,
      body: {
        contentType: 'HTML',
        content: htmlBody,
      },
      toRecipients: [
        {
          emailAddress: {
            address: toEmail,
          },
        },
      ],
    },
    saveToSentItems: false,
  };

  try {
    await graphPost(
      `/users/${encodeURIComponent(fromEmail)}/sendMail`,
      message,
      logger
    );
    logger?.info('Email sent successfully', { toEmail });
  } catch (error) {
    logger?.error('Failed to send email', {
      toEmail,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - notifications are best-effort
  }
}

/**
 * Sends a Teams activity notification to a user.
 *
 * @param userId - Microsoft 365 user ID to notify
 * @param title - Notification title
 * @param message - Notification message
 * @param logger - Optional logger instance
 */
export async function sendTeamsNotification(
  userId: string,
  title: string,
  message: string,
  logger?: Logger
): Promise<void> {
  logger?.info('Sending Teams notification', { userId, title });

  // Note: Teams notifications require the user to have Teams installed
  // and the app to have TeamsActivity.Send permission
  const payload: TeamsActivityPayload = {
    topic: {
      source: 'text',
      value: 'Vacation Timeline',
    },
    activityType: 'taskCreated',
    previewText: {
      content: message,
    },
    templateParameters: [
      { name: 'title', value: title },
      { name: 'message', value: message },
    ],
  };

  try {
    await graphPost(
      `/users/${userId}/teamwork/sendActivityNotification`,
      payload,
      logger
    );
    logger?.info('Teams notification sent successfully', { userId });
  } catch (error) {
    logger?.warn('Failed to send Teams notification (non-critical)', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - Teams notifications are optional
  }
}

/**
 * Notifies a supervisor of a new time-off request via email and Teams.
 *
 * @param request - The time-off request
 * @param senderEmail - Email to send from (typically a service account)
 * @param logger - Optional logger instance
 */
export async function notifySupervisorOfNewRequest(
  request: TimeOffRequest,
  senderEmail: string,
  logger?: Logger
): Promise<void> {
  logger?.info('Notifying supervisor of new request', {
    requestId: request.id,
    supervisorEmail: request.supervisorEmail,
  });

  const dayCount = getDayCount(request.startDate, request.endDate);
  const subject = `Time-Off Request: ${request.requesterName} - ${dayCount} day${dayCount > 1 ? 's' : ''}`;

  // Send email
  await sendEmail(
    senderEmail,
    request.supervisorEmail,
    subject,
    generateNewRequestEmailHtml(request),
    logger
  );

  // Send Teams notification if supervisor ID is available
  if (request.supervisorId) {
    const teamsMessage = `${request.requesterName} has requested ${dayCount} day${dayCount > 1 ? 's' : ''} off (${request.startDate} - ${request.endDate}). Please review and approve or reject.`;
    await sendTeamsNotification(
      request.supervisorId,
      'New Time-Off Request',
      teamsMessage,
      logger
    );
  }
}

/**
 * Notifies a requester that their request was approved.
 *
 * @param request - The approved time-off request
 * @param senderEmail - Email to send from
 * @param logger - Optional logger instance
 */
export async function notifyRequesterOfApproval(
  request: TimeOffRequest,
  senderEmail: string,
  logger?: Logger
): Promise<void> {
  logger?.info('Notifying requester of approval', {
    requestId: request.id,
    requesterEmail: request.requesterEmail,
  });

  const subject = `Time-Off Approved: ${formatDate(request.startDate)} - ${formatDate(request.endDate)}`;

  // Send email
  await sendEmail(
    senderEmail,
    request.requesterEmail,
    subject,
    generateApprovalEmailHtml(request),
    logger
  );

  // Send Teams notification if requester ID is available
  if (request.requesterId) {
    const teamsMessage = `Your time-off request for ${request.startDate} - ${request.endDate} has been approved!`;
    await sendTeamsNotification(
      request.requesterId,
      'Time-Off Approved',
      teamsMessage,
      logger
    );
  }
}

/**
 * Notifies a requester that their request was rejected.
 *
 * @param request - The rejected time-off request
 * @param senderEmail - Email to send from
 * @param logger - Optional logger instance
 */
export async function notifyRequesterOfRejection(
  request: TimeOffRequest,
  senderEmail: string,
  logger?: Logger
): Promise<void> {
  logger?.info('Notifying requester of rejection', {
    requestId: request.id,
    requesterEmail: request.requesterEmail,
  });

  const subject = `Time-Off Request Not Approved: ${formatDate(request.startDate)} - ${formatDate(request.endDate)}`;

  // Send email
  await sendEmail(
    senderEmail,
    request.requesterEmail,
    subject,
    generateRejectionEmailHtml(request),
    logger
  );

  // Send Teams notification if requester ID is available
  if (request.requesterId) {
    const teamsMessage = `Your time-off request for ${request.startDate} - ${request.endDate} was not approved.${request.rejectionReason ? ` Reason: ${request.rejectionReason}` : ''}`;
    await sendTeamsNotification(
      request.requesterId,
      'Time-Off Not Approved',
      teamsMessage,
      logger
    );
  }
}
