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
 * Mock data for development and testing.
 * Generates realistic vacation events around the current date.
 */

import type { VacationEvent, VacationsApiResponse } from '../types/vacation';
import type { TimeOffRequest, RequestStatus, LeaveType } from '../types/request';
import { addDays, startOfWeek } from './dateUtils';

/**
 * Sample employees for mock data.
 */
const MOCK_EMPLOYEES = [
  { id: 'sarah.johnson@beautech.com', name: 'Sarah Johnson' },
  { id: 'michael.chen@beautech.com', name: 'Michael Chen' },
  { id: 'emma.williams@beautech.com', name: 'Emma Williams' },
  { id: 'james.rodriguez@beautech.com', name: 'James Rodriguez' },
  { id: 'olivia.taylor@beautech.com', name: 'Olivia Taylor' },
  { id: 'david.kim@beautech.com', name: 'David Kim' },
  { id: 'sophia.martinez@beautech.com', name: 'Sophia Martinez' },
  { id: 'william.brown@beautech.com', name: 'William Brown' },
];

/**
 * Vacation titles for variety.
 */
const VACATION_TITLES = [
  'Vacation',
  'PTO',
  'Annual Leave',
  'Holiday',
  'Time Off',
  'Family Vacation',
  'Personal Day',
];

/**
 * Generate a random integer between min and max (inclusive).
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick a random item from an array.
 */
function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate mock vacation events centered around the current date.
 * Creates a realistic distribution of vacations across employees.
 */
export function generateMockVacations(
  startDate: Date,
  endDate: Date
): VacationEvent[] {
  const events: VacationEvent[] = [];
  const baseDate = startOfWeek(new Date());

  // Generate vacations for each employee
  MOCK_EMPLOYEES.forEach((employee, index) => {
    // Each employee has 1-3 vacation periods
    const numVacations = randomInt(1, 3);

    for (let i = 0; i < numVacations; i++) {
      // Spread vacations across the viewing window
      const dayOffset = randomInt(-7, 21) + (index * 2);
      const vacationStart = addDays(baseDate, dayOffset);
      const duration = randomInt(1, 7); // 1-7 days
      const vacationEnd = addDays(vacationStart, duration);

      // Only include if overlaps with requested range
      if (vacationEnd >= startDate && vacationStart <= endDate) {
        events.push({
          id: `mock-${employee.id}-${i}-${Date.now()}`,
          userId: employee.id,
          userDisplayName: employee.name,
          userColorKey: employee.id,
          title: randomItem(VACATION_TITLES),
          start: vacationStart.toISOString(),
          end: vacationEnd.toISOString(),
        });
      }
    }
  });

  // Sort by start date
  return events.sort((a, b) =>
    new Date(a.start).getTime() - new Date(b.start).getTime()
  );
}

/**
 * Generate a complete mock API response.
 */
