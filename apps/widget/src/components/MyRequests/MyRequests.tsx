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

import React from 'react';
import type { TimeOffRequest, RequestStatus } from '../../types/request';
import './MyRequests.css';

export interface MyRequestsProps {
  /** List of time-off requests */
  requests: TimeOffRequest[];
  /** Whether requests are loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
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
 * Get the status badge class based on request status.
 */
function getStatusClass(status: RequestStatus): string {
  switch (status) {
    case 'approved':
      return 'vt-status--approved';
    case 'rejected':
      return 'vt-status--rejected';
    case 'cancelled':
      return 'vt-status--cancelled';
    default:
      return 'vt-status--pending';
  }
}

/**
 * Get human-readable leave type label.
 */
function getLeaveTypeLabel(leaveType: string): string {
  switch (leaveType) {
    case 'vacation':
      return 'Vacation';
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
  return diffDays + 1; // Inclusive of both dates
}

/**
 * Component to display a single request card.
 */
const RequestCard: React.FC<{ request: TimeOffRequest }> = ({ request }) => {
  const days = calculateDays(request.startDate, request.endDate);
  const daysLabel = days === 1 ? '1 day' : `${days} days`;

  return (
    <div className="vt-request-card">
      <div className="vt-request-card__header">
        <span className="vt-request-card__type">{getLeaveTypeLabel(request.leaveType)}</span>
        <span className={`vt-status ${getStatusClass(request.status)}`}>
          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
        </span>
      </div>
      <div className="vt-request-card__dates">
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
        <span className="vt-request-card__days">({daysLabel})</span>
      </div>
      {request.reason && (
        <div className="vt-request-card__reason">
          <span className="vt-request-card__reason-label">Reason:</span> {request.reason}
        </div>
      )}
      {request.status === 'rejected' && request.rejectionReason && (
        <div className="vt-request-card__rejection">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M8 5.333V8M8 10.667h.007M14.667 8A6.667 6.667 0 111.333 8a6.667 6.667 0 0113.334 0z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{request.rejectionReason}</span>
        </div>
      )}
      <div className="vt-request-card__footer">
        <span className="vt-request-card__supervisor">
          Supervisor: {request.supervisorName || request.supervisorEmail}
        </span>
        <span className="vt-request-card__submitted">
          Submitted {formatDate(request.createdAt)}
        </span>
      </div>
    </div>
  );
};

/**
 * Component to display a user's time-off requests.
 */
export const MyRequests: React.FC<MyRequestsProps> = ({
  requests,
  isLoading,
  error,
  onRefresh,
}) => {
  if (isLoading) {
    return (
      <div className="vt-my-requests">
        <div className="vt-my-requests__loading">
          <div className="vt-spinner" />
          <span>Loading your requests...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vt-my-requests">
        <div className="vt-my-requests__error">
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

  if (requests.length === 0) {
    return (
      <div className="vt-my-requests">
        <div className="vt-my-requests__empty">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path
              d="M38 8H10a4 4 0 00-4 4v28a4 4 0 004 4h28a4 4 0 004-4V12a4 4 0 00-4-4zM32 4v8M16 4v8M6 20h36"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h3>No requests yet</h3>
          <p>You haven&apos;t submitted any time-off requests.</p>
        </div>
      </div>
    );
  }

  // Sort requests: pending first, then by date (newest first)
  const sortedRequests = [...requests].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="vt-my-requests">
      <div className="vt-my-requests__header">
        <h3 className="vt-my-requests__title">My Time-Off Requests</h3>
        <button
          type="button"
          className="vt-btn vt-btn--icon"
          onClick={onRefresh}
          aria-label="Refresh requests"
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
      <div className="vt-my-requests__list">
        {sortedRequests.map((request) => (
          <RequestCard key={request.id} request={request} />
        ))}
      </div>
    </div>
  );
};
