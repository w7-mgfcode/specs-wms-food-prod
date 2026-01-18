import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { BufferConfig, FlowLot, FlowGate, FirstFlowConfig } from '../types/flow';

// Import config JSON (will be loaded dynamically)
import firstFlowConfigData from '../../public/scenarios/first-flow-config.json';

interface FlowState {
    // Configuration
    buffers: Record<string, BufferConfig>;
    lots: FlowLot[];
    gates: FlowGate[];

    // Runtime State
    activeGateId: number | string | null;
    selectedLotId: string | null;
    isLoaded: boolean;

    // Actions
    loadFlowConfig: () => void;
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

            loadFlowConfig: () => {
                const config = firstFlowConfigData as FirstFlowConfig;

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
                });

                console.log('Flow config loaded:', {
                    buffers: Object.keys(config.buffers).length,
                    lots: config.lots.length,
                    gates: gates.length,
                });
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

                console.log(`Advanced to gate: ${nextGate.id}`);
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
