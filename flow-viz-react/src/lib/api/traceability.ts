import { apiFetch } from './client';
import type { TraceabilityResponse } from './types';

/**
 * Get traceability graph for a lot
 * Returns central lot with parents and children
 */
export async function getTraceability(lotCode: string): Promise<TraceabilityResponse> {
  return apiFetch<TraceabilityResponse>(`/api/traceability/${encodeURIComponent(lotCode)}`);
}
