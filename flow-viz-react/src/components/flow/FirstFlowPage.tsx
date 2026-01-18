import { useEffect, useCallback } from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';
import { useFlowStore } from '../../stores/useFlowStore';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { GateStepper } from './GateStepper';
import { BufferLane } from './BufferLane';
import type { FlowLot } from '../../types/flow';

export function FirstFlowPage() {
    const { language } = useUIStore();
    const { role } = useAuthStore();

    const {
        buffers,
        lots,
        gates,
        selectedLotId,
        isLoaded,
        activeGateId,
        loadFlowConfig,
        setActiveGate,
        advanceGate,
        resetGates,
        selectLot,
        getLotsByBuffer,
    } = useFlowStore();

    // Determine if user can interact (OPERATOR, MANAGER, ADMIN)
    const isInteractive = role === 'OPERATOR' || role === 'MANAGER' || role === 'ADMIN';

    // Check if at last gate
    const isAtLastGate =
        gates.length > 0 && activeGateId === gates[gates.length - 1]?.id;

    // Load config on mount
    useEffect(() => {
        if (!isLoaded) {
            loadFlowConfig();
        }
    }, [isLoaded, loadFlowConfig]);

    // Handle lot click
    const handleLotClick = useCallback(
        (lot: FlowLot) => {
            if (!isInteractive) return;
            selectLot(selectedLotId === lot.id ? null : lot.id);
        },
        [isInteractive, selectedLotId, selectLot]
    );

    // Handle gate click
    const handleGateClick = useCallback(
        (gateId: number | string) => {
            if (!isInteractive) return;
            setActiveGate(gateId);
        },
        [isInteractive, setActiveGate]
    );

    if (!isLoaded) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-[var(--color-text-secondary)]">
                    {language === 'hu' ? 'Betöltés...' : 'Loading...'}
                </div>
            </div>
        );
    }

    const bufferOrder = ['LK', 'MIX', 'SKW15', 'SKW30'];
    const orderedBuffers = bufferOrder.filter((id) => buffers[id]).map((id) => buffers[id]);

    return (
        <div className="space-y-6 p-4">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-white">
                        {language === 'hu' ? 'Első Áramlat' : 'First Flow'}
                    </h1>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        {language === 'hu'
                            ? 'Puffer állapot és QC Gate előrehaladás'
                            : 'Buffer status and QC Gate progression'}
                    </p>
                </div>

                {/* Controls (only for interactive roles) */}
                {isInteractive && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={resetGates}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] text-white rounded-lg transition-colors"
                            title={language === 'hu' ? 'Visszaállítás' : 'Reset'}
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {language === 'hu' ? 'Visszaállítás' : 'Reset'}
                        </button>
                        <button
                            onClick={advanceGate}
                            disabled={isAtLastGate}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--status-processing)] hover:opacity-90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={
                                isAtLastGate
                                    ? language === 'hu'
                                        ? 'Utolsó kapu'
                                        : 'Last gate'
                                    : language === 'hu'
                                      ? 'Következő kapu'
                                      : 'Next Gate'
                            }
                        >
                            {language === 'hu' ? 'Következő' : 'Next'}
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Role Indicator for non-interactive users */}
            {!isInteractive && role && (
                <div className="text-xs text-[var(--color-text-secondary)] bg-[rgba(255,255,255,0.05)] px-3 py-2 rounded-lg">
                    {language === 'hu'
                        ? `Megtekintés mód (${role}) - Csak olvasható`
                        : `View mode (${role}) - Read-only`}
                </div>
            )}

            {/* Gate Stepper */}
            <GateStepper
                gates={gates}
                lang={language}
                onGateClick={isInteractive ? handleGateClick : undefined}
                isInteractive={isInteractive}
            />

            {/* Buffer Lanes */}
            <div className="space-y-4">
                {orderedBuffers.map((buffer) => (
                    <BufferLane
                        key={buffer.id}
                        buffer={buffer}
                        lots={getLotsByBuffer(buffer.id)}
                        lang={language}
                        onLotClick={isInteractive ? handleLotClick : undefined}
                        selectedLotId={selectedLotId}
                        isInteractive={isInteractive}
                    />
                ))}
            </div>

            {/* Selected Lot Info Panel */}
            {selectedLotId && (
                <SelectedLotPanel lotId={selectedLotId} lots={lots} lang={language} onClose={() => selectLot(null)} />
            )}
        </div>
    );
}

// Sub-component for selected lot details
interface SelectedLotPanelProps {
    lotId: string;
    lots: FlowLot[];
    lang: 'hu' | 'en';
    onClose: () => void;
}

function SelectedLotPanel({ lotId, lots, lang, onClose }: SelectedLotPanelProps) {
    const lot = lots.find((l) => l.id === lotId);
    if (!lot) return null;

    return (
        <div className="glass-card p-4 rounded-xl border border-white/20">
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-white">{lot.description[lang]}</h3>
                    <p className="font-mono text-xs text-[var(--color-text-secondary)] mt-1">{lot.code}</p>
                </div>
                <button
                    onClick={onClose}
                    className="text-[var(--color-text-secondary)] hover:text-white transition-colors"
                    aria-label={lang === 'hu' ? 'Bezárás' : 'Close'}
                >
                    ×
                </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 text-xs">
                {lot.weight_kg !== undefined && (
                    <div>
                        <span className="text-[var(--color-text-secondary)]">
                            {lang === 'hu' ? 'Súly' : 'Weight'}:
                        </span>
                        <span className="text-white ml-2">{lot.weight_kg} kg</span>
                    </div>
                )}
                {lot.quantity !== undefined && (
                    <div>
                        <span className="text-[var(--color-text-secondary)]">
                            {lang === 'hu' ? 'Mennyiség' : 'Quantity'}:
                        </span>
                        <span className="text-white ml-2">{lot.quantity} pcs</span>
                    </div>
                )}
                {lot.temperature_c !== undefined && (
                    <div>
                        <span className="text-[var(--color-text-secondary)]">
                            {lang === 'hu' ? 'Hőmérséklet' : 'Temperature'}:
                        </span>
                        <span className="text-white ml-2">{lot.temperature_c}°C</span>
                    </div>
                )}
                <div>
                    <span className="text-[var(--color-text-secondary)]">
                        {lang === 'hu' ? 'QC Állapot' : 'QC Status'}:
                    </span>
                    <span className="text-white ml-2 capitalize">{lot.qcStatus}</span>
                </div>
            </div>
        </div>
    );
}
