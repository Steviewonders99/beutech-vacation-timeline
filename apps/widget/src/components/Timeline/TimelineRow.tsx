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
import type { VacationEvent, TimelineUser } from '../../types/vacation';
import { getPositionInRange, parseISODate } from '../../utils/dateUtils';
import './Timeline.css';

export interface TimelineRowProps {
  /** User for this row */
  user: TimelineUser;
  /** Events for this user */
  events: VacationEvent[];
  /** Start of the visible range */
  startDate: Date;
  /** End of the visible range */
  endDate: Date;
  /** Number of date columns */
  columnCount: number;
}

interface PositionedEvent {
  event: VacationEvent;
  left: number;
  width: number;
}

// Grayscale color for all event bars
const EVENT_COLOR = '#4b5563'; // gray-600
const EVENT_TEXT_COLOR = '#ffffff';

/**
 * A single row in the timeline representing one user's vacations.
 */
export const TimelineRow: React.FC<TimelineRowProps> = ({
  user,
  events,
  startDate,
  endDate,
}) => {
  // Calculate positioned events
  const positionedEvents = useMemo((): PositionedEvent[] => {
    // Calculate the number of days in the range for minimum width
    const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const oneDayWidth = 100 / totalDays; // Width of one day as percentage
    const minWidth = Math.max(oneDayWidth * 0.9, 10); // At least 90% of one day, minimum 10%

    return events.map((event) => {
      const eventStart = parseISODate(event.start);
      const eventEnd = parseISODate(event.end);

      // Clamp to visible range
      const visibleStart = eventStart < startDate ? startDate : eventStart;
      const visibleEnd = eventEnd > endDate ? endDate : eventEnd;

      const left = getPositionInRange(visibleStart, startDate, endDate) * 100;
      const right = getPositionInRange(visibleEnd, startDate, endDate) * 100;
      const width = Math.max(right - left, minWidth); // Minimum width of one day

      return { event, left, width };
    });
  }, [events, startDate, endDate]);

  return (
    <div className={`vt-timeline__row ${user.isCurrentUser ? 'vt-timeline__row--current-user' : ''}`}>
      {/* User name column */}
      <div className="vt-timeline__user-column">
        <span className="vt-timeline__user-name" title={user.displayName}>
          {user.displayName}
          {user.isCurrentUser && <span className="vt-timeline__me-indicator"> (me)</span>}
        </span>
      </div>

      {/* Events area */}
      <div className="vt-timeline__events-area">
        {/* Grid lines for each day */}
        <div className="vt-timeline__grid-overlay" aria-hidden="true" />

        {/* Event bars */}
        {positionedEvents.map(({ event, left, width }) => (
          <div
            key={event.id}
            className="vt-timeline__event-bar"
            style={{
              left: `${left}%`,
              width: `${width}%`,
              backgroundColor: EVENT_COLOR,
              color: EVENT_TEXT_COLOR,
            }}
            title={`${user.displayName}: ${event.title}`}
            role="img"
            aria-label={`${user.displayName}: ${event.title}`}
          >
            <span className="vt-timeline__event-label">{event.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
