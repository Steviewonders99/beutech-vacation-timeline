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

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { VacationView } from '../../types/vacation';
import './CalendarHeader.css';

/**
 * Generate month options for dropdown (current year ± 1 years)
 */
function generateMonthOptions(
  anchorDate: Date,
  monthNames: string[]
): { label: string; date: Date }[] {
  const currentYear = anchorDate.getFullYear();
  const options: { label: string; date: Date }[] = [];

  for (let year = currentYear - 1; year <= currentYear + 1; year++) {
    for (let month = 0; month < 12; month++) {
      options.push({
        label: `${monthNames[month]} ${year}`,
        date: new Date(year, month, 1),
      });
    }
  }

  return options;
}

/**
 * Generate day options for dropdown (±14 days from anchor)
 */
function generateDayOptions(
  anchorDate: Date,
  monthNames: string[],
  weekdayNames: string[]
): { label: string; date: Date }[] {
  const options: { label: string; date: Date }[] = [];

  for (let offset = -14; offset <= 14; offset++) {
    const date = new Date(anchorDate);
    date.setDate(date.getDate() + offset);
    options.push({
      label: `${weekdayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}`,
      date: new Date(date),
    });
  }

  return options;
}

/**
 * Generate week options for dropdown (±8 weeks from anchor)
 */
function generateWeekOptions(
  anchorDate: Date,
  monthNames: string[]
): { label: string; date: Date }[] {
  const options: { label: string; date: Date }[] = [];

  // Get the start of the current week (Monday)
  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    d.setDate(diff);
    return d;
  };

  const currentWeekStart = getWeekStart(anchorDate);

  for (let weekOffset = -8; weekOffset <= 8; weekOffset++) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() + weekOffset * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Format: "Jan 6 - 12" or "Jan 27 - Feb 2"
    const startMonth = monthNames[weekStart.getMonth()];
    const endMonth = monthNames[weekEnd.getMonth()];

    let label: string;
    if (weekStart.getMonth() === weekEnd.getMonth()) {
      label = `${startMonth} ${weekStart.getDate()} - ${weekEnd.getDate()}`;
    } else {
      label = `${startMonth} ${weekStart.getDate()} - ${endMonth} ${weekEnd.getDate()}`;
    }

    // Add year if different from current year
    if (weekStart.getFullYear() !== new Date().getFullYear()) {
      label += `, ${weekStart.getFullYear()}`;
    }

    options.push({
      label,
      date: new Date(weekStart),
    });
  }

  return options;
}

export interface CalendarHeaderProps {
  /** Current view type */
  view: VacationView;
  /** Date range label (e.g., "May 5-11, 2025") */
  dateLabel: string;
  /** Current anchor date */
  anchorDate: Date;
  /** Callback when view changes */
  onViewChange: (view: VacationView) => void;
  /** Callback to go to today */
  onToday: () => void;
  /** Callback to go to previous period */
  onPrevious: () => void;
  /** Callback to go to next period */
  onNext: () => void;
  /** Callback to navigate to a specific date */
  onGoToDate: (date: Date) => void;
  /** Optional Outlook deep link URL */
  outlookDeepLink?: string | null;
}

/**
 * Chevron left icon
 */
const ChevronLeft: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M10 12L6 8L10 4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Chevron right icon
 */
const ChevronRight: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M6 4L10 8L6 12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Chevron down icon for dropdown
 */
const ChevronDown: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M3 4.5L6 7.5L9 4.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * External link icon for Outlook button
 */
const ExternalLinkIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path
      d="M11 7.5V11.5C11 12.0523 10.5523 12.5 10 12.5H2.5C1.94772 12.5 1.5 12.0523 1.5 11.5V4C1.5 3.44772 1.94772 3 2.5 3H6.5"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 1.5H12.5V5"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6 8L12.5 1.5"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Opens a URL in a new browser tab.
 */
