import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="h-full flex items-center justify-center bg-pastel-bg-primary p-8">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-pastel-status-error flex items-center justify-center">
              <svg
                className="w-8 h-8 text-pastel-status-error-text"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-pastel-text-primary mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-pastel-text-secondary mb-4">
              An unexpected error occurred. Please try reloading the application.
            </p>
            {this.state.error && (
              <details className="mb-4 text-left">
                <summary className="text-sm text-pastel-text-muted cursor-pointer hover:text-pastel-text-primary">
                  Error details
                </summary>
                <pre className="mt-2 p-3 bg-pastel-bg-tertiary rounded-lg text-xs text-pastel-status-error-text overflow-auto max-h-32">
                  {this.state.error.message}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReload}
              className="px-4 py-2 bg-pastel-accent-blue hover:bg-pastel-accent-blue-hover text-pastel-accent-blue-text rounded-lg font-medium transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
