import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createQCDecision } from '../lib/api/qc';
import { queryKeys } from '../lib/queryClient';
import type { QCDecisionCreate, QCDecisionResponse } from '../lib/api/types';

/**
 * Mutation hook for creating QC decisions
 * Invalidates QC queries and related lot queries on success
 */
export function useCreateQCDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: QCDecisionCreate) => createQCDecision(data),
    onSuccess: (_result, variables) => {
      // Invalidate QC queries
      queryClient.invalidateQueries({ queryKey: queryKeys.qc.all });

      // Invalidate traceability for the related lot
      if (variables.lot_id) {
        // Would need lot_code here - might need to refetch
        queryClient.invalidateQueries({ queryKey: queryKeys.traceability.all });
      }
    },
  });
}

// Type export for consumers
export type { QCDecisionCreate, QCDecisionResponse };
