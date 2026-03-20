/**
 * Notification service for sending emails and Teams messages.
 * Uses Microsoft Graph API to send notifications about time-off requests.
 *
 * Features:
 * - Email notifications with actionable Approve/Reject buttons
 * - Teams Adaptive Cards with action buttons
 * - Secure token-based action links (24hr expiry)
 */

import { graphPost } from '../graph/graphClient';
import { Logger } from '../utils/logger';
import { TimeOffRequest } from '../models/TimeOffRequest';
import { generateActionUrls } from '../utils/actionToken';
import { logDiagnostic, DiagnosticCode } from '../utils/diagnostics';

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
 * Calculates the number of business days (Mon–Fri) in a date range.
 * Excludes weekends so email day counts match actual working days off.
 * Uses UTC methods because YYYY-MM-DD strings are parsed as UTC midnight.
 */
function getDayCount(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getUTCDay(); // 0=Sun, 6=Sat
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return Math.max(count, 1); // At minimum 1 day
}

/**
 * Generates HTML email content for a new time-off request (sent to supervisor).
 * Includes actionable Approve/Reject buttons.
 */
function generateNewRequestEmailHtml(
  request: TimeOffRequest,
  actionUrls?: { approveUrl: string; rejectUrl: string }
): string {
  const dayCount = getDayCount(request.startDate, request.endDate);
  const dayWord = dayCount === 1 ? 'day' : 'days';

  // Outlook-compatible action buttons using tables and VML
  // Note: Outlook doesn't support CSS gradients, border-radius on buttons, or display:inline-block reliably
  const actionButtonsHtml = actionUrls
    ? `
      <!--[if mso]>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 8px;">
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${actionUrls.approveUrl}" style="height:48px;v-text-anchor:middle;width:180px;" arcsize="17%" strokecolor="#16a34a" fillcolor="#22c55e">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">&#10003; Approve</center>
                  </v:roundrect>
                </td>
                <td style="padding: 8px;">
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${actionUrls.rejectUrl}" style="height:48px;v-text-anchor:middle;width:180px;" arcsize="17%" strokecolor="#dc2626" fillcolor="#ef4444">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">&#10007; Decline</center>
                  </v:roundrect>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <![endif]-->
      <!--[if !mso]><!-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 8px;">
                  <a href="${actionUrls.approveUrl}" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; background-color: #22c55e; color: #ffffff; mso-padding-alt: 0; text-align: center;">
                    <!--[if mso]><i style="letter-spacing: 32px; mso-font-width: -100%; mso-text-raise: 30pt;">&nbsp;</i><![endif]-->
                    <span style="mso-text-raise: 15pt;">&#10003; Approve</span>
                    <!--[if mso]><i style="letter-spacing: 32px; mso-font-width: -100%;">&nbsp;</i><![endif]-->
                  </a>
                </td>
                <td style="padding: 8px;">
                  <a href="${actionUrls.rejectUrl}" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; background-color: #ef4444; color: #ffffff; mso-padding-alt: 0; text-align: center;">
                    <!--[if mso]><i style="letter-spacing: 32px; mso-font-width: -100%; mso-text-raise: 30pt;">&nbsp;</i><![endif]-->
                    <span style="mso-text-raise: 15pt;">&#10007; Decline</span>
                    <!--[if mso]><i style="letter-spacing: 32px; mso-font-width: -100%;">&nbsp;</i><![endif]-->
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!--<![endif]-->
      <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 12px;">
        These action links expire in 24 hours
      </p>
    `
    : `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px;">
        <tr>
          <td style="padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0;"><strong>Action Required:</strong> Please review and approve or reject this request in the Vacation Timeline widget.</p>
          </td>
        </tr>
      </table>
    `;

  // Outlook-compatible email using tables for layout
  return `
<!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
  <style type="text/css">
    body { margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333333; }
    table { border-collapse: collapse; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
    a { color: inherit; text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; }
      .button { width: 100% !important; display: block !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 20px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #ed9236; padding: 24px 30px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #ffffff;">New Time-Off Request</h1>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #ffffff; opacity: 0.9;">Awaiting your approval</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">
                <strong>${request.requesterName}</strong> has submitted a time-off request that requires your approval.
              </p>

              <!-- Details Table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="120" style="font-weight: 600; color: #666666; font-size: 14px;">Employee:</td>
                        <td style="color: #333333; font-size: 14px;">${request.requesterName} (${request.requesterEmail})</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="120" style="font-weight: 600; color: #666666; font-size: 14px;">Leave Type:</td>
                        <td style="color: #333333; font-size: 14px; text-transform: capitalize;">${request.leaveType}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="120" style="font-weight: 600; color: #666666; font-size: 14px;">Dates:</td>
                        <td style="color: #333333; font-size: 14px;">${formatDate(request.startDate)} - ${formatDate(request.endDate)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="120" style="font-weight: 600; color: #666666; font-size: 14px;">Duration:</td>
                        <td style="color: #333333; font-size: 14px;">${dayCount} ${dayWord}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${request.reason ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="120" style="font-weight: 600; color: #666666; font-size: 14px; vertical-align: top;">Reason:</td>
                        <td style="color: #333333; font-size: 14px;">${request.reason}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ` : ''}
              </table>

              <!-- Action Buttons -->
              ${actionButtonsHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #f9fafb; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; font-size: 12px; color: #888888; text-align: center;">
                This is an automated message from the Beutech Vacation Timeline system.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Log diagnostic based on error type
    if (errorMessage.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('Access denied')) {
      logDiagnostic(logger, DiagnosticCode.EMAIL_SEND_FAILED, {
        fromEmail,
        toEmail,
        errorMessage,
        hint: 'App may lack Mail.Send permission or fromEmail mailbox does not exist',
      });
    } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      logDiagnostic(logger, DiagnosticCode.EMAIL_SEND_FAILED, {
        fromEmail,
        toEmail,
        errorMessage,
        hint: `Mailbox "${fromEmail}" not found. Check NOTIFICATION_FROM_EMAIL is a valid mailbox.`,
      });
    } else {
      logDiagnostic(logger, DiagnosticCode.EMAIL_SEND_FAILED, {
        fromEmail,
        toEmail,
        errorMessage,
      });
    }
    // Don't throw - notifications are best-effort
  }
}

