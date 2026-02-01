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

export interface LoadingStateProps {
  /** Custom loading message */
  message?: string;
}

/**
 * Loading spinner component displayed while fetching data.
 */
export const LoadingState: React.FC<LoadingStateProps> = ({ message }) => {
  const { t } = useTranslation();
  const displayMessage = message ?? t('loading.calendar');

  return (
    <div className="vt-loading" role="status" aria-live="polite">
      <div className="vt-loading__spinner" aria-hidden="true">
        <div className="vt-loading__spinner-circle"></div>
      </div>
      <p className="vt-loading__message">{displayMessage}</p>
    </div>
  );
};
