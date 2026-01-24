# PRP: Phase 8.5 — Route Consolidation & UI Migration

> **Parent PRP**: phase8-unified-production-suite.md
> **Phase**: 8.5 - Route Consolidation & UI Migration
> **Date**: 2026-01-24
> **Status**: READY FOR IMPLEMENTATION
> **Confidence Score**: 7/10

---

## Purpose

Complete the frontend migration per INITIAL-11 Information Architecture:
1. Route consolidation (legacy → new canonical routes)
2. "First Flow" → "Run Buffers" tab within active run
3. Quality Validator consolidation (genealogy + inspections + audit)
4. Command Center enhancements with run management
5. Terminology cleanup across all UI components

---

## Prerequisites

- **Phase 8.1-8.4 Complete**: All backend APIs available
- API endpoints working:
  - `/api/runs/*`
  - `/api/buffers/*`
  - `/api/qc/inspections/*`
  - `/api/genealogy/*`
  - `/api/audit/*`

---

## Reference Files

```yaml
Existing Components:
  - flow-viz-react/src/router.tsx
  - flow-viz-react/src/components/shell/AppShell.tsx
  - flow-viz-react/src/components/flow/FirstFlowPage.tsx
  - flow-viz-react/src/pages/FlowVizV2.tsx (Command Center)
  - flow-viz-react/src/pages/FlowVizV3.tsx (Validator)

API Clients:
  - flow-viz-react/src/lib/api/client.ts
  - flow-viz-react/src/lib/api/flows.ts

Stores:
  - flow-viz-react/src/stores/useProductionStore.ts
```

---

## Route Structure (from INITIAL-11)

```
/                           → Redirect to /dashboard
/login                      → Authentication
/dashboard                  → Live Dashboard (V1)

/command                    → Command Center (V2)
/command/run/:runId         → Active Run Controls
/command/run/:runId/buffers → Run Buffers (formerly "First Flow")

/validator                  → Quality Validator (V3)
/validator/genealogy        → Genealogy Query
/validator/inspections      → Compliance Inspection Log
/validator/audit            → Audit Event Stream

/flow-editor                → Flow Catalog
/flow-editor/:flowId        → Flow Editor
/flow-editor/:flowId/v/:versionNum → Specific Version

/run/:runId                 → Production Run Detail (read-only)
/run/:runId/steps           → Step Execution Timeline
/run/:runId/lots            → Lot Registry for Run
/run/:runId/qc              → QC Decisions for Run

/presentation               → Factory Floor Display
/presentation/:runId        → Single Run Presentation
```

---

## Task List

### Task 5.1: Create API Client Functions for Runs

**File**: `flow-viz-react/src/lib/api/runs.ts` (NEW)

```typescript
/**
 * Production Run API client functions.
 */

import { apiFetch } from './client';

// --- Types ---

export interface ProductionRun {
    id: string;
    run_code: string;
    flow_version_id: string | null;
    status: 'IDLE' | 'RUNNING' | 'HOLD' | 'COMPLETED' | 'ABORTED' | 'ARCHIVED';
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
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
    started_at: string | null;
    completed_at: string | null;
    operator_id: string | null;
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
    items: Array<{
        id: string;
        lot_id: string;
        lot_code: string;
        lot_type: string | null;
        quantity_kg: number;
        temperature_c: number | null;
        entered_at: string;
    }>;
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

// --- API Functions ---

export async function listRuns(statusFilter?: string): Promise<ProductionRun[]> {
    const params = statusFilter ? `?status_filter=${statusFilter}` : '';
    return apiFetch<ProductionRun[]>(`/api/runs${params}`);
}

export async function getRun(runId: string): Promise<ProductionRun> {
    return apiFetch<ProductionRun>(`/api/runs/${runId}`);
}

export async function getRunSteps(runId: string): Promise<RunStepExecution[]> {
    return apiFetch<RunStepExecution[]>(`/api/runs/${runId}/steps`);
}

export async function getRunBuffers(runId: string): Promise<RunBufferInventory[]> {
    return apiFetch<RunBufferInventory[]>(`/api/runs/${runId}/buffers`);
}

export async function createRun(data: CreateRunRequest): Promise<ProductionRun> {
    const idempotencyKey = crypto.randomUUID();
    return apiFetch<ProductionRun>('/api/runs', {
        method: 'POST',
        headers: {
            'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(data),
    });
}

export async function startRun(runId: string): Promise<ProductionRun> {
    return apiFetch<ProductionRun>(`/api/runs/${runId}/start`, {
        method: 'POST',
    });
}

export async function advanceStep(runId: string, notes?: string): Promise<ProductionRun> {
    return apiFetch<ProductionRun>(`/api/runs/${runId}/advance`, {
        method: 'POST',
        body: notes ? JSON.stringify({ notes }) : undefined,
    });
}

export async function holdRun(runId: string, data: HoldRunRequest): Promise<ProductionRun> {
    return apiFetch<ProductionRun>(`/api/runs/${runId}/hold`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function resumeRun(runId: string, data: ResumeRunRequest): Promise<ProductionRun> {
    return apiFetch<ProductionRun>(`/api/runs/${runId}/resume`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function completeRun(runId: string): Promise<ProductionRun> {
    return apiFetch<ProductionRun>(`/api/runs/${runId}/complete`, {
        method: 'POST',
    });
}

export async function abortRun(runId: string, reason: string): Promise<ProductionRun> {
    return apiFetch<ProductionRun>(`/api/runs/${runId}/abort`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
    });
}
```

