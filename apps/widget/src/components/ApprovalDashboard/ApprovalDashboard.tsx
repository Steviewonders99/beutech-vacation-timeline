/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useState, useCallback } from 'react';
import type { TimeOffRequest } from '../../types/request';
import './ApprovalDashboard.css';

export interface ApprovalDashboardProps {
  /** List of pending requests */
  pendingRequests: TimeOffRequest[];
  /** Whether requests are loading */
  isLoading: boolean;
  /** Error message if operation failed */
  error: string | null;
  /** Approve a request */
  onApprove: (requestId: string) => Promise<void>;
  /** Reject a request */
  onReject: (requestId: string, reason?: string) => Promise<void>;
  /** Whether an action is in progress */
  isActioning: boolean;
  /** Refresh the requests */
  onRefresh: () => void;
}

/**
 * Format a date string to a user-friendly format.
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get human-readable leave type label.
 */
function getLeaveTypeLabel(leaveType: string): string {
  switch (leaveType) {
    case 'vacation':
      return 'Time Off';
    case 'sick':
      return 'Sick Leave';
    case 'personal':
      return 'Personal Day';
    case 'other':
      return 'Other';
    default:
      return leaveType;
  }
}

/**
 * Calculate the number of days between two dates (inclusive).
 */
function calculateDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

interface ApprovalCardProps {
  request: TimeOffRequest;
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string, reason?: string) => Promise<void>;
  isActioning: boolean;
}

/**
 * Component to display a single approval card.
 */
