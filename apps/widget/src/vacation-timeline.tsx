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

import React, { useState, useMemo, useCallback, useEffect, useRef, ReactElement } from 'react';
import { BlockAttributes, WidgetApi } from 'widget-sdk';

// i18n
import './i18n'; // Initialize i18n
import { useLanguage } from './hooks/useLanguage';

// Types
import type { VacationView, TimelineUser } from './types/vacation';
import type { WidgetConfiguration } from './types/config';
import type { LeaveType } from './types/request';
import { DEFAULT_CONFIG, PRODUCTION_CONFIG } from './types/config';

// Hooks
import { useViewRange } from './hooks/useViewRange';
import { useStaffbaseUserContext } from './hooks/useStaffbaseUserContext';
import { useVacationData } from './hooks/useVacationData';
import { useNextEventDate } from './hooks/useNextEventDate';
import { useTimeOffRequest } from './hooks/useTimeOffRequest';
import { useMyRequests } from './hooks/useMyRequests';
import { usePendingApprovals } from './hooks/usePendingApprovals';
import { useSupervisorStatus } from './hooks/useSupervisorStatus';

// Utils
import { buildOutlookDeepLink } from './utils/deepLinkUtils';
import { shouldUseMockData } from './utils/mockData';

// Components
import { CalendarHeader } from './components/CalendarHeader';
import { UserFilter } from './components/UserFilter';
import { Timeline } from './components/Timeline';
import { LoadingState, ErrorState, EmptyState } from './components/LoadingError';
import { RequestModal } from './components/RequestModal';
import { MyRequests } from './components/MyRequests';
import { ApprovalDashboard } from './components/ApprovalDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

/** Available view tabs */
type ViewTab = 'calendar' | 'my-requests' | 'approvals';

// Styles
import './vacation-timeline.css';

/**
 * Props for the VacationTimeline widget component.
 */
export interface VacationTimelineProps extends BlockAttributes, Partial<WidgetConfiguration> {
  /** Staffbase Widget API instance */
  widgetApi?: WidgetApi | null;
}

/**
 * Main Vacation Timeline widget component.
 * Displays a multi-user vacation timeline with filtering and navigation.
 */