function openInNewTab(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Header component with view toggle, date navigation, and current range display.
 * Unified shadcn-style toolbar layout.
 */
export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  view,
  dateLabel,
  anchorDate,
  onViewChange,
  onToday,
  onPrevious,
  onNext,
  onGoToDate,
  outlookDeepLink,
}) => {
  const { t } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get translated month names
  const monthNames = useMemo(
    () => [
      t('calendar.months.january'),
      t('calendar.months.february'),
      t('calendar.months.march'),
      t('calendar.months.april'),
      t('calendar.months.may'),
      t('calendar.months.june'),
      t('calendar.months.july'),
      t('calendar.months.august'),
      t('calendar.months.september'),
      t('calendar.months.october'),
      t('calendar.months.november'),
      t('calendar.months.december'),
    ],
    [t]
  );

  // Get translated weekday names
  const weekdayNames = useMemo(
    () => [
      t('calendar.weekdays.sunday'),
      t('calendar.weekdays.monday'),
      t('calendar.weekdays.tuesday'),
      t('calendar.weekdays.wednesday'),
      t('calendar.weekdays.thursday'),
      t('calendar.weekdays.friday'),
      t('calendar.weekdays.saturday'),
    ],
    [t]
  );

  // View options with translations
  const viewOptions = useMemo(
    () => [
      { value: 'day' as VacationView, label: t('views.day') },
      { value: 'week' as VacationView, label: t('views.week') },
      { value: 'month' as VacationView, label: t('views.month') },
    ],
    [t]
  );

  const handleOpenOutlook = (): void => {
    if (outlookDeepLink) {
      openInNewTab(outlookDeepLink);
    }
  };

  const handleDateSelect = (date: Date): void => {
    onGoToDate(date);
    setIsDropdownOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Generate dropdown options based on current view
  const dropdownOptions = useMemo(() => {
    switch (view) {
      case 'day':
        return generateDayOptions(anchorDate, monthNames, weekdayNames);
      case 'week':
        return generateWeekOptions(anchorDate, monthNames);
      case 'month':
        return generateMonthOptions(anchorDate, monthNames);
      default:
        return [];
    }
  }, [view, anchorDate, monthNames, weekdayNames]);

  // Get current label for dropdown trigger
  const getCurrentLabel = (): string => {
    switch (view) {
      case 'day': {
        const day = weekdayNames[anchorDate.getDay()];
        const month = monthNames[anchorDate.getMonth()];
        return `${day}, ${month} ${anchorDate.getDate()}`;
      }
      case 'week':
        return dateLabel;
      case 'month':
        return `${monthNames[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
      default:
        return dateLabel;
    }
  };

  // Check if an option is currently selected
  const isOptionSelected = (optionDate: Date): boolean => {
    switch (view) {
      case 'day':
        return (
          optionDate.getDate() === anchorDate.getDate() &&
          optionDate.getMonth() === anchorDate.getMonth() &&
          optionDate.getFullYear() === anchorDate.getFullYear()
        );
      case 'week': {
        // Check if same week
        const getWeekStart = (date: Date): number => {
          const d = new Date(date);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          d.setDate(diff);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        };
        return getWeekStart(optionDate) === getWeekStart(anchorDate);
      }
      case 'month':
        return (
          optionDate.getMonth() === anchorDate.getMonth() &&
          optionDate.getFullYear() === anchorDate.getFullYear()
        );
      default:
        return false;
    }
  };

  return (
    <div className="vt-header" role="banner">
      {/* Left section: Navigation controls */}
      <div className="vt-header__nav">
        <button
          type="button"
          className="vt-header__btn vt-header__btn--today"
          onClick={onToday}
        >
          {t('common.today')}
        </button>
        <div className="vt-header__nav-arrows">
          <button
            type="button"
            className="vt-header__btn vt-header__btn--icon"
            onClick={onPrevious}
            aria-label={t('calendar.navigation.previousPeriod')}
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            className="vt-header__btn vt-header__btn--icon"
            onClick={onNext}
            aria-label={t('calendar.navigation.nextPeriod')}
          >
            <ChevronRight />
          </button>
        </div>

        {/* Date dropdown for all views */}
        <div className="vt-header__date-dropdown" ref={dropdownRef}>
          <button
            type="button"
            className="vt-header__date-trigger"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-expanded={isDropdownOpen}
            aria-haspopup="listbox"
          >
            <span>{getCurrentLabel()}</span>
            <ChevronDown />
          </button>
          {isDropdownOpen && (
            <div className="vt-header__date-menu" role="listbox">
              {dropdownOptions.map((option, index) => {
                const isSelected = isOptionSelected(option.date);
                return (
                  <button
                    key={index}
                    type="button"
                    className={`vt-header__date-option ${isSelected ? 'vt-header__date-option--selected' : ''}`}
                    onClick={() => handleDateSelect(option.date)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right section: View toggle and actions */}
      <div className="vt-header__actions">
        <div className="vt-header__view-toggle" role="group" aria-label="Calendar view">
          {viewOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`vt-header__view-btn ${
                view === option.value ? 'vt-header__view-btn--active' : ''
              }`}
              onClick={() => onViewChange(option.value)}
              aria-pressed={view === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>

        {outlookDeepLink && (
          <button
            type="button"
            className="vt-header__btn vt-header__btn--outlook"
            onClick={handleOpenOutlook}
            aria-label={t('calendar.openInOutlook')}
            title={t('calendar.openInOutlook')}
          >
            <ExternalLinkIcon />
            <span className="vt-header__outlook-text">Outlook</span>
          </button>
        )}
      </div>
    </div>
  );
};
