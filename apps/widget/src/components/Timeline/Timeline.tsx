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

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { VacationEvent, TimelineUser, VacationView } from '../../types/vacation';
import { TimelineRow } from './TimelineRow';
import { getDateRange, getDayName, isToday, getPositionInRange } from '../../utils/dateUtils';
import './Timeline.css';

export interface TimelineProps {
  /** Vacation events to display */
  events: VacationEvent[];
  /** Users to show rows for */
  users: TimelineUser[];
  /** Start of the visible range */
  startDate: Date;
  /** End of the visible range */
  endDate: Date;
  /** Current view type */
  view?: VacationView;
}

interface EventSegment {
  event: VacationEvent;
  startCol: number; // 0-6 (day of week)
  span: number; // number of days to span
  row: number; // vertical position (0, 1, 2...)
  isStart: boolean; // is this the start of the event
  isEnd: boolean; // is this the end of the event
}

interface WeekData {
  dates: Date[];
  segments: EventSegment[];
}

// Grayscale color palette for events
const GRAYSCALE_COLORS = [
  '#4b5563', // gray-600
  '#6b7280', // gray-500
  '#374151', // gray-700
  '#9ca3af', // gray-400
  '#1f2937', // gray-800
  '#d1d5db', // gray-300
];

/**
 * Get the start of day (midnight) for a date
 */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Check if two dates are the same day
 */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Get a grayscale color based on index
 */
function getGrayscaleColor(index: number): string {
  return GRAYSCALE_COLORS[index % GRAYSCALE_COLORS.length];
}

/**
 * Main timeline component displaying vacation events in a resource-style grid.
 */
