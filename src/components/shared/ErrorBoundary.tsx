// =============================================================================
// ErrorBoundary — catches render-time exceptions anywhere in the tree so a
// single thrown error shows a recoverable fallback instead of a white screen.
// =============================================================================

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Hook for an error-reporting service (Sentry, etc.) later.
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-600" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-slate-500 mb-6">
            An unexpected error occurred while rendering this page. You can try
            again, or reload the app if the problem persists.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={this.reset}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.assign('/')}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
            >
              Reload app
            </button>
          </div>
          {import.meta.env.DEV && (
            <pre className="mt-6 text-left text-xs text-red-500 bg-red-50 rounded-lg p-3 overflow-auto max-h-40">
              {error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
