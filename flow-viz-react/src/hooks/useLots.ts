import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createLot } from '../lib/api/lots';
import { queryKeys } from '../lib/queryClient';
import type { LotCreate, Lot } from '../lib/api/types';

/**
 * Mutation hook for creating lots
 * Automatically invalidates lot lists on success
 */
export function useCreateLot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LotCreate) => createLot(data),
    onSuccess: () => {
      // Invalidate all lot queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all });
    },
  });
}

// Type export for consumers
export type { LotCreate, Lot };
