import { apiFetch } from './client';
import type { QCDecisionCreate, QCDecisionResponse } from './types';

/**
 * Create a QC decision
 * Note: HOLD/FAIL decisions require notes (min 10 chars)
 */
export async function createQCDecision(data: QCDecisionCreate): Promise<QCDecisionResponse> {
  return apiFetch<QCDecisionResponse>('/api/qc-decisions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