export const Timeline: React.FC<TimelineProps> = ({
  events,
  users,
  startDate,
  endDate,
  view = 'week',
}) => {
  const { t } = useTranslation();

  // Translated weekday abbreviations for month view header
  const weekdays = useMemo(
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

  // Generate the array of dates to display as columns
  const dates = useMemo(() => getDateRange(startDate, endDate), [startDate, endDate]);

  // Group events by user
  const eventsByUser = useMemo(() => {
    const map = new Map<string, VacationEvent[]>();
    users.forEach((user) => {
      map.set(user.userId, []);
    });
    events.forEach((event) => {
      const userEvents = map.get(event.userId);
      if (userEvents) {
        userEvents.push(event);
      }
    });
    return map;
  }, [events, users]);

  // Calculate the "today" marker position
  const todayPosition = useMemo(() => {
    const today = new Date();
    if (today < startDate || today > endDate) {
      return null;
    }
    return getPositionInRange(today, startDate, endDate) * 100;
  }, [startDate, endDate]);

  // Calculate weeks with event segments for month view (continuous bars)
  const weeksWithEvents = useMemo((): WeekData[] => {
    if (view !== 'month') return [];

    const weeks: WeekData[] = [];

    // Get the first day of the month and calculate the start of the calendar grid
    const firstDay = new Date(startDate);
    const dayOfWeek = firstDay.getDay(); // 0 = Sunday

    // Build all dates for the calendar grid (including padding days)
    const allDates: Date[] = [];

    // Add days before the first of the month
    for (let i = dayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(firstDay);
      prevDate.setDate(prevDate.getDate() - (i + 1));
      allDates.push(prevDate);
    }

    // Add all dates in the month
    dates.forEach((date) => {
      allDates.push(new Date(date));
    });

    // Fill remaining days to complete the last week
    const remainingDays = (7 - (allDates.length % 7)) % 7;
    const lastDate = dates[dates.length - 1];
    for (let i = 1; i <= remainingDays; i++) {
      const nextDate = new Date(lastDate);
      nextDate.setDate(nextDate.getDate() + i);
      allDates.push(nextDate);
    }

    // Split into weeks
    for (let i = 0; i < allDates.length; i += 7) {
      const weekDates = allDates.slice(i, i + 7);
      const weekStart = startOfDay(weekDates[0]);
      const weekEnd = startOfDay(weekDates[6]);
      weekEnd.setHours(23, 59, 59, 999);

      // Find events that overlap with this week
      const weekSegments: EventSegment[] = [];
      const rowOccupancy: Map<number, number[]>[] = Array(7).fill(null).map(() => new Map());

      events.forEach((event) => {
        const eventStart = startOfDay(new Date(event.start));
        const eventEnd = startOfDay(new Date(event.end));

        // Check if event overlaps with this week
        if (eventEnd < weekStart || eventStart > weekEnd) {
          return; // No overlap
        }

        // IMPORTANT: Clip event to month boundaries
        const clippedStart = eventStart < startDate ? startDate : eventStart;
        const clippedEnd = eventEnd > endDate ? endDate : eventEnd;

        // Check if clipped event still overlaps with this week
        if (clippedEnd < weekStart || clippedStart > weekEnd) {
          return; // Clipped event doesn't overlap with this week
        }

        // Calculate start and end columns within this week (using clipped dates)
        let startCol = 0;
        let endCol = 6;
        let isStart = true;
        let isEnd = true;

        if (clippedStart > weekStart) {
          startCol = weekDates.findIndex((d) => isSameDay(d, clippedStart));
          if (startCol === -1) startCol = 0;
        } else {
          isStart = isSameDay(clippedStart, eventStart);
        }

        if (clippedEnd < weekEnd) {
          endCol = weekDates.findIndex((d) => isSameDay(d, clippedEnd));
          if (endCol === -1) endCol = 6;
        } else {
          isEnd = isSameDay(clippedEnd, eventEnd);
        }

        // Ensure we don't show events outside the current month in the week view
        // Clip to only show within current month dates
        const monthStartCol = weekDates.findIndex((d) => d >= startDate && d <= endDate);
        const monthEndCol = weekDates.findLastIndex((d) => d >= startDate && d <= endDate);

        if (monthStartCol === -1 || monthEndCol === -1) {
          return; // This week has no dates in the current month
        }

        // Adjust startCol and endCol to be within month bounds
        if (startCol < monthStartCol) {
          startCol = monthStartCol;
          isStart = false;
        }
        if (endCol > monthEndCol) {
          endCol = monthEndCol;
          isEnd = false;
        }

        if (startCol > endCol) {
          return; // Event doesn't appear in this week's month portion
        }

        const span = endCol - startCol + 1;

        // Find the first available row for this segment
        let row = 0;
        let foundRow = false;
        while (!foundRow) {
          foundRow = true;
          for (let col = startCol; col <= endCol; col++) {
            const occupied = rowOccupancy[col].get(row);
            if (occupied !== undefined) {
              foundRow = false;
              row++;
              break;
            }
          }
        }

        // Mark the row as occupied for these columns
        for (let col = startCol; col <= endCol; col++) {
          rowOccupancy[col].set(row, 1);
        }

        weekSegments.push({
          event,
          startCol,
          span,
          row,
          isStart,
          isEnd,
        });
      });

      weeks.push({
        dates: weekDates,
        segments: weekSegments,
      });
    }

    return weeks;
  }, [view, startDate, endDate, dates, events]);

  // Render month view (vertical calendar grid with continuous bars)
  if (view === 'month') {
    return (
      <div className="vt-calendar">
        {/* Weekday headers */}
        <div className="vt-calendar__header">
          {weekdays.map((day, i) => (
            <div key={i} className="vt-calendar__weekday">{day}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="vt-calendar__grid">
          {weeksWithEvents.map((week, weekIndex) => (
            <div key={weekIndex} className="vt-calendar__week">
              {/* Day cells */}
              {week.dates.map((date, dayIndex) => {
                const isCurrentMonth = date >= startDate && date <= endDate;
                const isTodayDate = isToday(date);

                return (
                  <div
                    key={dayIndex}
                    className={`vt-calendar__day ${!isCurrentMonth ? 'vt-calendar__day--outside' : ''} ${isTodayDate ? 'vt-calendar__day--today' : ''}`}
                  >
                    <span className={`vt-calendar__day-num ${isTodayDate ? 'vt-calendar__day-num--today' : ''}`}>
                      {date.getDate()}
                    </span>
                  </div>
                );
              })}

              {/* Event bars overlay */}
              <div className="vt-calendar__events-layer">
                {week.segments.slice(0, 6).map((segment, segIndex) => (
                  <div
                    key={`${segment.event.id}-${segIndex}`}
                    className={`vt-calendar__event-bar ${segment.isStart ? 'vt-calendar__event-bar--start' : ''} ${segment.isEnd ? 'vt-calendar__event-bar--end' : ''}`}
                    style={{
                      backgroundColor: getGrayscaleColor(segIndex),
                      left: `calc(${(segment.startCol / 7) * 100}% + var(--cal-event-offset-x, 4px))`,
                      width: `calc(${(segment.span / 7) * 100}% - calc(var(--cal-event-offset-x, 4px) * 2))`,
                      top: `calc(var(--cal-day-num-height, 26px) + ${segment.row} * (var(--cal-event-height, 18px) + var(--cal-event-gap, 4px)))`,
                    }}
                    title={`${segment.event.userDisplayName}: ${segment.event.title}`}
                  >
                    {segment.isStart && (
                      <span className="vt-calendar__event-label">
                        {segment.event.title} - {segment.event.userDisplayName.split(' ')[0]}
                      </span>
                    )}
                  </div>
                ))}
                {week.segments.length > 6 && (
                  <div className="vt-calendar__more-indicator">
                    {t('calendar.moreEvents', { count: week.segments.length - 6 })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Render horizontal timeline (default for day, week, year views)
  return (
    <div className="vt-timeline">
      {/* Header row with dates */}
      <div className="vt-timeline__header">
        <div className="vt-timeline__user-column">
          <span className="vt-timeline__user-header">Team</span>
        </div>
        <div className="vt-timeline__dates">
          {dates.map((date, index) => {
            const isTodayDate = isToday(date);
            return (
              <div
                key={index}
                className={`vt-timeline__date-cell ${isTodayDate ? 'vt-timeline__date-cell--today' : ''}`}
              >
                <span className="vt-timeline__date-day">{getDayName(date)}</span>
                <span className="vt-timeline__date-num">{date.getDate()}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline body with user rows */}
      <div className="vt-timeline__body">
        {users.map((user) => (
          <TimelineRow
            key={user.userId}
            user={user}
            events={eventsByUser.get(user.userId) || []}
            startDate={startDate}
            endDate={endDate}
            columnCount={dates.length}
          />
        ))}

        {/* Today marker - removed, was causing visual issues */}
      </div>
    </div>
  );
};
