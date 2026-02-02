/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component that catches JavaScript errors anywhere in the
 * child component tree and displays a fallback UI instead of crashing.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console in development
    console.error('VacationTimeline Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="vt-error-boundary">
          <style>{`
            .vt-error-boundary {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 32px 24px;
              text-align: center;
              background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
              border-radius: 12px;
              border: 1px solid #fecaca;
              min-height: 200px;
            }
            .vt-error-boundary__icon {
              width: 48px;
              height: 48px;
              margin-bottom: 16px;
              color: #dc2626;
            }
            .vt-error-boundary__title {
              font-size: 18px;
              font-weight: 600;
              color: #991b1b;
              margin: 0 0 8px 0;
            }
            .vt-error-boundary__message {
              font-size: 14px;
              color: #b91c1c;
              margin: 0 0 20px 0;
              max-width: 400px;
              line-height: 1.5;
            }
            .vt-error-boundary__retry {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              padding: 10px 20px;
              font-size: 14px;
              font-weight: 500;
              color: white;
              background: #dc2626;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              transition: background-color 0.2s;
            }
            .vt-error-boundary__retry:hover {
              background: #b91c1c;
            }
            .vt-error-boundary__retry:focus {
              outline: 2px solid #dc2626;
              outline-offset: 2px;
            }
          `}</style>
          <svg
            className="vt-error-boundary__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2 className="vt-error-boundary__title">Something went wrong</h2>
          <p className="vt-error-boundary__message">
            The Vacation Timeline widget encountered an unexpected error.
            Please try refreshing or contact support if the problem persists.
          </p>
          <button
            type="button"
            className="vt-error-boundary__retry"
            onClick={this.handleRetry}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
