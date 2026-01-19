/**
 * TypeScript interfaces matching FastAPI Pydantic schemas
 *
 * Reference: backend/app/schemas/
 */

// ============ Enums ============

export type UserRole = 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'OPERATOR' | 'VIEWER';
export type LotType = 'RAW' | 'DEB' | 'BULK' | 'MIX' | 'SKW' | 'FRZ' | 'FG';
export type QCDecision = 'PASS' | 'HOLD' | 'FAIL';

// ============ User/Auth ============

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  last_login: string | null;
}

export interface LoginRequest {
  email: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

// ============ Lots ============

export interface LotCreate {
  lot_code: string;
  lot_type?: LotType | null;
  production_run_id?: string | null;
  phase_id?: string | null;
  operator_id?: string | null;
  weight_kg?: number | null;
  temperature_c?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface Lot {
  id: string;
  lot_code: string;
  lot_type: LotType | null;
  production_run_id: string | null;
  phase_id: string | null;
  operator_id: string | null;
  weight_kg: number | null;
  temperature_c: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============ QC Decisions ============

export interface QCDecisionCreate {
  lot_id?: string | null;
  qc_gate_id?: string | null;
  operator_id?: string | null;
  decision?: QCDecision | null;
  notes?: string | null;
  temperature_c?: number | null;
  digital_signature?: string | null;
}

export interface QCDecisionResponse {
  id: string;
  lot_id: string | null;
  qc_gate_id: string | null;
  operator_id: string | null;
  decision: QCDecision | null;
  notes: string | null;
  temperature_c: number | null;
  digital_signature: string | null;
  decided_at: string;
}

// ============ Traceability ============

export interface TraceabilityResponse {
  central: Lot;
  parents: Lot[];
  children: Lot[];
}

// ============ Health ============

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
}