const ApprovalCard: React.FC<ApprovalCardProps> = ({
  request,
  onApprove,
  onReject,
  isActioning,
}) => {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const days = calculateDays(request.startDate, request.endDate);
  const daysLabel = days === 1 ? '1 day' : `${days} days`;

  const handleApprove = useCallback(async () => {
    setActionError(null);
    try {
      await onApprove(request.id);
    } catch {
      setActionError('Failed to approve request');
    }
  }, [onApprove, request.id]);

  const handleReject = useCallback(async () => {
    setActionError(null);
    try {
      await onReject(request.id, rejectionReason.trim() || undefined);
      setShowRejectDialog(false);
      setRejectionReason('');
    } catch {
      setActionError('Failed to reject request');
    }
  }, [onReject, request.id, rejectionReason]);

  const handleCancelReject = useCallback(() => {
    setShowRejectDialog(false);
    setRejectionReason('');
    setActionError(null);
  }, []);

  return (
    <div className="vt-approval-card">
      <div className="vt-approval-card__header">
        <div className="vt-approval-card__requester">
          <span className="vt-approval-card__avatar">
            {request.requesterName.charAt(0).toUpperCase()}
          </span>
          <div className="vt-approval-card__info">
            <span className="vt-approval-card__name">{request.requesterName}</span>
            <span className="vt-approval-card__email">{request.requesterEmail}</span>
          </div>
        </div>
        <span className="vt-approval-card__type">{getLeaveTypeLabel(request.leaveType)}</span>
      </div>

      <div className="vt-approval-card__dates">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M12.667 2.667H3.333C2.597 2.667 2 3.264 2 4v9.333c0 .737.597 1.334 1.333 1.334h9.334c.736 0 1.333-.597 1.333-1.334V4c0-.736-.597-1.333-1.333-1.333zM10.667 1.333v2.667M5.333 1.333v2.667M2 6.667h12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>
          {formatDate(request.startDate)}
          {request.startDate !== request.endDate && ` - ${formatDate(request.endDate)}`}
        </span>
        <span className="vt-approval-card__days">({daysLabel})</span>
      </div>

      {request.reason && (
        <div className="vt-approval-card__reason">
          <span className="vt-approval-card__reason-label">Reason:</span> {request.reason}
        </div>
      )}

      <div className="vt-approval-card__submitted">
        Submitted {formatDate(request.createdAt)}
      </div>

      {actionError && (
        <div className="vt-approval-card__error" role="alert">
          {actionError}
        </div>
      )}

      {showRejectDialog ? (
        <div className="vt-approval-card__reject-dialog">
          <label htmlFor={`reject-reason-${request.id}`} className="vt-form-label">
            Rejection Reason <span className="vt-optional">(optional)</span>
          </label>
          <textarea
            id={`reject-reason-${request.id}`}
            className="vt-form-textarea"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Provide a reason for rejection..."
            rows={2}
            disabled={isActioning}
          />
          <div className="vt-approval-card__reject-actions">
            <button
              type="button"
              className="vt-btn vt-btn--secondary"
              onClick={handleCancelReject}
              disabled={isActioning}
            >
              Cancel
            </button>
            <button
              type="button"
              className="vt-btn vt-btn--danger"
              onClick={handleReject}
              disabled={isActioning}
            >
              {isActioning ? 'Rejecting...' : 'Confirm Reject'}
            </button>
          </div>
        </div>
      ) : (
        <div className="vt-approval-card__actions">
          <button
            type="button"
            className="vt-btn vt-btn--secondary"
            onClick={() => setShowRejectDialog(true)}
            disabled={isActioning}
          >
            Reject
          </button>
          <button
            type="button"
            className="vt-btn vt-btn--success"
            onClick={handleApprove}
            disabled={isActioning}
          >
            {isActioning ? 'Approving...' : 'Approve'}
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Dashboard for supervisors to approve/reject time-off requests.
 */
export const ApprovalDashboard: React.FC<ApprovalDashboardProps> = ({
  pendingRequests,
  isLoading,
  error,
  onApprove,
  onReject,
  isActioning,
  onRefresh,
}) => {
  if (isLoading) {
    return (
      <div className="vt-approval-dashboard">
        <div className="vt-approval-dashboard__loading">
          <div className="vt-spinner" />
          <span>Loading pending approvals...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vt-approval-dashboard">
        <div className="vt-approval-dashboard__error">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M10 6.667v3.333M10 13.333h.008M18.333 10a8.333 8.333 0 11-16.666 0 8.333 8.333 0 0116.666 0z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{error}</span>
          <button type="button" className="vt-btn vt-btn--secondary" onClick={onRefresh}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (pendingRequests.length === 0) {
    return (
      <div className="vt-approval-dashboard">
        <div className="vt-approval-dashboard__empty">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path
              d="M44 22.52V24c-.002 4.614-1.643 9.086-4.638 12.63-2.995 3.543-7.155 5.93-11.754 6.742-4.6.812-9.34.002-13.39-2.287-4.05-2.29-7.163-5.92-8.795-10.255-1.632-4.334-1.686-9.08-.152-13.451 1.535-4.37 4.552-8.074 8.533-10.464 3.98-2.39 8.683-3.322 13.29-2.634 4.608.689 8.815 2.958 11.89 6.41"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M44 8l-20 20.02L18 22"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h3>All caught up!</h3>
          <p>No pending time-off requests to review.</p>
        </div>
      </div>
    );
  }

  // Sort by submission date (oldest first - FIFO)
  const sortedRequests = [...pendingRequests].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div className="vt-approval-dashboard">
      <div className="vt-approval-dashboard__header">
        <div className="vt-approval-dashboard__title-row">
          <h3 className="vt-approval-dashboard__title">Pending Approvals</h3>
          <span className="vt-approval-dashboard__count">{pendingRequests.length}</span>
        </div>
        <button
          type="button"
          className="vt-btn vt-btn--icon"
          onClick={onRefresh}
          aria-label="Refresh approvals"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M1.333 6.667A6.667 6.667 0 0112.667 3.6M14.667 9.333A6.667 6.667 0 013.333 12.4M1.333 1.333v5.334h5.334M14.667 14.667V9.333H9.333"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <div className="vt-approval-dashboard__list">
        {sortedRequests.map((request) => (
          <ApprovalCard
            key={request.id}
            request={request}
            onApprove={onApprove}
            onReject={onReject}
            isActioning={isActioning}
          />
        ))}
      </div>
    </div>
  );
};
