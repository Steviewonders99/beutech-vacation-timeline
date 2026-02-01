/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Tests for VacationTimeline component.
 */

import React from 'react';
import { screen, render, waitFor, fireEvent } from '@testing-library/react';
import { VacationTimeline } from './vacation-timeline';

// Mock the hooks
jest.mock('./hooks/useStaffbaseUserContext', () => ({
  useStaffbaseUserContext: () => ({
    user: null,
    m365Upn: null,
    isLoading: false,
    managerEmail: null,
    isSupervisor: false,
  }),
}));

jest.mock('./hooks/useVacationData', () => ({
  useVacationData: jest.fn(() => ({
    events: [],
    users: [],
    isLoading: false,
    error: null,
    refresh: jest.fn(),
  })),
}));

jest.mock('./hooks/useNextEventDate', () => ({
  useNextEventDate: jest.fn(() => ({
    nextEventDate: null,
    isLoading: false,
    error: null,
  })),
}));

jest.mock('./hooks/useTimeOffRequest', () => ({
  useTimeOffRequest: jest.fn(() => ({
    submitRequest: jest.fn(),
    isSubmitting: false,
    error: null,
    reset: jest.fn(),
  })),
}));

jest.mock('./hooks/useMyRequests', () => ({
  useMyRequests: jest.fn(() => ({
    requests: [],
    isLoading: false,
    error: null,
    refresh: jest.fn(),
  })),
}));

jest.mock('./hooks/usePendingApprovals', () => ({
  usePendingApprovals: jest.fn(() => ({
    requests: [],
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    approveRequest: jest.fn(),
    rejectRequest: jest.fn(),
    isProcessing: false,
  })),
}));

// Mock mockData module to disable mock data in tests (simulating production)
jest.mock('./utils/mockData', () => ({
  shouldUseMockData: () => false,
}));

// Import the mock so we can modify it
import { useVacationData } from './hooks/useVacationData';
const mockUseVacationData = useVacationData as jest.Mock;

