/**
 * Production Run Store
 *
 * Manages active run state and operations.
 * Phase 8.5: Route Consolidation & UI Migration
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
    completeRun,
    abortRun,
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
    doCompleteRun: (runId: string) => Promise<void>;
    doAbortRun: (runId: string, reason: string) => Promise<void>;
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

            doCompleteRun: async (runId: string) => {
                set({ isAdvancing: true, error: null });
                try {
                    const run = await completeRun(runId);
                    set({ currentRun: run, isAdvancing: false });
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to complete run',
                        isAdvancing: false,
                    });
                }
            },

            doAbortRun: async (runId: string, reason: string) => {
                set({ isAdvancing: true, error: null });
                try {
                    const run = await abortRun(runId, reason);
                    set({ currentRun: run, isAdvancing: false });
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to abort run',
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