export const VacationTimeline = ({
  // Widget configuration (from Staffbase Studio - with production fallbacks)
  apiBaseUrl: propsApiBaseUrl = '',
  apiKey: propsApiKey = '',
  calendarMode = DEFAULT_CONFIG.calendarMode!,
  sharedCalendarMailbox: propsSharedCalendarMailbox,
  defaultView = DEFAULT_CONFIG.defaultView!,
  darkMode = DEFAULT_CONFIG.darkMode!,
  vacationCategory = DEFAULT_CONFIG.vacationCategory!,
  maxUsers = DEFAULT_CONFIG.maxUsers!,
  m365FallbackDomain: propsM365FallbackDomain,
  // SAML deep link settings
  enableOutlookDeepLink = DEFAULT_CONFIG.enableOutlookDeepLink!,
  staffbaseHost,
  samlPluginId,
  samlPluginInstanceId,
  outlookCalendarUrl = DEFAULT_CONFIG.outlookCalendarUrl!,
  // Staffbase SDK
  widgetApi = null,
  contentLanguage,
}: VacationTimelineProps): ReactElement => {
  // Use production config as fallback when Staffbase config is empty
  const apiBaseUrl = propsApiBaseUrl || PRODUCTION_CONFIG.apiBaseUrl;
  const apiKey = propsApiKey; // Optional - origin-based auth used if not provided
  const sharedCalendarMailbox = propsSharedCalendarMailbox || PRODUCTION_CONFIG.sharedCalendarMailbox;
  const m365FallbackDomain = propsM365FallbackDomain || PRODUCTION_CONFIG.m365FallbackDomain;

  // DEBUG: Log configuration source
  useEffect(() => {
    console.log('[VacationTimeline] Configuration:', {
      apiBaseUrl,
      authMethod: apiKey ? 'API Key' : 'Origin-based (secure)',
      source: propsApiBaseUrl ? 'Staffbase Studio' : 'Production defaults',
      calendarMode,
      sharedCalendarMailbox,
    });
  }, [apiBaseUrl, apiKey, propsApiBaseUrl, calendarMode, sharedCalendarMailbox]);
  // Initialize i18n with Staffbase language
  const { t } = useLanguage(contentLanguage);

  // Get current Staffbase user context (includes manager info)
  const {
    user: staffbaseUser,
    m365Upn,
    isLoading: userLoading,
    managerEmail,
  } = useStaffbaseUserContext(widgetApi, m365FallbackDomain);

  // View range state (view type + current date)
  const {
    view,
    anchorDate,
    viewRange,
    setView,
    goToDate,
    goToToday,
    goToNext,
    goToPrevious,
  } = useViewRange({
    initialView: defaultView as VacationView,
  });

  // Selected users for filtering
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Active tab state
  const [activeTab, setActiveTab] = useState<ViewTab>('calendar');

  // Request modal state
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  // API configuration
  const apiConfig = useMemo(
    () => ({
      baseUrl: apiBaseUrl,
      apiKey: apiKey,
    }),
    [apiBaseUrl, apiKey]
  );

  // Check if we have required configuration (or should use mock data in development)
  const useMockData = shouldUseMockData(apiBaseUrl);
  // API key is optional - origin-based auth is used when running in Staffbase
  const hasRequiredConfig = apiBaseUrl || useMockData;

  // Time-off request hook
  const {
    submitRequest,
    isSubmitting: isRequestSubmitting,
    error: requestError,
    reset: resetRequestState,
  } = useTimeOffRequest({
    apiConfig,
  });

  // Derive user display name for requests
  const userDisplayName = useMemo(() => {
    if (staffbaseUser?.displayName) {
      return staffbaseUser.displayName;
    }
    if (staffbaseUser?.firstName) {
      return [staffbaseUser.firstName, staffbaseUser.lastName].filter(Boolean).join(' ');
    }
    return m365Upn || 'User';
  }, [staffbaseUser, m365Upn]);

  // My requests hook
  const {
    requests: myRequests,
    isLoading: myRequestsLoading,
    error: myRequestsError,
    refresh: refreshMyRequests,
    cancelRequest,
    isCancelling,
  } = useMyRequests({
    apiConfig,
    userEmail: m365Upn,
    skip: !hasRequiredConfig || !m365Upn,
  });

  // Check if user is a supervisor (has direct reports in the system)
  const { isSupervisor } = useSupervisorStatus({
    apiConfig,
    email: m365Upn,
    skip: !hasRequiredConfig || !m365Upn,
  });

  // Pending approvals hook - only fetch if user is a supervisor
  const {
    pendingRequests,
    isLoading: approvalsLoading,
    error: approvalsError,
    approveRequest,
    rejectRequest,
    isActioning,
    refresh: refreshApprovals,
  } = usePendingApprovals({
    apiConfig,
    supervisorEmail: m365Upn,
    // Skip if not configured, no email, or user is not a supervisor
    skip: !hasRequiredConfig || !m365Upn || !isSupervisor,
  });

  // Fetch the first future event date to initialize the view
  const { nextEventDate, isLoading: nextEventLoading } = useNextEventDate({
    apiConfig,
    skip: !hasRequiredConfig,
  });

  // Track if we've already navigated to the first event date
  const hasNavigatedToNextEvent = useRef(false);

  // Navigate to the first future event date when it loads (only once)
  useEffect(() => {
    if (nextEventDate && !hasNavigatedToNextEvent.current && !nextEventLoading) {
      hasNavigatedToNextEvent.current = true;
      goToDate(nextEventDate);
    }
  }, [nextEventDate, nextEventLoading, goToDate]);

  // Fetch vacation data
  const {
    events,
    users,
    isLoading: dataLoading,
    error,
    refresh,
  } = useVacationData({
    apiConfig,
    startDate: viewRange.start,
    endDate: viewRange.end,
    view,
    selectedUsers: selectedUserIds.length > 0 ? selectedUserIds : undefined,
    currentUserUpn: m365Upn,
    skip: !hasRequiredConfig && !useMockData,
  });

  // Filter users based on selection
  const filteredUsers = useMemo((): TimelineUser[] => {
    if (selectedUserIds.length === 0) {
      return users.slice(0, maxUsers);
    }
    return users.filter((u) => selectedUserIds.includes(u.userId)).slice(0, maxUsers);
  }, [users, selectedUserIds, maxUsers]);

  // Filter events based on selected users
  const filteredEvents = useMemo(() => {
    if (selectedUserIds.length === 0) {
      return events;
    }
    return events.filter((e) => selectedUserIds.includes(e.userId));
  }, [events, selectedUserIds]);

  // Handle view change
  const handleViewChange = useCallback((newView: VacationView) => {
    setView(newView);
  }, [setView]);

  // Handle user filter change
  const handleUserFilterChange = useCallback((userIds: string[]) => {
    setSelectedUserIds(userIds);
  }, []);

  // Handle opening the request modal
  const handleOpenRequestModal = useCallback(() => {
    resetRequestState();
    setIsRequestModalOpen(true);
  }, [resetRequestState]);

  // Handle closing the request modal
  const handleCloseRequestModal = useCallback(() => {
    setIsRequestModalOpen(false);
    resetRequestState();
  }, [resetRequestState]);

  // Handle request submission
  const handleSubmitRequest = useCallback(
    async (data: {
      startDate: string;
      endDate: string;
      leaveType: LeaveType;
      reason?: string;
    }) => {
      if (!m365Upn) {
        throw new Error('User email is required');
      }
      await submitRequest({
        requesterEmail: m365Upn,
        requesterName: userDisplayName,
        startDate: data.startDate,
        endDate: data.endDate,
        leaveType: data.leaveType,
        reason: data.reason,
      });
      // Refresh my requests after successful submission
      refreshMyRequests();
      // Refresh calendar data in case it shows the new request
      refresh();
    },
    [submitRequest, refreshMyRequests, refresh, m365Upn, userDisplayName]
  );

  // Handle tab change
  const handleTabChange = useCallback((tab: ViewTab) => {
    setActiveTab(tab);
  }, []);

  // Determine current user ID for "Only Me" filter
  const currentUserId = useMemo(() => {
    if (!m365Upn) return undefined;
    const currentUser = users.find((u) => u.isCurrentUser);
    return currentUser?.userId;
  }, [users, m365Upn]);

  // Build Outlook deep link URL (if configured)
  const outlookDeepLink = useMemo(() => {
    return buildOutlookDeepLink({
      enableOutlookDeepLink,
      staffbaseHost,
      samlPluginId,
      samlPluginInstanceId,
      outlookCalendarUrl,
    });
  }, [enableOutlookDeepLink, staffbaseHost, samlPluginId, samlPluginInstanceId, outlookCalendarUrl]);

  // Render loading state (include nextEventLoading only on initial load)
  const isLoading = userLoading || dataLoading || (!hasNavigatedToNextEvent.current && nextEventLoading);

  // Build widget class names
  // Handle darkMode as boolean or string "true"/"false" (HTML attributes are strings)
  const isDarkMode = darkMode === true || darkMode === 'true';

  const widgetClassName = useMemo(() => {
    const classes = ['vt-widget'];
    if (isDarkMode) classes.push('vt-widget--dark');
    return classes.join(' ');
  }, [isDarkMode]);

  // Show configuration error if API settings are missing
  if (!hasRequiredConfig) {
    return (
      <ErrorBoundary>
        <div className={`${widgetClassName} vt-widget--error`}>
          <ErrorState
            message={`${t('errors.configIncomplete')}. ${t('errors.configMissing')}`}
          />
        </div>
      </ErrorBoundary>
    );
  }

  // Check if user should see the Approvals tab
  // Show if user is a supervisor (has direct reports in the system)
  const showApprovalsTab = isSupervisor;

  return (
    <ErrorBoundary>
    <div className={widgetClassName} lang={contentLanguage}>
      {/* Tabs for navigation */}
      <div className="vt-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'calendar'}
          className={`vt-tabs__tab ${activeTab === 'calendar' ? 'vt-tabs__tab--active' : ''}`}
          onClick={(e) => { handleTabChange('calendar'); (e.target as HTMLButtonElement).blur(); }}
          style={{ outline: 'none', boxShadow: 'none', WebkitAppearance: 'none' }}
        >
          <svg className="vt-tabs__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M12.667 2.667H3.333C2.597 2.667 2 3.264 2 4v9.333c0 .737.597 1.334 1.333 1.334h9.334c.736 0 1.333-.597 1.333-1.334V4c0-.736-.597-1.333-1.333-1.333zM10.667 1.333v2.667M5.333 1.333v2.667M2 6.667h12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="vt-tabs__text">{t('tabs.calendar')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'my-requests'}
          className={`vt-tabs__tab ${activeTab === 'my-requests' ? 'vt-tabs__tab--active' : ''}`}
          onClick={(e) => { handleTabChange('my-requests'); (e.target as HTMLButtonElement).blur(); }}
          style={{ outline: 'none', boxShadow: 'none', WebkitAppearance: 'none' }}
        >
          <svg className="vt-tabs__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 14H3.333A1.333 1.333 0 012 12.667V3.333A1.333 1.333 0 013.333 2h9.334A1.333 1.333 0 0114 3.333V8M5.333 6h5.334M5.333 8.667h2.667M11.333 11.333l1.334 1.334 2.666-2.667"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="vt-tabs__text">{t('tabs.myRequests')}</span>
          {myRequests.filter((r) => r.status === 'pending').length > 0 && (
            <span className="vt-tabs__badge vt-tabs__badge--pending">
              {myRequests.filter((r) => r.status === 'pending').length}
            </span>
          )}
        </button>
        {showApprovalsTab && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'approvals'}
            className={`vt-tabs__tab ${activeTab === 'approvals' ? 'vt-tabs__tab--active' : ''}`}
            onClick={(e) => { handleTabChange('approvals'); (e.target as HTMLButtonElement).blur(); }}
            style={{ outline: 'none', boxShadow: 'none', WebkitAppearance: 'none' }}
          >
            <svg className="vt-tabs__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M14 7.333A6.667 6.667 0 114.36 3.333M14 3.333v4h-4M4.667 10l2 2 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="vt-tabs__text">{t('tabs.approvals')}</span>
            <span className="vt-tabs__badge vt-tabs__badge--approvals">
              {pendingRequests.length}
            </span>
          </button>
        )}
        <div className="vt-tabs__spacer" />
        <button
          type="button"
          className="vt-btn vt-btn--primary vt-tabs__request-btn"
          onClick={(e) => { handleOpenRequestModal(); (e.target as HTMLButtonElement).blur(); }}
          disabled={!m365Upn}
          style={{ outline: 'none', boxShadow: 'none', WebkitAppearance: 'none' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M8 3.333v9.334M3.333 8h9.334"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t('requests.newRequest')}
        </button>
      </div>

      {/* Calendar View */}
      {activeTab === 'calendar' && (
        <>
          {/* Header with navigation and view toggle */}
          <CalendarHeader
            view={view}
            dateLabel={viewRange.label}
            anchorDate={anchorDate}
            onViewChange={handleViewChange}
            onToday={goToToday}
            onPrevious={goToPrevious}
            onNext={goToNext}
            onGoToDate={goToDate}
            outlookDeepLink={outlookDeepLink}
          />

          {/* User filter (only show when we have users) */}
          {!isLoading && !error && users.length > 0 && (
            <UserFilter
              users={users}
              selectedUserIds={selectedUserIds}
              onChange={handleUserFilterChange}
              showOnlyMe={!!currentUserId}
              currentUserId={currentUserId}
            />
          )}

          {/* Main content area */}
          <div className="vt-widget__content">
            {isLoading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState message={error} onRetry={refresh} />
            ) : filteredEvents.length === 0 ? (
              <EmptyState />
            ) : (
              <Timeline
                events={filteredEvents}
                users={filteredUsers}
                startDate={viewRange.start}
                endDate={viewRange.end}
                view={view}
              />
            )}
          </div>
        </>
      )}

      {/* My Requests View */}
      {activeTab === 'my-requests' && (
        <div className="vt-widget__content">
          <MyRequests
            requests={myRequests}
            isLoading={myRequestsLoading}
            error={myRequestsError}
            onRefresh={refreshMyRequests}
            onCancel={cancelRequest}
            isCancelling={isCancelling}
          />
        </div>
      )}

      {/* Approvals View */}
      {activeTab === 'approvals' && showApprovalsTab && (
        <div className="vt-widget__content">
          <ApprovalDashboard
            pendingRequests={pendingRequests}
            isLoading={approvalsLoading}
            error={approvalsError}
            onApprove={approveRequest}
            onReject={rejectRequest}
            isActioning={isActioning}
            onRefresh={refreshApprovals}
          />
        </div>
      )}

      {/* Request Modal */}
      <RequestModal
        isOpen={isRequestModalOpen}
        onClose={handleCloseRequestModal}
        onSubmit={handleSubmitRequest}
        userEmail={m365Upn || ''}
        userName={userDisplayName}
        isSubmitting={isRequestSubmitting}
        error={requestError}
      />
    </div>
    </ErrorBoundary>
  );
};
