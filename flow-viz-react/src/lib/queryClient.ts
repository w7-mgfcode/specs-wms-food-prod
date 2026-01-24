import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from './api/client';
import { useToastStore } from '../stores/useToastStore';

/**
 * Global error handler for mutations
 * Handles different error types appropriately
 */
function handleMutationError(error: Error): void {
  // Log all errors
  console.error('Mutation error:', error);

  if (error instanceof ApiClientError) {
    // 401 is handled globally in client.ts (redirect)
    if (error.isAuthError()) {
      return; // Already redirected
    }

    // 403: Show toast, don't disrupt view
    if (error.isPermissionError()) {
      useToastStore.getState().addToast(
        'You do not have permission to perform this action',
        'error',
        5000
      );
      return;
    }

    // 5xx: Let error boundary handle it (if throwOnError is set)
    // Otherwise show toast
    if (error.isServerError()) {
      useToastStore.getState().addToast(
        'Server error. Please try again later.',
        'error',
        5000
      );
      return;
    }

    // 4xx (other): Show specific error message
    useToastStore.getState().addToast(error.detail, 'error', 5000);
  } else {
    // Unknown error
    useToastStore.getState().addToast(
      'An unexpected error occurred',
      'error',
      5000
    );
  }
}

/**
 * Query client with sensible defaults and smart error handling
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on window focus in dev
      refetchOnWindowFocus: import.meta.env.PROD,
      // Smart retry logic
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof ApiClientError && error.status < 500) {
          return false;
        }
        // Retry up to 2 times on 5xx
        return failureCount < 2;
      },
      // Consider data stale after 30 seconds
      staleTime: 30 * 1000,
      // Keep unused data for 5 minutes
      gcTime: 5 * 60 * 1000,
    },
    mutations: {
      // Don't retry mutations
      retry: false,
      // Handle errors globally
      onError: handleMutationError,
    },
  },
});

// Query key factories
export const queryKeys = {
  lots: {
    all: ['lots'] as const,
    lists: () => [...queryKeys.lots.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.lots.all, 'detail', id] as const,
  },
  qc: {
    all: ['qc-decisions'] as const,
    byLot: (lotId: string) => [...queryKeys.qc.all, 'lot', lotId] as const,
  },
  traceability: {
    all: ['traceability'] as const,
    lot: (lotCode: string) => [...queryKeys.traceability.all, lotCode] as const,
  },
  flows: {
    all: ['flows'] as const,
    lists: () => [...queryKeys.flows.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.flows.all, 'detail', id] as const,
    version: (flowId: string, versionNum: number) =>
      [...queryKeys.flows.all, 'version', flowId, versionNum] as const,
  },
} as const;
