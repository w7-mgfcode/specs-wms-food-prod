/**
 * QC, Genealogy, and Audit API client functions.
 *
 * Phase 8.5: Extended with genealogy and audit endpoints.
 */

import { apiFetch } from './client';
import type { QCDecisionCreate, QCDecisionResponse } from './types';

// --- Types ---

export type InspectionDecision = 'PASS' | 'HOLD' | 'FAIL';

export interface QCInspection {
    id: string;
    lot_id: string;
    run_id: string;
    step_index: number;
    inspection_type: string;
    is_ccp: boolean;
    decision: InspectionDecision;
    notes: string | null;
    inspector_id: string;
    inspected_at: string;
}

export interface LotSummary {
    id: string;
    lot_code: string;
    lot_type: string | null;
    weight_kg: number | null;
    status: string;
}

export interface GenealogyLink {
    parent_lot_id: string | null;
    child_lot_id: string | null;
    quantity_used_kg: number | null;
}

export interface GenealogyTree {
    lot: LotSummary;
    direction: 'backward' | 'forward' | 'both';
    depth: number;
    nodes: LotSummary[];
    links: GenealogyLink[];
}

export interface AuditEvent {
    id: number;
    event_type: string;
    entity_type: string;
    entity_id: string;
    user_id: string;
    old_state: Record<string, unknown> | null;
    new_state: Record<string, unknown> | null;
    metadata: Record<string, unknown>;
    ip_address: string | null;
    created_at: string;
}

export interface InspectionFilters {
    lot_id?: string;
    run_id?: string;
    step_index?: number;
    decision?: string;
}

export interface AuditFilters {
    entity_type?: string;
    entity_id?: string;
    event_type?: string;
    limit?: number;
    offset?: number;
}

// --- QC Decision (existing) ---

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

// --- QC Inspections ---

/**
 * List QC inspections with optional filters
 */
export async function listInspections(filters?: InspectionFilters): Promise<QCInspection[]> {
    const params = new URLSearchParams();
    if (filters?.lot_id) params.set('lot_id', filters.lot_id);
    if (filters?.run_id) params.set('run_id', filters.run_id);
    if (filters?.step_index !== undefined) params.set('step_index', String(filters.step_index));
    if (filters?.decision) params.set('decision', filters.decision);

    const query = params.toString() ? `?${params}` : '';
    return apiFetch<QCInspection[]>(`/api/qc-inspections${query}`);
}

/**
 * Get a specific QC inspection by ID
 */
export async function getInspection(inspectionId: string): Promise<QCInspection> {
    return apiFetch<QCInspection>(`/api/qc-inspections/${inspectionId}`);
}

// --- Genealogy ---

/**
 * Get parent lots (1-back or more)
 */
export async function getParentLots(lotId: string, depth = 1): Promise<GenealogyTree> {
    return apiFetch<GenealogyTree>(`/api/genealogy/${lotId}/parents?depth=${depth}`);
}

/**
 * Get child lots (1-forward or more)
 */
export async function getChildLots(lotId: string, depth = 1): Promise<GenealogyTree> {
    return apiFetch<GenealogyTree>(`/api/genealogy/${lotId}/children?depth=${depth}`);
}

/**
 * Get full genealogy tree (both directions)
 */
export async function getGenealogyTree(lotId: string, depth = 3): Promise<GenealogyTree> {
    return apiFetch<GenealogyTree>(`/api/genealogy/${lotId}/tree?depth=${depth}`);
}

// --- Audit ---

/**
 * List audit events with optional filters
 */
export async function listAuditEvents(filters?: AuditFilters): Promise<AuditEvent[]> {
    const params = new URLSearchParams();
    if (filters?.entity_type) params.set('entity_type', filters.entity_type);
    if (filters?.entity_id) params.set('entity_id', filters.entity_id);
    if (filters?.event_type) params.set('event_type', filters.event_type);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));

    const query = params.toString() ? `?${params}` : '';
    return apiFetch<AuditEvent[]>(`/api/audit/events${query}`);
}

/**
 * Get audit trail for a specific entity
 */
export async function getEntityAuditTrail(entityType: string, entityId: string): Promise<AuditEvent[]> {
    return apiFetch<AuditEvent[]>(`/api/audit/entity/${entityType}/${entityId}`);
}

/**
 * Get a specific audit event by ID
 */
export async function getAuditEvent(eventId: number): Promise<AuditEvent> {
    return apiFetch<AuditEvent>(`/api/audit/events/${eventId}`);
}