---

### Task 5.2: Create API Client Functions for QC/Genealogy/Audit

**File**: `flow-viz-react/src/lib/api/qc.ts` (UPDATE)

```typescript
// Add to existing qc.ts or create new

export interface QCInspection {
    id: string;
    lot_id: string;
    run_id: string;
    step_index: number;
    inspection_type: string;
    is_ccp: boolean;
    decision: 'PASS' | 'HOLD' | 'FAIL';
    notes: string | null;
    inspector_id: string;
    inspected_at: string;
}

export interface GenealogyNode {
    lot: {
        id: string;
        lot_code: string;
        lot_type: string | null;
        weight_kg: number | null;
        status: string;
    };
    quantity_used_kg: number | null;
    parents?: GenealogyNode[];
    children?: GenealogyNode[];
}

export interface GenealogyTree {
    central: GenealogyNode['lot'];
    parents: GenealogyNode[];
    children: GenealogyNode[];
    depth: number;
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

export interface AuditEventList {
    items: AuditEvent[];
    total: number;
    page: number;
    per_page: number;
}

// QC Inspections
export async function listInspections(filters?: {
    lot_id?: string;
    run_id?: string;
    step_index?: number;
    decision?: string;
}): Promise<QCInspection[]> {
    const params = new URLSearchParams();
    if (filters?.lot_id) params.set('lot_id', filters.lot_id);
    if (filters?.run_id) params.set('run_id', filters.run_id);
    if (filters?.step_index !== undefined) params.set('step_index', String(filters.step_index));
    if (filters?.decision) params.set('decision', filters.decision);

    const query = params.toString() ? `?${params}` : '';
    return apiFetch<QCInspection[]>(`/api/qc/inspections${query}`);
}

// Genealogy
export async function getParentLots(lotCode: string): Promise<unknown[]> {
    return apiFetch(`/api/genealogy/${encodeURIComponent(lotCode)}/parents`);
}

export async function getChildLots(lotCode: string): Promise<unknown[]> {
    return apiFetch(`/api/genealogy/${encodeURIComponent(lotCode)}/children`);
}

export async function getGenealogyTree(lotCode: string, depth = 3): Promise<GenealogyTree> {
    return apiFetch<GenealogyTree>(`/api/genealogy/${encodeURIComponent(lotCode)}/tree?depth=${depth}`);
}

// Audit
export async function listAuditEvents(filters?: {
    entity_type?: string;
    entity_id?: string;
    event_type?: string;
    page?: number;
    per_page?: number;
}): Promise<AuditEventList> {
    const params = new URLSearchParams();
    if (filters?.entity_type) params.set('entity_type', filters.entity_type);
    if (filters?.entity_id) params.set('entity_id', filters.entity_id);
    if (filters?.event_type) params.set('event_type', filters.event_type);
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.per_page) params.set('per_page', String(filters.per_page));

    const query = params.toString() ? `?${params}` : '';
    return apiFetch<AuditEventList>(`/api/audit/events${query}`);
}

export async function getEntityAuditTrail(entityType: string, entityId: string): Promise<AuditEvent[]> {
    return apiFetch<AuditEvent[]>(`/api/audit/events/${entityType}/${entityId}`);
}
```

---

### Task 5.3: Create Production Run Store

**File**: `flow-viz-react/src/stores/useRunStore.ts` (NEW)

