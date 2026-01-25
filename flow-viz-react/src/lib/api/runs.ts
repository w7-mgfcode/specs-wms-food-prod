/**
 * Production Run API client functions.
 *
 * Phase 8.5: Route Consolidation & UI Migration
 */

import { apiFetch } from './client';
import { generateUUID } from '../uuid';

// --- Types ---

export type RunStatus = 'IDLE' | 'RUNNING' | 'HOLD' | 'COMPLETED' | 'ABORTED' | 'ARCHIVED';
export type StepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export interface ProductionRun {
    id: string;
    run_code: string;
    flow_version_id: string | null;
    status: RunStatus;
    current_step_index: number;
    started_by: string | null;
    started_at: string | null;
    completed_at: string | null;
}

export interface RunStepExecution {
    id: string;
    run_id: string;
    step_index: number;
    node_id: string;
    status: StepStatus;
    started_at: string | null;
    completed_at: string | null;
    operator_id: string | null;
}

export interface RunBufferItem {
    id: string;
    lot_id: string;
    lot_code: string;
    lot_type: string | null;
    quantity_kg: number;
    temperature_c: number | null;
    entered_at: string;
}

export interface RunBufferInventory {
    buffer: {
        id: string;
        buffer_code: string;
        buffer_type: string;
        allowed_lot_types: string[];
        capacity_kg: number;
        temp_min_c: number;
        temp_max_c: number;
    };
    items: RunBufferItem[];
    total_quantity_kg: number;
}

export interface CreateRunRequest {
    flow_version_id: string;
}

export interface HoldRunRequest {
    reason: string;
}

export interface ResumeRunRequest {
    resolution: string;
}

export interface AdvanceStepRequest {
    notes?: string;
}

export interface AbortRunRequest {
    reason: string;
}

// --- API Functions ---

/**
 * List all production runs with optional status filter
 */
export async function listRuns(statusFilter?: string): Promise<ProductionRun[]> {
    const params = statusFilter ? `?status_filter=${statusFilter}` : '';
    return apiFetch<ProductionRun[]>(`/api/runs${params}`);
}

/**
 * Get a specific production run by ID
 */
export async function getRun(runId: string): Promise<ProductionRun> {
    return apiFetch<ProductionRun>(`/api/runs/${runId}`);
}

/**
 * Get step executions for a production run
 */
export async function getRunSteps(runId: string): Promise<RunStepExecution[]> {
    return apiFetch<RunStepExecution[]>(`/api/runs/${runId}/steps`);
}

/**
 * Get buffer inventory for a production run
 */
export async function getRunBuffers(runId: string): Promise<RunBufferInventory[]> {
    return apiFetch<RunBufferInventory[]>(`/api/runs/${runId}/buffers`);
}

/**
 * Create a new production run
 */
export async function createRun(data: CreateRunRequest): Promise<ProductionRun> {
    const idempotencyKey = generateUUID();
    return apiFetch<ProductionRun>('/api/runs', {
        method: 'POST',
        headers: {
            'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(data),
    });
}

/**
 * Start an IDLE production run
 */
export async function startRun(runId: string): Promise<ProductionRun> {
    return apiFetch<ProductionRun>(`/api/runs/${runId}/start`, {
        method: 'POST',
    });
}

/**
 * Advance to the next step in a RUNNING production run
 */
export async function advanceStep(runId: string, notes?: string): Promise<ProductionRun> {
    return apiFetch<ProductionRun>(`/api/runs/${runId}/advance`, {
        method: 'POST',
        body: notes ? JSON.stringify({ notes }) : undefined,
    });
}

/**
 * Put a RUNNING production run on HOLD
 */
export async function holdRun(runId: string, data: HoldRunRequest): Promise<ProductionRun> {
    return apiFetch<ProductionRun>(`/api/runs/${runId}/hold`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * Resume a HOLD production run
 */
export async function resumeRun(runId: string, data: ResumeRunRequest): Promise<ProductionRun> {
    return apiFetch<ProductionRun>(`/api/runs/${runId}/resume`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * Complete a production run (requires step 10)
 */
export async function completeRun(runId: string): Promise<ProductionRun> {
    return apiFetch<ProductionRun>(`/api/runs/${runId}/complete`, {
        method: 'POST',
    });
}

/**
 * Abort a production run
 */
export async function abortRun(runId: string, reason: string): Promise<ProductionRun> {
    return apiFetch<ProductionRun>(`/api/runs/${runId}/abort`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
    });
}