describe('VacationTimeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseVacationData.mockReturnValue({
      events: [],
      users: [],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
  });

  describe('configuration validation', () => {
    it('should show error when apiBaseUrl is missing', () => {
      render(<VacationTimeline apiKey="test-key" contentLanguage="en_US" />);

      expect(screen.getByText(/Widget configuration is incomplete/i)).toBeInTheDocument();
    });

    it('should show error when apiKey is missing', () => {
      render(
        <VacationTimeline apiBaseUrl="https://api.example.com" contentLanguage="en_US" />
      );

      expect(screen.getByText(/Widget configuration is incomplete/i)).toBeInTheDocument();
    });

    it('should show error when both are missing', () => {
      render(<VacationTimeline contentLanguage="en_US" />);

      expect(screen.getByText(/Widget configuration is incomplete/i)).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading state when data is loading', () => {
      mockUseVacationData.mockReturnValue({
        events: [],
        users: [],
        isLoading: true,
        error: null,
        refresh: jest.fn(),
      });

      render(
        <VacationTimeline
          apiBaseUrl="https://api.example.com"
          apiKey="test-key"
          contentLanguage="en_US"
        />
      );

      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should show error message when there is an error', () => {
      mockUseVacationData.mockReturnValue({
        events: [],
        users: [],
        isLoading: false,
        error: 'Failed to fetch vacations',
        refresh: jest.fn(),
      });

      render(
        <VacationTimeline
          apiBaseUrl="https://api.example.com"
          apiKey="test-key"
          contentLanguage="en_US"
        />
      );

      expect(screen.getByText(/Failed to fetch vacations/i)).toBeInTheDocument();
    });

    it('should show retry button on error', () => {
      const mockRefresh = jest.fn();
      mockUseVacationData.mockReturnValue({
        events: [],
        users: [],
        isLoading: false,
        error: 'Network error',
        refresh: mockRefresh,
      });

      render(
        <VacationTimeline
          apiBaseUrl="https://api.example.com"
          apiKey="test-key"
          contentLanguage="en_US"
        />
      );

      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  describe('empty state', () => {
    it('should show empty state when no events', () => {
      mockUseVacationData.mockReturnValue({
        events: [],
        users: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      render(
        <VacationTimeline
          apiBaseUrl="https://api.example.com"
          apiKey="test-key"
          contentLanguage="en_US"
        />
      );

      expect(screen.getByText(/No vacations found/i)).toBeInTheDocument();
    });
  });

  describe('header controls', () => {
    const mockEvents = [
      {
        id: '1',
        userId: 'user1@example.com',
        userDisplayName: 'User One',
        userColorKey: 'user1@example.com',
        title: 'Vacation',
        start: '2025-05-05T00:00:00Z',
        end: '2025-05-10T00:00:00Z',
      },
    ];

    const mockUsers = [
      {
        userId: 'user1@example.com',
        displayName: 'User One',
        colorKey: 'user1@example.com',
        color: '#4E79A7',
        isCurrentUser: false,
      },
    ];

    beforeEach(() => {
      mockUseVacationData.mockReturnValue({
        events: mockEvents,
        users: mockUsers,
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });
    });

    it('should render view toggle buttons', () => {
      render(
        <VacationTimeline
          apiBaseUrl="https://api.example.com"
          apiKey="test-key"
          contentLanguage="en_US"
        />
      );

      // Use exact match to avoid "Today" matching "day"
      expect(screen.getByRole('button', { name: 'Day' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Week' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Month' })).toBeInTheDocument();
    });

    it('should render navigation buttons', () => {
      render(
        <VacationTimeline
          apiBaseUrl="https://api.example.com"
          apiKey="test-key"
          contentLanguage="en_US"
        />
      );

      expect(screen.getByRole('button', { name: /today/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous period/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next period/i })).toBeInTheDocument();
    });

    it('should change view when view button is clicked', async () => {
      render(
        <VacationTimeline
          apiBaseUrl="https://api.example.com"
          apiKey="test-key"
          defaultView="week"
          contentLanguage="en_US"
        />
      );

      const monthButton = screen.getByRole('button', { name: /month/i });
      fireEvent.click(monthButton);

      // The component should re-render with month view
      await waitFor(() => {
        expect(monthButton).toHaveAttribute('aria-pressed', 'true');
      });
    });
  });

  describe('user filter', () => {
    const mockUsers = [
      {
        userId: 'user1@example.com',
        displayName: 'User One',
        colorKey: 'user1@example.com',
        color: '#4E79A7',
        isCurrentUser: false,
      },
      {
        userId: 'user2@example.com',
        displayName: 'User Two',
        colorKey: 'user2@example.com',
        color: '#F28E2B',
        isCurrentUser: false,
      },
    ];

    const mockEvents = [
      {
        id: '1',
        userId: 'user1@example.com',
        userDisplayName: 'User One',
        userColorKey: 'user1@example.com',
        title: 'Vacation',
        start: '2025-05-05T00:00:00Z',
        end: '2025-05-10T00:00:00Z',
      },
      {
        id: '2',
        userId: 'user2@example.com',
        userDisplayName: 'User Two',
        userColorKey: 'user2@example.com',
        title: 'PTO',
        start: '2025-05-07T00:00:00Z',
        end: '2025-05-12T00:00:00Z',
      },
    ];

    beforeEach(() => {
      mockUseVacationData.mockReturnValue({
        events: mockEvents,
        users: mockUsers,
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });
    });

    it('should render user filter when users are present', () => {
      render(
        <VacationTimeline
          apiBaseUrl="https://api.example.com"
          apiKey="test-key"
          contentLanguage="en_US"
        />
      );

      expect(screen.getByText(/All team members/i)).toBeInTheDocument();
    });
  });

  describe('language support', () => {
    it('should pass content language to widget container', () => {
      mockUseVacationData.mockReturnValue({
        events: [],
        users: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      const { container } = render(
        <VacationTimeline
          apiBaseUrl="https://api.example.com"
          apiKey="test-key"
          contentLanguage="de_DE"
        />
      );

      const widget = container.querySelector('.vt-widget');
      expect(widget).toHaveAttribute('lang', 'de_DE');
    });
  });
});
