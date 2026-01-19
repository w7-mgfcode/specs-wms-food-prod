import { apiFetch } from './client';
import type { Lot, LotCreate } from './types';

/**
 * Create a new lot
 */
export async function createLot(data: LotCreate): Promise<Lot> {
  return apiFetch<Lot>('/api/lots', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get all lots (future endpoint - placeholder)
 * Note: Backend doesn't have GET /api/lots yet
 */
export async function getLots(): Promise<Lot[]> {
  // TODO: Implement when backend adds GET /api/lots
  console.warn('getLots() not yet implemented - backend needs GET /api/lots');
  return [];
}