export function generateMockResponse(
  startDate: Date,
  endDate: Date
): VacationsApiResponse {
  return {
    events: generateMockVacations(startDate, endDate),
    meta: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Predefined static mock data for consistent previews.
 * Uses dates relative to "today" for always-relevant display.
 */
export function getStaticMockVacations(): VacationEvent[] {
  const today = new Date();
  const weekStart = startOfWeek(today);

  return [
    // Sarah - long vacation starting this week
    {
      id: 'static-1',
      userId: 'sarah.johnson@beautech.com',
      userDisplayName: 'Sarah Johnson',
      userColorKey: 'sarah.johnson@beautech.com',
      title: 'Summer Vacation',
      start: addDays(weekStart, 1).toISOString(),
      end: addDays(weekStart, 8).toISOString(),
    },
    // Michael - short trip mid-week
    {
      id: 'static-2',
      userId: 'michael.chen@beautech.com',
      userDisplayName: 'Michael Chen',
      userColorKey: 'michael.chen@beautech.com',
      title: 'PTO',
      start: addDays(weekStart, 3).toISOString(),
      end: addDays(weekStart, 5).toISOString(),
    },
    // Emma - vacation starting next week
    {
      id: 'static-3',
      userId: 'emma.williams@beautech.com',
      userDisplayName: 'Emma Williams',
      userColorKey: 'emma.williams@beautech.com',
      title: 'Family Trip',
      start: addDays(weekStart, 7).toISOString(),
      end: addDays(weekStart, 12).toISOString(),
    },
    // James - single day off
    {
      id: 'static-4',
      userId: 'james.rodriguez@beautech.com',
      userDisplayName: 'James Rodriguez',
      userColorKey: 'james.rodriguez@beautech.com',
      title: 'Personal Day',
      start: addDays(weekStart, 2).toISOString(),
      end: addDays(weekStart, 2).toISOString(),
    },
    // Olivia - overlapping with Sarah
    {
      id: 'static-5',
      userId: 'olivia.taylor@beautech.com',
      userDisplayName: 'Olivia Taylor',
      userColorKey: 'olivia.taylor@beautech.com',
      title: 'Annual Leave',
      start: addDays(weekStart, 4).toISOString(),
      end: addDays(weekStart, 10).toISOString(),
    },
    // David - weekend trip extending into week
    {
      id: 'static-6',
      userId: 'david.kim@beautech.com',
      userDisplayName: 'David Kim',
      userColorKey: 'david.kim@beautech.com',
      title: 'Holiday',
      start: addDays(weekStart, -2).toISOString(),
      end: addDays(weekStart, 1).toISOString(),
    },
    // Sophia - future vacation
    {
      id: 'static-7',
      userId: 'sophia.martinez@beautech.com',
      userDisplayName: 'Sophia Martinez',
      userColorKey: 'sophia.martinez@beautech.com',
      title: 'Vacation',
      start: addDays(weekStart, 10).toISOString(),
      end: addDays(weekStart, 14).toISOString(),
    },
    // William - another single day
    {
      id: 'static-8',
      userId: 'william.brown@beautech.com',
      userDisplayName: 'William Brown',
      userColorKey: 'william.brown@beautech.com',
      title: 'Doctor Appointment',
      start: addDays(weekStart, 5).toISOString(),
      end: addDays(weekStart, 5).toISOString(),
    },
  ];
}

/**
 * Check if we're in development mode.
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' ||
         typeof window !== 'undefined' && window.location.hostname === 'localhost';
}

/**
 * Check if mock data should be used.
 * Returns true in development when no real API is configured.
 */
export function shouldUseMockData(apiBaseUrl: string): boolean {
  // Use mock data if:
  // 1. In development mode AND
  // 2. API URL is empty, placeholder, or localhost
  if (!isDevelopment()) return false;

  if (!apiBaseUrl) return true;
  if (apiBaseUrl === 'https://example.com') return true;
  if (apiBaseUrl.includes('placeholder')) return true;

  return false;
}

/**
 * Gets the first future event date from mock data.
 * Returns the start date (YYYY-MM-DD) of the first event that starts today or later.
 */
export function getFirstFutureEventDate(): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const events = getStaticMockVacations();

  // Events are already sorted by start date
  for (const event of events) {
    const eventStart = new Date(event.start);
    eventStart.setHours(0, 0, 0, 0);

    if (eventStart >= today) {
      // Return just the date portion (YYYY-MM-DD)
      return event.start.split('T')[0];
    }
  }

  return null;
}

/**
 * Format date as YYYY-MM-DD string.
 */
function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Generate mock time-off requests for the current user.
 */
export function getMockMyRequests(userEmail: string): TimeOffRequest[] {
  const today = new Date();
  const weekStart = startOfWeek(today);

  return [
    // Approved past request
    {
      id: 'mock-req-1',
      requesterEmail: userEmail,
      requesterName: 'Lucy Liu',
      supervisorEmail: 'manager@company.com',
      supervisorName: 'John Manager',
      startDate: formatDateString(addDays(weekStart, -14)),
      endDate: formatDateString(addDays(weekStart, -12)),
      leaveType: 'vacation' as LeaveType,
      reason: 'Family trip',
      status: 'approved' as RequestStatus,
      statusChangedAt: addDays(weekStart, -16).toISOString(),
      statusChangedBy: 'manager@company.com',
      createdAt: addDays(weekStart, -20).toISOString(),
      updatedAt: addDays(weekStart, -16).toISOString(),
    },
    // Pending request
    {
      id: 'mock-req-2',
      requesterEmail: userEmail,
      requesterName: 'Lucy Liu',
      supervisorEmail: 'manager@company.com',
      supervisorName: 'John Manager',
      startDate: formatDateString(addDays(weekStart, 7)),
      endDate: formatDateString(addDays(weekStart, 10)),
      leaveType: 'vacation' as LeaveType,
      reason: 'Beach vacation',
      status: 'pending' as RequestStatus,
      createdAt: addDays(weekStart, -2).toISOString(),
      updatedAt: addDays(weekStart, -2).toISOString(),
    },
    // Rejected request
    {
      id: 'mock-req-3',
      requesterEmail: userEmail,
      requesterName: 'Lucy Liu',
      supervisorEmail: 'manager@company.com',
      supervisorName: 'John Manager',
      startDate: formatDateString(addDays(weekStart, -7)),
      endDate: formatDateString(addDays(weekStart, -5)),
      leaveType: 'personal' as LeaveType,
      status: 'rejected' as RequestStatus,
      rejectionReason: 'Team has critical deadline that week',
      statusChangedAt: addDays(weekStart, -10).toISOString(),
      statusChangedBy: 'manager@company.com',
      createdAt: addDays(weekStart, -14).toISOString(),
      updatedAt: addDays(weekStart, -10).toISOString(),
    },
    // Another approved request
    {
      id: 'mock-req-4',
      requesterEmail: userEmail,
      requesterName: 'Lucy Liu',
      supervisorEmail: 'manager@company.com',
      supervisorName: 'John Manager',
      startDate: formatDateString(addDays(weekStart, 21)),
      endDate: formatDateString(addDays(weekStart, 21)),
      leaveType: 'sick' as LeaveType,
      reason: 'Doctor appointment',
      status: 'approved' as RequestStatus,
      statusChangedAt: addDays(weekStart, -1).toISOString(),
      statusChangedBy: 'manager@company.com',
      createdAt: addDays(weekStart, -3).toISOString(),
      updatedAt: addDays(weekStart, -1).toISOString(),
    },
  ];
}

/**
 * Generate mock pending approvals for supervisors.
 */
/**
 * Mock organization hierarchy data for development.
 */
export interface MockOrgData {
  /** The user's manager */
  manager: {
    id: string;
    displayName: string;
    email: string;
  };
  /** Whether the user has direct reports */
  hasDirectReports: boolean;
}

/**
 * Get mock organization data for development.
 * In dev mode, simulate that the user is a supervisor with a manager.
 */
export function getMockOrgData(userEmail: string): MockOrgData {
  return {
    manager: {
      id: 'manager-001',
      displayName: 'John Manager',
      email: 'john.manager@company.com',
    },
    // In dev mode, assume user is a supervisor so we can test Approvals tab
    hasDirectReports: true,
  };
}

/**
 * Check if mock org data should be used (development mode).
 */
export function shouldUseMockOrgData(): boolean {
  return isDevelopment();
}

export function getMockPendingApprovals(supervisorEmail: string): TimeOffRequest[] {
  const today = new Date();
  const weekStart = startOfWeek(today);

  return [
    {
      id: 'mock-approval-1',
      requesterEmail: 'alice.smith@company.com',
      requesterName: 'Alice Smith',
      supervisorEmail: supervisorEmail,
      supervisorName: 'Lucy Liu',
      startDate: formatDateString(addDays(weekStart, 5)),
      endDate: formatDateString(addDays(weekStart, 9)),
      leaveType: 'vacation' as LeaveType,
      reason: 'Spring break trip with family',
      status: 'pending' as RequestStatus,
      createdAt: addDays(weekStart, -1).toISOString(),
      updatedAt: addDays(weekStart, -1).toISOString(),
    },
    {
      id: 'mock-approval-2',
      requesterEmail: 'bob.jones@company.com',
      requesterName: 'Bob Jones',
      supervisorEmail: supervisorEmail,
      supervisorName: 'Lucy Liu',
      startDate: formatDateString(addDays(weekStart, 3)),
      endDate: formatDateString(addDays(weekStart, 3)),
      leaveType: 'personal' as LeaveType,
      reason: 'Moving to new apartment',
      status: 'pending' as RequestStatus,
      createdAt: addDays(weekStart, -3).toISOString(),
      updatedAt: addDays(weekStart, -3).toISOString(),
    },
  ];
}