```typescript
/**
 * Production Run Store
 *
 * Manages active run state and operations.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
    ProductionRun,
    RunStepExecution,
    RunBufferInventory,
    getRun,
    getRunSteps,
    getRunBuffers,
    startRun,
    advanceStep,
    holdRun,
    resumeRun,
} from '../lib/api/runs';

interface RunState {
    // Current run
    currentRun: ProductionRun | null;
    steps: RunStepExecution[];
    buffers: RunBufferInventory[];

    // Loading states
    isLoading: boolean;
    isAdvancing: boolean;
    error: string | null;

    // Actions
    loadRun: (runId: string) => Promise<void>;
    loadSteps: (runId: string) => Promise<void>;
    loadBuffers: (runId: string) => Promise<void>;
    doStartRun: (runId: string) => Promise<void>;
    doAdvanceStep: (runId: string, notes?: string) => Promise<void>;
    doHoldRun: (runId: string, reason: string) => Promise<void>;
    doResumeRun: (runId: string, resolution: string) => Promise<void>;
    reset: () => void;
}

export const useRunStore = create<RunState>()(
    devtools(
        (set, get) => ({
            currentRun: null,
            steps: [],
            buffers: [],
            isLoading: false,
            isAdvancing: false,
            error: null,

            loadRun: async (runId: string) => {
                set({ isLoading: true, error: null });
                try {
                    const run = await getRun(runId);
                    set({ currentRun: run, isLoading: false });
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to load run',
                        isLoading: false,
                    });
                }
            },

            loadSteps: async (runId: string) => {
                try {
                    const steps = await getRunSteps(runId);
                    set({ steps });
                } catch (error) {
                    console.error('Failed to load steps:', error);
                }
            },

            loadBuffers: async (runId: string) => {
                try {
                    const buffers = await getRunBuffers(runId);
                    set({ buffers });
                } catch (error) {
                    console.error('Failed to load buffers:', error);
                }
            },

            doStartRun: async (runId: string) => {
                set({ isAdvancing: true, error: null });
                try {
                    const run = await startRun(runId);
                    set({ currentRun: run, isAdvancing: false });
                    // Reload steps
                    get().loadSteps(runId);
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to start run',
                        isAdvancing: false,
                    });
                }
            },

            doAdvanceStep: async (runId: string, notes?: string) => {
                set({ isAdvancing: true, error: null });
                try {
                    const run = await advanceStep(runId, notes);
                    set({ currentRun: run, isAdvancing: false });
                    // Reload steps
                    get().loadSteps(runId);
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to advance step',
                        isAdvancing: false,
                    });
                }
            },

            doHoldRun: async (runId: string, reason: string) => {
                set({ isAdvancing: true, error: null });
                try {
                    const run = await holdRun(runId, { reason });
                    set({ currentRun: run, isAdvancing: false });
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to hold run',
                        isAdvancing: false,
                    });
                }
            },

            doResumeRun: async (runId: string, resolution: string) => {
                set({ isAdvancing: true, error: null });
                try {
                    const run = await resumeRun(runId, { resolution });
                    set({ currentRun: run, isAdvancing: false });
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to resume run',
                        isAdvancing: false,
                    });
                }
            },

            reset: () => {
                set({
                    currentRun: null,
                    steps: [],
                    buffers: [],
                    isLoading: false,
                    isAdvancing: false,
                    error: null,
                });
            },
        }),
        { name: 'RunStore' }
    )
);
```

---

### Task 5.4: Create Command Center Page

**File**: `flow-viz-react/src/pages/CommandCenterPage.tsx` (NEW)

