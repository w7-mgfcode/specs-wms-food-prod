import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Database } from '../types/database.types';
import type { ScenarioConfig, QCGate as ScenarioQCGate } from '../types/scenario';
import { generateUUID } from '../lib/uuid';

// We import the static JSON as initial data
import initialScenarioData from '../../public/scenarios/doner-kft.json';

type ProductionRun = Database['public']['Tables']['production_runs']['Row'];
type Lot = Database['public']['Tables']['lots']['Row'];
type LotType = Database['public']['Tables']['lots']['Row']['lot_type'];
type QCGate = Database['public']['Tables']['qc_gates']['Row'];
type QCDecision = Database['public']['Tables']['qc_decisions']['Row'];

// Phase to LOT type mapping with realistic ranges
const PHASE_LOT_CONFIG: Record<number, {
    lotType: LotType;
    weightMin: number;
    weightMax: number;
    tempMin: number;
    tempMax: number;
    description: string;
} | null> = {
    0: null, // START - no LOT
    1: { lotType: 'RAW', weightMin: 200, weightMax: 500, tempMin: 2, tempMax: 6, description: 'Raw material receipt' },
    2: { lotType: 'DEB', weightMin: 150, weightMax: 400, tempMin: 2, tempMax: 5, description: 'Deboned meat' },
    3: { lotType: 'BULK', weightMin: 400, weightMax: 600, tempMin: 1, tempMax: 4, description: 'Bulk buffer' },
    4: { lotType: 'MIX', weightMin: 700, weightMax: 900, tempMin: 2, tempMax: 4, description: 'Mixed batch' },
    5: { lotType: 'SKW', weightMin: 15, weightMax: 30, tempMin: 2, tempMax: 4, description: 'Skewered rod' },
    6: { lotType: 'SKW', weightMin: 15, weightMax: 30, tempMin: 2, tempMax: 4, description: 'SKU split' },
    7: { lotType: 'FRZ', weightMin: 15, weightMax: 30, tempMin: -25, tempMax: -18, description: 'Frozen' },
    8: { lotType: 'FG', weightMin: 15, weightMax: 30, tempMin: -22, tempMax: -18, description: 'Finished goods' },
    9: null, // Palletizing - aggregation only
    10: null, // Shipment - no new LOT
};

// Auto-generated LOT entry for the log
interface AutoLotEntry {
    id: string;
    lotCode: string;
    lotType: LotType;
    weight: number;
    temperature: number;
    timestamp: Date;
    phaseId: number;
}

// Run summary for end-of-run modal
interface RunSummary {
    run_code: string;
    started_at: string;
    ended_at: string;
    duration_minutes: number;
    total_lots: number;
    qc_pass: number;
    qc_hold: number;
    qc_fail: number;
    phases_completed: number;
}

interface ProductionState {
    // Configuration
    scenario: ScenarioConfig | null;

    // Runtime State
    activeRun: ProductionRun | null;
    currentPhase: number;

    // Auto-Registration
    autoRegistrationEnabled: boolean;
    autoLotLog: AutoLotEntry[];

    // Run Summary (for end-of-run modal)
    lastRunSummary: RunSummary | null;
    showRunSummary: boolean;
    runHistory: RunSummary[];  // History of completed runs

    // Data Registry
    lots: Record<string, Lot>;
    qcGates: Record<string, QCGate>;
    qcDecisions: Record<string, QCDecision>;

    // Actions
    loadScenario: () => void;
    startProductionRun: (operatorId: string) => Promise<void>;
    endProductionRun: () => Promise<RunSummary | null>;
    advancePhase: () => void;
    setPhase: (phase: number) => void;
    dismissRunSummary: () => void;

    // Phase 2 Actions
    registerLot: (lot: Omit<Lot, 'id' | 'created_at'>) => Promise<void>;
    addQCDecision: (decision: Omit<QCDecision, 'id' | 'decided_at'>) => Promise<void>;
    getLotsByPhase: (phaseId: string) => Lot[];

    // Auto-Registration Actions
    setAutoRegistrationEnabled: (enabled: boolean) => void;
    generateAutoLot: (phaseNumber: number) => Promise<AutoLotEntry | null>;
    getPhaseConfig: (phaseNumber: number) => typeof PHASE_LOT_CONFIG[number];
    clearAutoLotLog: () => void;

    // QC Gate Management Actions
    addQCGate: (gate: Omit<ScenarioQCGate, 'id'>) => void;
    updateQCGate: (id: number | string, updates: Partial<ScenarioQCGate>) => void;
    deleteQCGate: (id: number | string) => void;
    updateGateChecklist: (gateId: number | string, checklist: string[]) => void;
}

