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

import React, { useCallback, useState, useRef, useEffect } from 'react';
import type { TimelineUser } from '../../types/vacation';
import { getUserColor } from '../../utils/colorUtils';
import './UserFilter.css';

export interface UserFilterProps {
  /** All available users */
  users: TimelineUser[];
  /** Currently selected user IDs (empty means all selected) */
  selectedUserIds: string[];
  /** Callback when selection changes */
  onChange: (userIds: string[]) => void;
  /** Whether to show the "Only Me" option */
  showOnlyMe?: boolean;
  /** Current user's ID for "Only Me" filtering */
  currentUserId?: string;
}

/**
 * Chevron down icon component
 */
const ChevronIcon: React.FC<{ isOpen: boolean }> = ({ isOpen }) => (
  <svg
    className={`vt-filter__chevron ${isOpen ? 'vt-filter__chevron--open' : ''}`}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M4 6L8 10L12 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Check icon component
 */
const CheckIcon: React.FC = () => (
  <svg
    className="vt-filter__check"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M3 8L6.5 11.5L13 5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Filter component for selecting which users to show in the timeline.
 * Uses a shadcn-style dropdown with multi-select capability.
 */
export const UserFilter: React.FC<UserFilterProps> = ({
  users,
  selectedUserIds,
  onChange,
  showOnlyMe = true,
  currentUserId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const allSelected = selectedUserIds.length === 0;
  const onlyMeSelected = selectedUserIds.length === 1 && selectedUserIds[0] === currentUserId;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      buttonRef.current?.focus();
    }
  };

  const handleSelectAll = useCallback(() => {
    onChange([]);
    setIsOpen(false);
  }, [onChange]);

  const handleSelectOnlyMe = useCallback(() => {
    if (currentUserId) {
      onChange([currentUserId]);
      setIsOpen(false);
    }
  }, [currentUserId, onChange]);

  const handleToggleUser = useCallback(
    (userId: string) => {
      if (allSelected) {
        // If all selected, start with just this user
        onChange([userId]);
      } else if (selectedUserIds.includes(userId)) {
        // Remove user from selection
        const newSelection = selectedUserIds.filter((id) => id !== userId);
        // If no users left, select all
        onChange(newSelection.length === 0 ? [] : newSelection);
      } else {
        // Add user to selection
        onChange([...selectedUserIds, userId]);
      }
    },
    [allSelected, selectedUserIds, onChange]
  );

  const isUserSelected = (userId: string): boolean => {
    return allSelected || selectedUserIds.includes(userId);
  };

  // Get display label for the dropdown button
  const getDisplayLabel = (): string => {
    if (allSelected) return 'All team members';
    if (onlyMeSelected) return 'Only me';
    if (selectedUserIds.length === 1) {
      const user = users.find((u) => u.userId === selectedUserIds[0]);
      return user?.displayName || '1 person';
    }
    return `${selectedUserIds.length} people`;
  };

  return (
    <div className="vt-filter" ref={dropdownRef} onKeyDown={handleKeyDown}>
      <label className="vt-filter__label">Show</label>
      <div className="vt-filter__dropdown">
        <button
          ref={buttonRef}
          type="button"
          className="vt-filter__trigger"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className="vt-filter__value">{getDisplayLabel()}</span>
          <ChevronIcon isOpen={isOpen} />
        </button>

        {isOpen && (
          <div className="vt-filter__menu" role="listbox" aria-multiselectable="true">
            {/* Quick actions */}
            <div className="vt-filter__section">
              <button
                type="button"
                className={`vt-filter__option ${allSelected ? 'vt-filter__option--selected' : ''}`}
                onClick={handleSelectAll}
                role="option"
                aria-selected={allSelected}
              >
                <span className="vt-filter__option-check">
                  {allSelected && <CheckIcon />}
                </span>
                <span className="vt-filter__option-label">All team members</span>
              </button>

              {showOnlyMe && currentUserId && (
                <button
                  type="button"
                  className={`vt-filter__option ${onlyMeSelected ? 'vt-filter__option--selected' : ''}`}
                  onClick={handleSelectOnlyMe}
                  role="option"
                  aria-selected={onlyMeSelected}
                >
                  <span className="vt-filter__option-check">
                    {onlyMeSelected && <CheckIcon />}
                  </span>
                  <span className="vt-filter__option-label">Only me</span>
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="vt-filter__divider" />

            {/* Individual users */}
            <div className="vt-filter__section vt-filter__section--scroll">
              {users.map((user) => {
                const color = getUserColor(user.colorKey);
                const isSelected = isUserSelected(user.userId);

                return (
                  <button
                    key={user.userId}
                    type="button"
                    className={`vt-filter__option ${isSelected && !allSelected ? 'vt-filter__option--selected' : ''}`}
                    onClick={() => handleToggleUser(user.userId)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="vt-filter__option-check">
                      {isSelected && !allSelected && <CheckIcon />}
                    </span>
                    <span
                      className="vt-filter__option-color"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span className="vt-filter__option-label">
                      {user.displayName}
                      {user.isCurrentUser && (
                        <span className="vt-filter__option-badge">you</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
