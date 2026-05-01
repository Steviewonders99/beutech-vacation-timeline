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

import React from "react";
import ReactDOM from "react-dom/client";

import { BlockFactory, BlockDefinition, ExternalBlockDefinition, BaseBlock, WidgetApi } from "widget-sdk";
import { VacationTimelineProps, VacationTimeline } from "./vacation-timeline";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { configurationSchema, uiSchema } from "./configuration-schema";
import icon from "../resources/vacation-timeline.svg";
import pkg from '../package.json'

/**
 * Define which attributes are handled by the widget.
 * These must match the properties in configuration-schema.ts
 */
const widgetAttributes: string[] = [
  'apiBaseUrl',
  'apiKey',
  'calendarMode',
  'sharedCalendarMailbox',
  'defaultView',
  'darkMode',
  'vacationCategory',
  'maxUsers',
  'm365FallbackDomain',
  // SAML deep link settings
  'enableOutlookDeepLink',
  'staffbaseHost',
  'samlPluginId',
  'samlPluginInstanceId',
  'outlookCalendarUrl',
];

/**
 * This factory creates the class which is registered with the tagname in the `custom element registry`
 * Gets the parental class and a set of helper utilities provided by the hosting application.
 */
const factory: BlockFactory = (BaseBlockClass, widgetApi: WidgetApi) => {
  /**
   *  <vacation-timeline api-base-url="..." api-key="..."></vacation-timeline>
   */
  return class VacationTimelineBlock extends BaseBlockClass implements BaseBlock {
    private _root: ReactDOM.Root | null = null;

    public constructor() {
      super();
    }

    private get props(): VacationTimelineProps {
      const attrs = this.parseAttributes<VacationTimelineProps>();
      // DEBUG: Log raw attributes and parsed values
      console.log('[Widget] Raw HTML attributes:', Array.from(this.attributes).map(a => `${a.name}="${a.value}"`));
      console.log('[Widget] Parsed attributes:', attrs);
      return {
        ...attrs,
        contentLanguage: this.contentLanguage,
        widgetApi: widgetApi,
      };
    }

    public renderBlock(container: HTMLElement): void {
      this._root ??= ReactDOM.createRoot(container);
      this._root.render(
        <ErrorBoundary
          onError={(error, errorInfo) => {
            // Log to console for debugging
            console.error('Leave Request Timeline Error:', error.message);
            console.error('Stack:', errorInfo.componentStack);
          }}
        >
          <VacationTimeline {...this.props} />
        </ErrorBoundary>
      );
    }

    /**
     * The observed attributes, where the widgets reacts on changes.
     */
    public static get observedAttributes(): string[] {
      return widgetAttributes;
    }

    /**
     * Callback invoked on every change of an observed attribute.
     * Call the parental method before applying own logic, then re-render.
     */
    public attributeChangedCallback(...args: [string, string | undefined, string | undefined]): void {
      super.attributeChangedCallback.apply(this, args);
      // Re-render immediately when any observed attribute changes
      if (this._root) {
        this._root.render(
          <ErrorBoundary
            onError={(error, errorInfo) => {
              console.error('Leave Request Timeline Error:', error.message);
              console.error('Stack:', errorInfo.componentStack);
            }}
          >
            <VacationTimeline {...this.props} />
          </ErrorBoundary>
        );
      }
    }
  };
};

/**
 * The definition of the block, to let it successfully register to the hosting application.
 */
const blockDefinition: BlockDefinition = {
  name: "vacation-timeline",
  factory: factory,
  attributes: widgetAttributes,
  blockLevel: 'block',
  configurationSchema: configurationSchema,
  uiSchema: uiSchema,
  label: 'Leave Request Timeline',
  iconUrl: icon
};

/**
 * Wrapping definition, which defines meta information about the block.
 */
const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: pkg.author,
  version: pkg.version
};

/**
 * This call is mandatory to register the block in the hosting application.
 */
window.defineBlock(externalBlockDefinition);
