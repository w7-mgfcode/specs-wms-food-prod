import { ReactNode } from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary';
import { ApiClientError } from '../lib/api/client';

/**
 * Error fallback UI shown when an error boundary catches an error
 */
function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const isServerError = error instanceof ApiClientError && error.isServerError();
  const errorMessage = error instanceof ApiClientError
    ? error.detail
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred';

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8 bg-slate-900">
      <div className="max-w-md text-center">
        <div className="mb-4 text-6xl">
          {isServerError ? '🔧' : '⚠️'}
        </div>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {isServerError ? 'Server Error' : 'Something went wrong'}
        </h2>
        <p className="mb-6 text-slate-400">
          {errorMessage}
        </p>
        <button
          onClick={resetErrorBoundary}
          className="rounded-lg bg-cyan-600 px-6 py-2 text-white transition-colors hover:bg-cyan-500"
        >
          Try Again
        </button>
        {isServerError && (
          <p className="mt-4 text-sm text-slate-500">
            If the problem persists, please contact support.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Log error before displaying fallback UI
 */
function logError(error: unknown, info: { componentStack?: string | null }) {
  // Log to console in development
  console.error('Error caught by boundary:', error);
  if (info.componentStack) {
    console.error('Component stack:', info.componentStack);
  }
  // TODO: Send to error tracking service in production
}

interface QueryErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Error boundary wrapper that integrates with TanStack Query
 * Resets query errors when user clicks "Try Again"
 */
export function QueryErrorBoundary({ children }: QueryErrorBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ReactErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={reset}
          onError={logError}
        >
          {children}
        </ReactErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
