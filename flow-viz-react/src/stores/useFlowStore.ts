import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { BufferConfig, FlowLot, FlowGate, FirstFlowConfig } from '../types/flow';

interface FlowState {
    // Configuration
    buffers: Record<string, BufferConfig>;
    lots: FlowLot[];
    gates: FlowGate[];

    // Runtime State
    activeGateId: number | string | null;
    selectedLotId: string | null;
    isLoaded: boolean;
    loadError: string | null;

    // Actions
    loadFlowConfig: () => Promise<void>;
    setActiveGate: (gateId: number | string) => void;
    advanceGate: () => void;
    resetGates: () => void;
    selectLot: (lotId: string | null) => void;
    getLotsByBuffer: (bufferId: string) => FlowLot[];
}

export const useFlowStore = create<FlowState>()(
    devtools(
        (set, get) => ({
            // Initial state
            buffers: {},
            lots: [],
            gates: [],
            activeGateId: null,
            selectedLotId: null,
            isLoaded: false,
            loadError: null,

            loadFlowConfig: async () => {
                try {
                    const response = await fetch('/scenarios/first-flow-config.json');
                    if (!response.ok) {
                        throw new Error(`Failed to load config: ${response.statusText}`);
                    }
                    const config = (await response.json()) as FirstFlowConfig;

                    // Mark first gate as active if not already set
                    const gates = config.gates.map((gate, idx) => ({
                        ...gate,
                        isActive: idx === 0,
                        isCompleted: false,
                    }));

                    set({
                        buffers: config.buffers,
                        lots: config.lots,
                        gates,
                        activeGateId: gates[0]?.id ?? null,
                        isLoaded: true,
                        loadError: null,
                    });
                } catch (error) {
                    set({
                        loadError:
                            error instanceof Error ? error.message : 'Failed to load flow configuration',
                        isLoaded: false,
                    });
                }
            },

            setActiveGate: (gateId) => {
                const { gates } = get();
                const gateIndex = gates.findIndex((g) => g.id === gateId);
                if (gateIndex === -1) return;

                const updatedGates = gates.map((gate, idx) => ({
                    ...gate,
                    isActive: gate.id === gateId,
                    isCompleted: idx < gateIndex,
                }));

                set({
                    gates: updatedGates,
                    activeGateId: gateId,
                });
            },

            advanceGate: () => {
                const { gates, activeGateId } = get();
                const currentIndex = gates.findIndex((g) => g.id === activeGateId);
                if (currentIndex === -1 || currentIndex >= gates.length - 1) return;

                const nextGate = gates[currentIndex + 1];
                const updatedGates = gates.map((gate, idx) => ({
                    ...gate,
                    isActive: gate.id === nextGate.id,
                    isCompleted: idx <= currentIndex,
                }));

                set({
                    gates: updatedGates,
                    activeGateId: nextGate.id,
                });
            },

            resetGates: () => {
                const { gates } = get();
                const resetGates = gates.map((gate, idx) => ({
                    ...gate,
                    isActive: idx === 0,
                    isCompleted: false,
                }));

                set({
                    gates: resetGates,
                    activeGateId: resetGates[0]?.id ?? null,
                });
            },

            selectLot: (lotId) => {
                set({ selectedLotId: lotId });
            },

            getLotsByBuffer: (bufferId) => {
                const { lots } = get();
                return lots.filter((lot) => lot.bufferId === bufferId);
            },
        }),
        { name: 'FlowStore' }
    )
);
