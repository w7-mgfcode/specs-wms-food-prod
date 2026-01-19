import { useQuery } from '@tanstack/react-query';
import { getTraceability } from '../lib/api/traceability';
import { queryKeys } from '../lib/queryClient';
import type { TraceabilityResponse } from '../lib/api/types';

/**
 * Query hook for lot traceability
 * @param lotCode - The lot code to fetch traceability for
 * @param enabled - Whether to enable the query (default: true when lotCode provided)
 */
export function useTraceability(lotCode: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.traceability.lot(lotCode || ''),
    queryFn: () => getTraceability(lotCode!),
    enabled: enabled && !!lotCode,
  });
}

// Type export for consumers
export type { TraceabilityResponse };
