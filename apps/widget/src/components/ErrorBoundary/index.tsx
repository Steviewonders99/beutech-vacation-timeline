import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component that catches JavaScript errors in child components.
 * Displays a user-friendly error message instead of crashing the widget.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error for debugging
    console.error('Leave Request Timeline Widget Error:', error);
    console.error('Component stack:', errorInfo.componentStack);

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="vt-error-boundary">
          <div className="vt-error-boundary__content">
            <svg
              className="vt-error-boundary__icon"
              width="48"
              height="48"
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

            <h3 className="vt-error-boundary__title">
              Something went wrong
            </h3>

            <p className="vt-error-boundary__message">
              The leave timeline couldn&apos;t load properly.
              Please try refreshing the page.
            </p>

            <button
              type="button"
              className="vt-error-boundary__button"
              onClick={this.handleRetry}
            >
              Try Again
            </button>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="vt-error-boundary__details">
                <summary>Error Details</summary>
                <pre>{this.state.error.message}</pre>
                <pre>{this.state.error.stack}</pre>
              </details>
            )}
          </div>

          <style>{`
            .vt-error-boundary {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 200px;
              padding: 24px;
              background: #fafafa;
              border-radius: 8px;
              text-align: center;
            }

            .vt-error-boundary__content {
              max-width: 400px;
            }

            .vt-error-boundary__icon {
              color: #e53935;
              margin-bottom: 16px;
            }

            .vt-error-boundary__title {
              margin: 0 0 8px 0;
              font-size: 18px;
              font-weight: 600;
              color: #333;
            }

            .vt-error-boundary__message {
              margin: 0 0 16px 0;
              font-size: 14px;
              color: #666;
              line-height: 1.5;
            }

            .vt-error-boundary__button {
              padding: 8px 16px;
              font-size: 14px;
              font-weight: 500;
              color: #fff;
              background: #1976d2;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              transition: background 0.2s;
            }

            .vt-error-boundary__button:hover {
              background: #1565c0;
            }

            .vt-error-boundary__button:focus {
              outline: 2px solid #1976d2;
              outline-offset: 2px;
            }

            .vt-error-boundary__details {
              margin-top: 16px;
              text-align: left;
              font-size: 12px;
              color: #666;
            }

            .vt-error-boundary__details summary {
              cursor: pointer;
              margin-bottom: 8px;
            }

            .vt-error-boundary__details pre {
              background: #f5f5f5;
              padding: 8px;
              border-radius: 4px;
              overflow-x: auto;
              font-size: 11px;
              margin: 4px 0;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