```typescript
/**
 * Command Center Page
 *
 * Main operator interface for managing production runs.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, CheckCircle, XCircle, Loader2, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { useUIStore } from '../stores/useUIStore';
import { listRuns, ProductionRun } from '../lib/api/runs';
import { listFlowDefinitions } from '../lib/api/flows';

const STATUS_COLORS: Record<string, string> = {
    IDLE: 'bg-gray-500',
    RUNNING: 'bg-green-500',
    HOLD: 'bg-yellow-500',
    COMPLETED: 'bg-blue-500',
    ABORTED: 'bg-red-500',
    ARCHIVED: 'bg-gray-400',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
    IDLE: <Pause className="w-4 h-4" />,
    RUNNING: <Play className="w-4 h-4" />,
    HOLD: <Pause className="w-4 h-4" />,
    COMPLETED: <CheckCircle className="w-4 h-4" />,
    ABORTED: <XCircle className="w-4 h-4" />,
};

export function CommandCenterPage() {
    const navigate = useNavigate();
    const { language } = useUIStore();

    const [runs, setRuns] = useState<ProductionRun[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('');

    useEffect(() => {
        async function loadRuns() {
            try {
                setIsLoading(true);
                const data = await listRuns(statusFilter || undefined);
                setRuns(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load runs');
            } finally {
                setIsLoading(false);
            }
        }
        loadRuns();
    }, [statusFilter]);

    const handleOpenRun = (runId: string) => {
        navigate(`/command/run/${runId}`);
    };

    const handleCreateRun = () => {
        navigate('/command/new');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[rgba(26,31,58,0.95)] border-b border-white/10">
                <div>
                    <h1 className="text-xl font-semibold text-white">
                        {language === 'hu' ? 'Parancsközpont' : 'Command Center'}
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        {language === 'hu'
                            ? 'Gyártási futtatások kezelése'
                            : 'Manage production runs'}
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-white text-sm"
                    >
                        <option value="">{language === 'hu' ? 'Összes' : 'All'}</option>
                        <option value="IDLE">{language === 'hu' ? 'Várakozik' : 'Idle'}</option>
                        <option value="RUNNING">{language === 'hu' ? 'Fut' : 'Running'}</option>
                        <option value="HOLD">{language === 'hu' ? 'Felfüggesztve' : 'On Hold'}</option>
                        <option value="COMPLETED">{language === 'hu' ? 'Befejezve' : 'Completed'}</option>
                    </select>

                    {/* Create Button */}
                    <button
                        onClick={handleCreateRun}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg',
                            'bg-blue-600 hover:bg-blue-700 text-white',
                            'transition-colors'
                        )}
                    >
                        <Plus className="w-4 h-4" />
                        {language === 'hu' ? 'Új futtatás' : 'New Run'}
                    </button>
                </div>
            </div>

            {/* Run List */}
            <div className="flex-1 overflow-auto p-6">
                {error ? (
                    <div className="text-red-400 text-center">{error}</div>
                ) : runs.length === 0 ? (
                    <div className="text-gray-400 text-center">
                        {language === 'hu' ? 'Nincsenek futtatások' : 'No runs found'}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {runs.map((run) => (
                            <div
                                key={run.id}
                                onClick={() => handleOpenRun(run.id)}
                                className={cn(
                                    'p-4 rounded-lg cursor-pointer',
                                    'bg-[rgba(26,31,58,0.95)] border border-white/10',
                                    'hover:border-white/20 transition-all'
                                )}
                            >
                                {/* Run Code */}
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-mono text-white">
                                        {run.run_code}
                                    </h3>
                                    <span
                                        className={cn(
                                            'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-white',
                                            STATUS_COLORS[run.status]
                                        )}
                                    >
                                        {STATUS_ICONS[run.status]}
                                        {run.status}
                                    </span>
                                </div>

                                {/* Step Progress */}
                                <div className="mt-3">
                                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                                        <span>
                                            {language === 'hu' ? 'Lépés' : 'Step'} {run.current_step_index}/10
                                        </span>
                                        <span>{Math.round((run.current_step_index / 10) * 100)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2">
                                        <div
                                            className="bg-blue-500 rounded-full h-2 transition-all"
                                            style={{ width: `${(run.current_step_index / 10) * 100}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Timestamps */}
                                <div className="mt-3 text-[10px] text-gray-500">
                                    {run.started_at && (
                                        <div>
                                            {language === 'hu' ? 'Indítva:' : 'Started:'}{' '}
                                            {new Date(run.started_at).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
```

---

### Task 5.5: Create Active Run Layout with Tabs

**File**: `flow-viz-react/src/components/run/ActiveRunLayout.tsx` (NEW)

```typescript
/**
 * Active Run Layout
 *
 * Container for active run with tab navigation.
 */

import { useEffect } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Play, Pause, FastForward, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/useUIStore';
import { useRunStore } from '../../stores/useRunStore';

const TABS = [
    { path: '', label: { hu: 'Vezérlés', en: 'Controls' } },
    { path: 'buffers', label: { hu: 'Pufferek', en: 'Buffers' } },
    { path: 'lots', label: { hu: 'Lotok', en: 'Lots' } },
    { path: 'qc', label: { hu: 'Minőség', en: 'QC' } },
];

const STEP_NAMES = [
    { hu: 'Kezdés', en: 'Start' },
    { hu: 'Átvétel', en: 'Receipt' },
    { hu: 'Kicsontolás', en: 'Deboning' },
    { hu: 'Bulk Puffer', en: 'Bulk Buffer' },
    { hu: 'Keverés', en: 'Mixing' },
    { hu: 'Nyársalás', en: 'Skewering' },
    { hu: 'SKU Bontás', en: 'SKU Split' },
    { hu: 'Fagyasztás', en: 'Freezing' },
    { hu: 'Csomagolás', en: 'Packaging' },
    { hu: 'Raklapozás', en: 'Palletizing' },
    { hu: 'Szállítás', en: 'Shipment' },
];

export function ActiveRunLayout() {
    const { runId } = useParams<{ runId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { language } = useUIStore();

    const {
        currentRun,
        isLoading,
        isAdvancing,
        error,
        loadRun,
        loadSteps,
        loadBuffers,
        doStartRun,
        doAdvanceStep,
        doHoldRun,
    } = useRunStore();

    useEffect(() => {
        if (runId) {
            loadRun(runId);
            loadSteps(runId);
            loadBuffers(runId);
        }
    }, [runId, loadRun, loadSteps, loadBuffers]);

    const currentTab = location.pathname.split('/').pop() || '';

    const handleTabClick = (path: string) => {
        navigate(`/command/run/${runId}${path ? `/${path}` : ''}`);
    };

    const handleBack = () => {
        navigate('/command');
    };

    const handleStart = () => {
        if (runId) doStartRun(runId);
    };

    const handleAdvance = () => {
        if (runId) doAdvanceStep(runId);
    };

    const handleHold = () => {
        if (runId) {
            const reason = prompt(language === 'hu' ? 'Indoklás (min 10 karakter):' : 'Reason (min 10 chars):');
            if (reason && reason.length >= 10) {
                doHoldRun(runId, reason);
            }
        }
    };

    if (isLoading || !currentRun) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-white">Loading...</div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="bg-[rgba(26,31,58,0.95)] border-b border-white/10">
                <div className="flex items-center justify-between px-6 py-4">
                    {/* Back + Run Info */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleBack}
                            className="p-2 hover:bg-white/10 rounded"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-400" />
                        </button>
                        <div>
                            <h1 className="text-lg font-mono text-white">
                                {currentRun.run_code}
                            </h1>
                            <p className="text-sm text-gray-400">
                                {STEP_NAMES[currentRun.current_step_index]?.[language] || `Step ${currentRun.current_step_index}`}
                            </p>
                        </div>
                    </div>

                    {/* Status + Actions */}
                    <div className="flex items-center gap-4">
                        {/* Status Badge */}
                        <span
                            className={cn(
                                'px-3 py-1 rounded text-sm font-medium',
                                currentRun.status === 'RUNNING' && 'bg-green-500/20 text-green-400',
                                currentRun.status === 'IDLE' && 'bg-gray-500/20 text-gray-400',
                                currentRun.status === 'HOLD' && 'bg-yellow-500/20 text-yellow-400',
                                currentRun.status === 'COMPLETED' && 'bg-blue-500/20 text-blue-400'
                            )}
                        >
                            {currentRun.status}
                        </span>

                        {/* Action Buttons */}
                        {currentRun.status === 'IDLE' && (
                            <button
                                onClick={handleStart}
                                disabled={isAdvancing}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white"
                            >
                                <Play className="w-4 h-4" />
                                {language === 'hu' ? 'Indítás' : 'Start'}
                            </button>
                        )}

                        {currentRun.status === 'RUNNING' && (
                            <>
                                <button
                                    onClick={handleAdvance}
                                    disabled={isAdvancing || currentRun.current_step_index >= 10}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                                >
                                    <FastForward className="w-4 h-4" />
                                    {language === 'hu' ? 'Tovább' : 'Advance'}
                                </button>
                                <button
                                    onClick={handleHold}
                                    disabled={isAdvancing}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white"
                                >
                                    <Pause className="w-4 h-4" />
                                    {language === 'hu' ? 'Felfüggesztés' : 'Hold'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Step Progress Bar */}
                <div className="px-6 pb-4">
                    <div className="flex items-center gap-1">
                        {Array.from({ length: 11 }, (_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    'flex-1 h-2 rounded-full transition-colors',
                                    i < currentRun.current_step_index && 'bg-green-500',
                                    i === currentRun.current_step_index && 'bg-blue-500',
                                    i > currentRun.current_step_index && 'bg-gray-700'
                                )}
                                title={STEP_NAMES[i]?.[language]}
                            />
                        ))}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-6">
                    {TABS.map((tab) => (
                        <button
                            key={tab.path}
                            onClick={() => handleTabClick(tab.path)}
                            className={cn(
                                'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
                                (currentTab === tab.path || (currentTab === runId && tab.path === ''))
                                    ? 'bg-[rgba(255,255,255,0.1)] text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
                            )}
                        >
                            {tab.label[language]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-red-400">{error}</span>
                </div>
            )}

            {/* Tab Content */}
            <div className="flex-1 overflow-auto">
                <Outlet />
            </div>
        </div>
    );
}
```

---

### Task 5.6: Create Run Buffers Tab (Migrated from FirstFlowPage)

**File**: `flow-viz-react/src/components/run/RunBuffersTab.tsx` (NEW)

```typescript
/**
 * Run Buffers Tab
 *
 * Buffer inventory board for active run (formerly "First Flow").
 */

import { Package, Thermometer } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/useUIStore';
import { useRunStore } from '../../stores/useRunStore';

const BUFFER_COLORS: Record<string, string> = {
    LK: '#3b82f6',     // blue
    MIX: '#8b5cf6',    // violet
    SKW15: '#22c55e',  // green
    SKW30: '#10b981',  // emerald
    FRZ: '#06b6d4',    // cyan
    PAL: '#f59e0b',    // amber
};

export function RunBuffersTab() {
    const { language } = useUIStore();
    const { buffers } = useRunStore();

    return (
        <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {buffers.map((bufferData) => {
                    const { buffer, items, total_quantity_kg } = bufferData;
                    const color = BUFFER_COLORS[buffer.buffer_type] || '#6b7280';
                    const capacityPercent = (Number(total_quantity_kg) / Number(buffer.capacity_kg)) * 100;

                    return (
                        <div
                            key={buffer.id}
                            className={cn(
                                'rounded-xl overflow-hidden',
                                'bg-[rgba(26,31,58,0.95)] border border-white/10'
                            )}
                        >
                            {/* Header */}
                            <div
                                className="px-4 py-3 flex items-center justify-between"
                                style={{ backgroundColor: `${color}20` }}
                            >
                                <div className="flex items-center gap-2">
                                    <Package className="w-5 h-5" style={{ color }} />
                                    <span className="font-semibold text-white">
                                        {buffer.buffer_code}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-400">
                                    {buffer.buffer_type}
                                </span>
                            </div>

                            {/* Capacity Bar */}
                            <div className="px-4 py-2 border-b border-white/5">
                                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                                    <span>
                                        {Number(total_quantity_kg).toFixed(1)} / {Number(buffer.capacity_kg).toFixed(0)} kg
                                    </span>
                                    <span>{capacityPercent.toFixed(0)}%</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div
                                        className={cn(
                                            'rounded-full h-2 transition-all',
                                            capacityPercent > 90 ? 'bg-red-500' :
                                            capacityPercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                                        )}
                                        style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* Temperature Range */}
                            <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2 text-xs text-gray-400">
                                <Thermometer className="w-3 h-3" />
                                <span>
                                    {Number(buffer.temp_min_c).toFixed(0)}°C - {Number(buffer.temp_max_c).toFixed(0)}°C
                                </span>
                            </div>

                            {/* Lot Cards */}
                            <div className="p-3 space-y-2 max-h-60 overflow-auto">
                                {items.length === 0 ? (
                                    <div className="text-center text-gray-500 text-sm py-4">
                                        {language === 'hu' ? 'Üres' : 'Empty'}
                                    </div>
                                ) : (
                                    items.map((item) => (
                                        <div
                                            key={item.id}
                                            className={cn(
                                                'p-2 rounded-lg',
                                                'bg-[rgba(255,255,255,0.05)] border border-white/5'
                                            )}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-mono text-white">
                                                    {item.lot_code}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {Number(item.quantity_kg).toFixed(1)} kg
                                                </span>
                                            </div>
                                            {item.temperature_c !== null && (
                                                <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
                                                    <Thermometer className="w-3 h-3" />
                                                    {Number(item.temperature_c).toFixed(1)}°C
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
```

---

### Task 5.7: Create Quality Validator Pages

**File**: `flow-viz-react/src/pages/ValidatorDashboard.tsx` (NEW)

```typescript
/**
 * Validator Dashboard
 *
 * Landing page for Quality Validator with navigation to sub-sections.
 */

import { useNavigate } from 'react-router-dom';
import { GitBranch, ClipboardCheck, ScrollText, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useUIStore } from '../stores/useUIStore';

const SECTIONS = [
    {
        path: 'genealogy',
        icon: GitBranch,
        label: { hu: 'Nyomkövetés', en: 'Genealogy' },
        description: { hu: '1-vissza / 1-előre lekérdezés', en: '1-back / 1-forward trace' },
        color: '#3b82f6',
    },
    {
        path: 'inspections',
        icon: ClipboardCheck,
        label: { hu: 'Ellenőrzések', en: 'Inspections' },
        description: { hu: 'QC döntések listája', en: 'QC decision log' },
        color: '#22c55e',
    },
    {
        path: 'audit',
        icon: ScrollText,
        label: { hu: 'Audit napló', en: 'Audit Log' },
        description: { hu: 'Rendszer események', en: 'System events' },
        color: '#8b5cf6',
    },
];

export function ValidatorDashboard() {
    const navigate = useNavigate();
    const { language } = useUIStore();

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 bg-[rgba(26,31,58,0.95)] border-b border-white/10">
                <h1 className="text-xl font-semibold text-white">
                    {language === 'hu' ? 'Minőségellenőrzés' : 'Quality Validator'}
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                    {language === 'hu'
                        ? 'Nyomkövetés, ellenőrzések és audit'
                        : 'Traceability, inspections, and audit'}
                </p>
            </div>

            {/* Section Cards */}
            <div className="flex-1 p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {SECTIONS.map((section) => {
                        const Icon = section.icon;
                        return (
                            <div
                                key={section.path}
                                onClick={() => navigate(`/validator/${section.path}`)}
                                className={cn(
                                    'p-6 rounded-xl cursor-pointer',
                                    'bg-[rgba(26,31,58,0.95)] border border-white/10',
                                    'hover:border-white/20 transition-all group'
                                )}
                            >
                                <div
                                    className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                                    style={{ backgroundColor: `${section.color}20` }}
                                >
                                    <Icon className="w-6 h-6" style={{ color: section.color }} />
                                </div>
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    {section.label[language]}
                                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </h3>
                                <p className="text-sm text-gray-400 mt-1">
                                    {section.description[language]}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
```

---

### Task 5.8: Update Router with New Structure

**File**: `flow-viz-react/src/router.tsx` (UPDATE)

```typescript
import { createHashRouter, Navigate, Outlet } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { FlowVizV1 } from './pages/FlowVizV1';
import { Presentation } from './pages/Presentation';
import { Login } from './pages/Login';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { FlowCatalogPage, FlowEditorPage } from './components/flowEditor';

// New imports
import { CommandCenterPage } from './pages/CommandCenterPage';
import { ActiveRunLayout } from './components/run/ActiveRunLayout';
import { RunControlsTab } from './components/run/RunControlsTab';
import { RunBuffersTab } from './components/run/RunBuffersTab';
import { RunLotsTab } from './components/run/RunLotsTab';
import { RunQCTab } from './components/run/RunQCTab';
import { ValidatorDashboard } from './pages/ValidatorDashboard';
import { GenealogyPage } from './pages/GenealogyPage';
import { InspectionsPage } from './pages/InspectionsPage';
import { AuditLogPage } from './pages/AuditLogPage';

export const router = createHashRouter([
    {
        path: '/login',
        element: <Login />,
    },
    {
        element: <ProtectedRoute />,
        children: [
            {
                element: (
                    <AppShell>
                        <Outlet />
                    </AppShell>
                ),
                children: [
                    // Default redirect
                    { path: '/', element: <Navigate to="/dashboard" replace /> },

                    // Dashboard
                    { path: '/dashboard', element: <FlowVizV1 /> },

                    // Legacy redirects
                    { path: '/flow-v1', element: <Navigate to="/dashboard" replace /> },
                    { path: '/flow-v2', element: <Navigate to="/command" replace /> },
                    { path: '/flow-v3', element: <Navigate to="/validator" replace /> },
                    { path: '/first-flow', element: <Navigate to="/command" replace /> },

                    // Command Center
                    {
                        path: '/command',
                        element: <ProtectedRoute allowedRoles={['MANAGER', 'OPERATOR', 'ADMIN']} />,
                        children: [
                            { index: true, element: <CommandCenterPage /> },
                            {
                                path: 'run/:runId',
                                element: <ActiveRunLayout />,
                                children: [
                                    { index: true, element: <RunControlsTab /> },
                                    { path: 'buffers', element: <RunBuffersTab /> },
                                    { path: 'lots', element: <RunLotsTab /> },
                                    { path: 'qc', element: <RunQCTab /> },
                                ],
                            },
                        ],
                    },

                    // Quality Validator
                    {
                        path: '/validator',
                        element: <ProtectedRoute allowedRoles={['AUDITOR', 'ADMIN', 'MANAGER']} />,
                        children: [
                            { index: true, element: <ValidatorDashboard /> },
                            { path: 'genealogy', element: <GenealogyPage /> },
                            { path: 'inspections', element: <InspectionsPage /> },
                            { path: 'audit', element: <AuditLogPage /> },
                        ],
                    },

                    // Flow Editor
                    {
                        path: '/flow-editor',
                        element: <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'OPERATOR']} />,
                        children: [
                            { index: true, element: <FlowCatalogPage /> },
                            { path: ':flowId', element: <FlowEditorPage /> },
                            { path: ':flowId/v/:versionNum', element: <FlowEditorPage /> },
                            { path: ':flowId/versions', element: <FlowEditorPage /> },
                        ],
                    },

                    // Presentation
                    { path: '/presentation', element: <Presentation /> },
                ],
            },
        ],
    },
]);
```

---

### Task 5.9: Update Navigation in AppShell

**File**: `flow-viz-react/src/components/shell/AppShell.tsx` (UPDATE navigation items)

```typescript
// Update the NAV_ITEMS array:

const NAV_ITEMS = [
    {
        path: '/dashboard',
        icon: LayoutDashboard,
        label: { hu: 'Irányítópult', en: 'Dashboard' },
    },
    {
        path: '/command',
        icon: Terminal,
        label: { hu: 'Parancsközpont', en: 'Command Center' },
        roles: ['MANAGER', 'OPERATOR', 'ADMIN'],
    },
    {
        path: '/validator',
        icon: ShieldCheck,
        label: { hu: 'Minőségellenőrzés', en: 'Quality Validator' },
        roles: ['AUDITOR', 'ADMIN', 'MANAGER'],
    },
    {
        path: '/flow-editor',
        icon: GitBranch,
        label: { hu: 'Folyamat Editor', en: 'Flow Editor' },
        roles: ['ADMIN', 'MANAGER', 'OPERATOR'],
    },
    {
        path: '/presentation',
        icon: Presentation,
        label: { hu: 'Prezentáció', en: 'Presentation' },
    },
];
```

---

### Task 5.10: Create Placeholder Tab Components

**Files**: Create minimal placeholder components for tabs not yet fully implemented

```typescript
// flow-viz-react/src/components/run/RunControlsTab.tsx
export function RunControlsTab() {
    return <div className="p-6 text-white">Run Controls - Coming Soon</div>;
}

// flow-viz-react/src/components/run/RunLotsTab.tsx
export function RunLotsTab() {
    return <div className="p-6 text-white">Run Lots - Coming Soon</div>;
}

// flow-viz-react/src/components/run/RunQCTab.tsx
export function RunQCTab() {
    return <div className="p-6 text-white">Run QC - Coming Soon</div>;
}

// flow-viz-react/src/pages/GenealogyPage.tsx
export function GenealogyPage() {
    return <div className="p-6 text-white">Genealogy - Coming Soon</div>;
}

// flow-viz-react/src/pages/InspectionsPage.tsx
export function InspectionsPage() {
    return <div className="p-6 text-white">Inspections - Coming Soon</div>;
}

// flow-viz-react/src/pages/AuditLogPage.tsx
export function AuditLogPage() {
    return <div className="p-6 text-white">Audit Log - Coming Soon</div>;
}
```

---

## Validation Loop

### Step 1: TypeScript Compilation

```bash
cd flow-viz-react
npm run build
```

### Step 2: Linting

```bash
npm run lint
```

### Step 3: Manual Route Testing

```bash
npm run dev

# Test routes:
# - /dashboard → Dashboard loads
# - /command → Command Center loads
# - /command/run/{id}/buffers → Buffer board loads
# - /validator → Validator dashboard loads
# - /validator/genealogy → Genealogy page loads
# - /flow-editor → Flow catalog loads
# - /first-flow → Redirects to /command
# - /flow-v2 → Redirects to /command
# - /flow-v3 → Redirects to /validator
```

### Step 4: RBAC Testing

```bash
# Login as VIEWER - should NOT see Command Center
# Login as OPERATOR - should see Command Center
# Login as AUDITOR - should see Quality Validator
```

---

## Final Checklist

- [ ] API Clients: runs.ts, updated qc.ts (genealogy, audit)
- [ ] Store: useRunStore with full run lifecycle management
- [ ] Page: CommandCenterPage with run list and filtering
- [ ] Component: ActiveRunLayout with tabs and step progress
- [ ] Component: RunBuffersTab (migrated from FirstFlowPage)
- [ ] Page: ValidatorDashboard with section cards
- [ ] Placeholder pages: GenealogyPage, InspectionsPage, AuditLogPage
- [ ] Router: Updated with new route structure
- [ ] Navigation: Updated AppShell with new nav items
- [ ] Legacy redirects: /first-flow, /flow-v2, /flow-v3
- [ ] TypeScript builds without errors
- [ ] Lint passes
- [ ] All routes accessible with correct RBAC

---

## Future Work (Out of Scope)

- Full GenealogyPage implementation with tree visualization
- Full InspectionsPage with filtering and export
- Full AuditLogPage with pagination and search
- RunControlsTab with lot registration forms
- RunLotsTab with lot list and status management
- RunQCTab with QC decision forms

---

## Confidence Score: 7/10

**Moderate confidence** because:
- Route structure is well-defined in INITIAL-11
- Component patterns exist in codebase
- API contracts are established

**Uncertainty**:
- Placeholder components need full implementation
- Complex state management for active runs
- UX for genealogy tree visualization
- Testing across all role combinations
