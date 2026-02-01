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

export interface ErrorStateProps {
  /** Error message to display */
  message: string;
  /** Callback to retry the failed action */
  onRetry?: () => void;
}

/**
 * Error display component shown when data fetching fails.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  const { t } = useTranslation();

  return (
    <div className="vt-error" role="alert">
      <div className="vt-error__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      </div>
      <h3 className="vt-error__title">{t('errors.loadingFailed')}</h3>
      <p className="vt-error__message">{message}</p>
      {onRetry && (
        <button className="vt-error__retry-btn" onClick={onRetry} type="button">
          {t('common.retry')}
        </button>
      )}
    </div>
  );
};
