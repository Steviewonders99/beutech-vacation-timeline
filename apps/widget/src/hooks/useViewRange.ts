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

/**
 * Hook for managing the view range based on view type and anchor date.
 */

import { useMemo, useCallback, useState } from 'react';
import type { VacationView, ViewRange } from '../types/vacation';
import { calculateViewRange, navigateDate } from '../utils/dateUtils';

export interface UseViewRangeOptions {
  /** Initial view type */
  initialView?: VacationView;
  /** Initial anchor date (defaults to today) */
  initialDate?: Date;
}

export interface UseViewRangeReturn {
  /** Current view type */
  view: VacationView;
  /** Current anchor date */
  anchorDate: Date;
  /** Calculated view range with start, end, and label */
  viewRange: ViewRange;
  /** Set the view type */
  setView: (view: VacationView) => void;
  /** Navigate to a specific date */
  goToDate: (date: Date) => void;
  /** Go to today */
  goToToday: () => void;
  /** Go to the next period */
  goToNext: () => void;
  /** Go to the previous period */
  goToPrevious: () => void;
}

/**
 * Hook that manages the current view range for the timeline.
 * Provides navigation functions and calculates the date range based on view type.
 *
 * @param options - Configuration options
 * @returns View range state and navigation functions
 *
 * @example
 * ```tsx
 * const { view, viewRange, setView, goToNext, goToPrevious } = useViewRange({
 *   initialView: 'week',
 * });
 *
 * return (
 *   <div>
 *     <span>{viewRange.label}</span>
 *     <button onClick={goToPrevious}>Previous</button>
 *     <button onClick={goToNext}>Next</button>
 *   </div>
 * );
 * ```
 */
export function useViewRange(options: UseViewRangeOptions = {}): UseViewRangeReturn {
  const { initialView = 'week', initialDate } = options;

  const [view, setView] = useState<VacationView>(initialView);
  const [anchorDate, setAnchorDate] = useState<Date>(initialDate ?? new Date());

  // Calculate the view range whenever view or anchor date changes
  const viewRange = useMemo(
    () => calculateViewRange(view, anchorDate),
    [view, anchorDate]
  );

  // Navigation functions
  const goToDate = useCallback((date: Date) => {
    setAnchorDate(date);
  }, []);

  const goToToday = useCallback(() => {
    setAnchorDate(new Date());
  }, []);

  const goToNext = useCallback(() => {
    setAnchorDate((current) => navigateDate(current, view, 1));
  }, [view]);

  const goToPrevious = useCallback(() => {
    setAnchorDate((current) => navigateDate(current, view, -1));
  }, [view]);

  return {
    view,
    anchorDate,
    viewRange,
    setView,
    goToDate,
    goToToday,
    goToNext,
    goToPrevious,
  };
}
