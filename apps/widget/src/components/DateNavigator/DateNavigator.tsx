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
import './DateNavigator.css';

export interface DateNavigatorProps {
  /** Go to today */
  onToday: () => void;
  /** Go to previous period */
  onPrevious: () => void;
  /** Go to next period */
  onNext: () => void;
}

/**
 * Navigation controls for moving between date ranges.
 */
export const DateNavigator: React.FC<DateNavigatorProps> = ({
  onToday,
  onPrevious,
  onNext,
}) => {
  return (
    <div className="vt-date-nav" role="group" aria-label="Date navigation">
      <button
        type="button"
        className="vt-date-nav__btn vt-date-nav__btn--today"
        onClick={onToday}
      >
        Today
      </button>
      <button
        type="button"
        className="vt-date-nav__btn vt-date-nav__btn--arrow"
        onClick={onPrevious}
        aria-label="Previous period"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
      </button>
      <button
        type="button"
        className="vt-date-nav__btn vt-date-nav__btn--arrow"
        onClick={onNext}
        aria-label="Next period"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
        </svg>
      </button>
    </div>
  );
};
