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

import React, { useState } from 'react';
import type { TimelineUser } from '../../types/vacation';
import { getUserColor } from '../../utils/colorUtils';
import './Legend.css';

export interface LegendProps {
  /** Users to display in the legend */
  users: TimelineUser[];
  /** Whether the legend can be collapsed */
  collapsible?: boolean;
  /** Initial collapsed state */
  initialCollapsed?: boolean;
}

/**
 * Legend component showing color assignments for each user.
 */
export const Legend: React.FC<LegendProps> = ({
  users,
  collapsible = true,
  initialCollapsed = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  if (users.length === 0) {
    return null;
  }

  return (
    <div className="vt-legend">
      {collapsible && (
        <button
          type="button"
          className="vt-legend__toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-expanded={!isCollapsed}
        >
          <span className="vt-legend__toggle-text">Legend</span>
          <svg
            className={`vt-legend__toggle-icon ${isCollapsed ? '' : 'vt-legend__toggle-icon--open'}`}
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
          >
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
          </svg>
        </button>
      )}

      {!isCollapsed && (
        <div className="vt-legend__items" role="list">
          {users.map((user) => {
            const color = getUserColor(user.colorKey);
            return (
              <div key={user.userId} className="vt-legend__item" role="listitem">
                <span
                  className="vt-legend__color"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="vt-legend__name">
                  {user.displayName}
                  {user.isCurrentUser && (
                    <span className="vt-legend__me-badge">(me)</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