/**
 * Sends a Teams activity notification to a user.
 * (Legacy method - use sendTeamsAdaptiveCard for actionable notifications)
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
 * Sends a Teams Adaptive Card via chat message.
 * Includes actionable Approve/Reject buttons.
 *
 * @param userId - Microsoft 365 user ID to send to
 * @param request - The time-off request
 * @param actionUrls - URLs for approve/reject actions
 * @param logger - Optional logger instance
 */
export async function sendTeamsAdaptiveCard(
  userId: string,
  request: TimeOffRequest,
  actionUrls?: { approveUrl: string; rejectUrl: string },
  logger?: Logger
): Promise<void> {
  logger?.info('Sending Teams notification', { userId, requestId: request.id });

  const dayCount = getDayCount(request.startDate, request.endDate);
  const dayWord = dayCount === 1 ? 'day' : 'days';

  // Note: Full Adaptive Cards with action buttons require Teams app registration.
  // For now, we send a text notification with the action URLs in the message.
  // When a Teams bot is registered, we can send rich Adaptive Cards.

  try {
    let teamsMessage = `${request.requesterName} has requested ${dayCount} ${dayWord} off (${request.startDate} - ${request.endDate}).`;

    if (actionUrls) {
      teamsMessage += `\n\nApprove: ${actionUrls.approveUrl}\nDecline: ${actionUrls.rejectUrl}`;
    } else {
      teamsMessage += ' Please review and approve or reject in the Vacation Timeline widget.';
    }

    await sendTeamsNotification(userId, 'New Time-Off Request', teamsMessage, logger);
  } catch (error) {
    logger?.warn('Failed to send Teams notification (non-critical)', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Notifies a supervisor of a new time-off request via email and Teams.
 * Includes actionable Approve/Reject buttons in the email.
 *
 * @param request - The time-off request
 * @param senderEmail - Email to send from (typically a service account)
 * @param apiBaseUrl - Base URL of the API (for action links)
 * @param logger - Optional logger instance
 */
export async function notifySupervisorOfNewRequest(
  request: TimeOffRequest,
  senderEmail: string,
  apiBaseUrl?: string,
  logger?: Logger
): Promise<void> {
  logger?.info('Notifying supervisor of new request', {
    requestId: request.id,
    supervisorEmail: request.supervisorEmail,
  });

  const dayCount = getDayCount(request.startDate, request.endDate);
  const subject = `[Action Required] Time-Off Request: ${request.requesterName} - ${dayCount} day${dayCount > 1 ? 's' : ''}`;

  // Generate action URLs if API base URL is provided
  let actionUrls: { approveUrl: string; rejectUrl: string } | undefined;
  if (apiBaseUrl) {
    actionUrls = generateActionUrls(apiBaseUrl, request.id, request.supervisorEmail);
    logger?.debug('Generated action URLs', { requestId: request.id });
  }

  // Send email with action buttons
  await sendEmail(
    senderEmail,
    request.supervisorEmail,
    subject,
    generateNewRequestEmailHtml(request, actionUrls),
    logger
  );

  // Send Teams Adaptive Card if supervisor ID is available
  if (request.supervisorId) {
    await sendTeamsAdaptiveCard(
      request.supervisorId,
      request,
      actionUrls,
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
