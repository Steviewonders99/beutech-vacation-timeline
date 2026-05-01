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

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { LeaveType } from '../../types/request';
import './RequestModal.css';

export interface RequestModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close the modal */
  onClose: () => void;
  /** Submit the request */
  onSubmit: (data: {
    startDate: string;
    endDate: string;
    leaveType: LeaveType;
    reason?: string;
  }) => Promise<void>;
  /** User's email */
  userEmail: string;
  /** User's display name */
  userName: string;
  /** Whether submission is in progress */
  isSubmitting?: boolean;
  /** Error message to display */
  error?: string | null;
}

const LEAVE_TYPE_OPTIONS: { value: LeaveType; label: string }[] = [
  { value: 'vacation', label: 'Time Off' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'personal', label: 'Personal Day' },
  { value: 'other', label: 'Other' },
];

/**
 * Gets today's date in YYYY-MM-DD format.
 */
function getTodayString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Modal for submitting a time-off request.
 */
export const RequestModal: React.FC<RequestModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  userEmail,
  userName,
  isSubmitting = false,
  error = null,
}) => {
  const [startDate, setStartDate] = useState(getTodayString());
  const [endDate, setEndDate] = useState(getTodayString());
  const [leaveType, setLeaveType] = useState<LeaveType>('vacation');
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);

  // Focus start date input when modal opens
  useEffect(() => {
    if (isOpen && startDateRef.current) {
      setTimeout(() => startDateRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStartDate(getTodayString());
      setEndDate(getTodayString());
      setLeaveType('vacation');
      setReason('');
      setLocalError(null);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLocalError(null);

      // Client-side validation
      if (!startDate) {
        setLocalError('Start date is required');
        return;
      }
      if (!endDate) {
        setLocalError('End date is required');
        return;
      }
      if (new Date(endDate) < new Date(startDate)) {
        setLocalError('End date must be on or after start date');
        return;
      }
      if (new Date(startDate) < new Date(getTodayString())) {
        setLocalError('Start date cannot be in the past');
        return;
      }

      try {
        await onSubmit({
          startDate,
          endDate,
          leaveType,
          reason: reason.trim() || undefined,
        });
        onClose();
      } catch {
        // Error is handled by parent component
      }
    },
    [startDate, endDate, leaveType, reason, onSubmit, onClose]
  );

  if (!isOpen) {
    return null;
  }

  const displayError = error || localError;

  return (
    <div className="vt-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="request-modal-title">
      <div className="vt-modal" ref={modalRef}>
        <div className="vt-modal__header">
          <h2 id="request-modal-title" className="vt-modal__title">
            Request Time Off
          </h2>
          <button
            type="button"
            className="vt-modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M15 5L5 15M5 5L15 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vt-modal__form">
          <div className="vt-modal__body">
            {/* User info (read-only) */}
            <div className="vt-form-group">
              <label className="vt-form-label">Requesting as</label>
              <div className="vt-form-static">
                {userName} ({userEmail})
              </div>
            </div>

            {/* Date range */}
            <div className="vt-form-row">
              <div className="vt-form-group">
                <label htmlFor="start-date" className="vt-form-label">
                  Start Date <span className="vt-required">*</span>
                </label>
                <input
                  ref={startDateRef}
                  type="date"
                  id="start-date"
                  className="vt-form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={getTodayString()}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="vt-form-group">
                <label htmlFor="end-date" className="vt-form-label">
                  End Date <span className="vt-required">*</span>
                </label>
                <input
                  type="date"
                  id="end-date"
                  className="vt-form-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Leave type */}
            <div className="vt-form-group">
              <label htmlFor="leave-type" className="vt-form-label">
                Leave Type
              </label>
              <select
                id="leave-type"
                className="vt-form-select"
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                disabled={isSubmitting}
              >
                {LEAVE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Reason (optional) */}
            <div className="vt-form-group">
              <label htmlFor="reason" className="vt-form-label">
                Reason <span className="vt-optional">(optional)</span>
              </label>
              <textarea
                id="reason"
                className="vt-form-textarea"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Add any notes for your supervisor..."
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            {/* Error message */}
            {displayError && (
              <div className="vt-form-error" role="alert">
                {displayError}
              </div>
            )}
          </div>

          <div className="vt-modal__footer">
            <button
              type="button"
              className="vt-btn vt-btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="vt-btn vt-btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
