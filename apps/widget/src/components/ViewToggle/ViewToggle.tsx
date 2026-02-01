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
import type { VacationView } from '../../types/vacation';
import './ViewToggle.css';

export interface ViewToggleProps {
  /** Currently selected view */
  value: VacationView;
  /** Callback when view changes */
  onChange: (view: VacationView) => void;
}

const VIEW_OPTIONS: { value: VacationView; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'timeline', label: 'Year' },
];

/**
 * Segmented toggle buttons for switching between calendar view modes.
 * Styled as a shadcn-inspired segmented control.
 */
export const ViewToggle: React.FC<ViewToggleProps> = ({ value, onChange }) => {
  return (
    <div className="vt-view-toggle" role="group" aria-label="Calendar view">
      <div className="vt-view-toggle__track">
        {VIEW_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`vt-view-toggle__btn ${
              value === option.value ? 'vt-view-toggle__btn--active' : ''
            }`}
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};
