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
import { useTranslation } from 'react-i18next';
import './LoadingError.css';

export interface EmptyStateProps {
  /** Custom title */
  title?: string;
  /** Custom message */
  message?: string;
}

/**
 * Empty state component shown when no vacations are found.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ title, message }) => {
  const { t } = useTranslation();
  const displayTitle = title ?? t('empty.title');
  const displayMessage = message ?? t('empty.description');

  return (
    <div className="vt-empty" role="status">
      <div className="vt-empty__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
          <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
        </svg>
      </div>
      <h3 className="vt-empty__title">{displayTitle}</h3>
      <p className="vt-empty__message">{displayMessage}</p>
    </div>
  );
};