import { db } from '../lib/db';

// Helper to generate random number in range
const randomInRange = (min: number, max: number, decimals: number = 1): number => {
    const value = Math.random() * (max - min) + min;
    return Number(value.toFixed(decimals));
};

export const useProductionStore = create<ProductionState>()(
    devtools(
        (set, get) => ({
            scenario: null,
            activeRun: null,
            currentPhase: 0,
            lots: {},
            qcGates: {},
            qcDecisions: {},
            autoRegistrationEnabled: false,
            autoLotLog: [],
            lastRunSummary: null,
            showRunSummary: false,
            runHistory: [],

            loadScenario: () => {
                // In a real app, we would fetch this from Supabase 'scenarios' table
                // For now, we load the JSON
                console.log('Loading initial scenario from JSON');
                set({
                    scenario: initialScenarioData as any, // Cast due to strict type differences between DB and JSON for now
                    currentPhase: 0
                });
            },

            startProductionRun: async (operatorId) => {
                const run_id = generateUUID();
                const run: ProductionRun = {
                    id: run_id,
                    run_code: `PRD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${run_id.slice(0, 4)}`.toUpperCase(),
                    scenario_id: 'mock-scenario-id',
                    operator_id: operatorId,
                    status: 'ACTIVE',
                    daily_target_kg: 1000,
                    started_at: new Date().toISOString(),
                    ended_at: null,
                    summary: {}
                };
                set({ activeRun: run, currentPhase: 1, autoLotLog: [] });
            },

            endProductionRun: async () => {
                const { activeRun, lots, qcDecisions, currentPhase } = get();
                if (!activeRun) return null;

                const endedAt = new Date();
                const startedAt = new Date(activeRun.started_at);
                const durationMs = endedAt.getTime() - startedAt.getTime();
                const durationMinutes = Math.round(durationMs / 60000);

                // Count QC decisions
                const decisions = Object.values(qcDecisions);
                const qcPass = decisions.filter(d => d.decision === 'PASS').length;
                const qcHold = decisions.filter(d => d.decision === 'HOLD').length;
                const qcFail = decisions.filter(d => d.decision === 'FAIL').length;

                // Create summary
                const summary: RunSummary = {
                    run_code: activeRun.run_code,
                    started_at: activeRun.started_at,
                    ended_at: endedAt.toISOString(),
                    duration_minutes: durationMinutes,
                    total_lots: Object.keys(lots).length,
                    qc_pass: qcPass,
                    qc_hold: qcHold,
                    qc_fail: qcFail,
                    phases_completed: currentPhase
                };

                // Clear state, show summary, and add to history
                set((state) => ({
                    activeRun: null,
                    currentPhase: 0,
                    lots: {},
                    qcDecisions: {},
                    autoLotLog: [],
                    lastRunSummary: summary,
                    showRunSummary: true,
                    runHistory: [...state.runHistory, summary]  // Keep in history
                }));

                console.log('Production run ended:', summary);
                return summary;
            },

            dismissRunSummary: () => {
                set({ showRunSummary: false });
            },

            advancePhase: () => {
                const { currentPhase, scenario, autoRegistrationEnabled, generateAutoLot } = get();
                if (!scenario) return;
                const maxPhase = scenario.phases.length;
                if (currentPhase < maxPhase) {
                    const nextPhase = currentPhase + 1;
                    set({ currentPhase: nextPhase });

                    // Auto-generate LOT if enabled
                    if (autoRegistrationEnabled) {
                        generateAutoLot(nextPhase);
                    }
                }
            },

            setPhase: (phase) => {
                set({ currentPhase: phase });
            },

            registerLot: async (lotData) => {
                const { activeRun } = get();

                // 1. Prepare Data
                const newLotData: any = {
                    ...lotData,
                    production_run_id: lotData.production_run_id || (activeRun?.id ?? null)
                };

                // 2. Call DB Adapter
                try {
                    await db.registerLot(newLotData);
                    console.log("DB: Lot registered successfully");
                } catch (e) {
                    console.error("DB: Failed to register lot", e);
                    // Decide if we should block UI updates on error. For now, proceeding with Optimistic UI.
                }

                // 3. Optimistic Local Update
                const newLot: Lot = {
                    ...newLotData,
                    id: generateUUID(), // Local ID, sync logic would overwrite this with real DB ID
                    created_at: new Date().toISOString()
                };

                set((state) => ({
                    lots: { ...state.lots, [newLot.id]: newLot }
                }));
            },

            addQCDecision: async (decisionData) => {
                // 1. DB Call
                try {
                    await db.addQCDecision(decisionData);
                    console.log("DB: QC Decision recorded");
                } catch (e) {
                    console.error("DB: Failed to record QC decision", e);
                }

                // 2. Optimistic Update
                const newDecision: QCDecision = {
                    ...decisionData,
                    id: generateUUID(),
                    decided_at: new Date().toISOString()
                };

                set((state) => ({
                    qcDecisions: { ...state.qcDecisions, [newDecision.id]: newDecision }
                }));
            },

            getLotsByPhase: (phaseId: string) => {
                const { lots } = get();
                return Object.values(lots).filter(lot => lot.phase_id === phaseId);
            },

            // ==================== AUTO-REGISTRATION ====================

            setAutoRegistrationEnabled: (enabled) => {
                set({ autoRegistrationEnabled: enabled });
                console.log(`Auto-registration ${enabled ? 'ENABLED' : 'DISABLED'}`);
            },

            getPhaseConfig: (phaseNumber) => {
                return PHASE_LOT_CONFIG[phaseNumber] || null;
            },

            generateAutoLot: async (phaseNumber) => {
                const { activeRun, registerLot } = get();
                const config = PHASE_LOT_CONFIG[phaseNumber];

                if (!config || !activeRun) {
                    console.log(`No LOT config for phase ${phaseNumber} or no active run`);
                    return null;
                }

                // Generate realistic values
                const weight = randomInRange(config.weightMin, config.weightMax, 1);
                const temperature = randomInRange(config.tempMin, config.tempMax, 1);
                const timestamp = new Date();
                const lotCode = `${config.lotType}-${timestamp.getTime().toString().slice(-6)}-AUTO`;

                // Create auto-lot entry for log
                const autoEntry: AutoLotEntry = {
                    id: generateUUID(),
                    lotCode,
                    lotType: config.lotType,
                    weight,
                    temperature,
                    timestamp,
                    phaseId: phaseNumber
                };

                // Register the LOT
                await registerLot({
                    lot_code: lotCode,
                    lot_type: config.lotType,
                    weight_kg: weight,
                    temperature_c: temperature,
                    phase_id: String(phaseNumber),
                    production_run_id: activeRun.id,
                    operator_id: activeRun.operator_id,
                    metadata: {
                        autoGenerated: true,
                        phaseDescription: config.description
                    }
                });

                // Add to log (keep last 10 entries)
                set((state) => ({
                    autoLotLog: [autoEntry, ...state.autoLotLog].slice(0, 10)
                }));

                console.log(`Auto-generated LOT: ${lotCode} (${weight}kg, ${temperature}°C)`);
                return autoEntry;
            },

            clearAutoLotLog: () => {
                set({ autoLotLog: [] });
            },

            // ==================== QC GATE MANAGEMENT ====================

            addQCGate: (gateData) => {
                const { scenario } = get();
                if (!scenario) return;

                const existingGates = scenario.config?.qcGates || [];
                const newId = Math.max(...existingGates.map(g => typeof g.id === 'number' ? g.id : 0), 0) + 1;

                const newGate: ScenarioQCGate = {
                    ...gateData,
                    id: newId
                };

                set((state) => ({
                    scenario: state.scenario ? {
                        ...state.scenario,
                        config: {
                            ...state.scenario.config,
                            qcGates: [...(state.scenario.config?.qcGates || []), newGate]
                        }
                    } : null
                }));

                console.log(`Added QC Gate #${newId}`);
            },

            updateQCGate: (id, updates) => {
                const { scenario } = get();
                if (!scenario) return;

                set((state) => ({
                    scenario: state.scenario ? {
                        ...state.scenario,
                        config: {
                            ...state.scenario.config,
                            qcGates: (state.scenario.config?.qcGates || []).map(gate =>
                                gate.id === id ? { ...gate, ...updates } : gate
                            )
                        }
                    } : null
                }));

                console.log(`Updated QC Gate #${id}`);
            },

            deleteQCGate: (id) => {
                const { scenario } = get();
                if (!scenario) return;

                set((state) => ({
                    scenario: state.scenario ? {
                        ...state.scenario,
                        config: {
                            ...state.scenario.config,
                            qcGates: (state.scenario.config?.qcGates || []).filter(gate => gate.id !== id)
                        }
                    } : null
                }));

                console.log(`Deleted QC Gate #${id}`);
            },

            updateGateChecklist: (gateId, checklist) => {
                const { scenario, updateQCGate } = get();
                if (!scenario) return;

                // Find gate and update
                const gate = scenario.config?.qcGates?.find(g => g.id === gateId);
                if (gate) {
                    updateQCGate(gateId, { ...gate, checklist } as any);
                }
            }
        })
    )
);
