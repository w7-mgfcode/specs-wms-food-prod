import { useState } from 'react';
import { useProductionStore } from '../stores/useProductionStore';
import { ProductionControls } from '../components/command/ProductionControls';
import { LotRegistrationForm } from '../components/forms/LotRegistrationForm';
import { QCDecisionPanel } from '../components/command/QCDecisionPanel';
import { AutoRegistrationPanel } from '../components/command/AutoRegistrationPanel';
import { QCGatesManager } from '../components/command/QCGatesManager';
import { RunSummaryModal } from '../components/command/RunSummaryModal';
import { FlowCanvas } from '../components/flow/FlowCanvas';
import { TraceabilityGraph } from '../components/validator/TraceabilityGraph';
import { ConfigPanel } from '../components/command/ConfigPanel';
import { cn } from '../lib/utils';
import type { Database } from '../types/database.types';

type QCGate = Database['public']['Tables']['qc_gates']['Row'];

export function FlowVizV2() {
    const { currentPhase, scenario, getLotsByPhase, activeRun } = useProductionStore();
    const [activeTab, setActiveTab] = useState<'controls' | 'traceability' | 'config'>('controls');

    // Helper to find gates for current phase
    // In a real scenario, we'd map this properly. For now, mocking:
    const activePhase = scenario?.phases.find((p: any) => p.phase_number === currentPhase) as any;
    const currentPhaseGateId = activePhase?.qc_gate_id;
    const currentPhaseGate = scenario?.qc_gates?.find((g: any) => g.id === currentPhaseGateId || g.gate_number === currentPhase) as QCGate;

    // Get active LOTs in this phase
    const phaseLots = getLotsByPhase(activePhase?.id);

    return (
        <>
            <RunSummaryModal />
            <div className="h-full flex flex-col bg-slate-900 text-white">
                {/* Top Bar: Production status & Controls */}
                <div className="p-4 border-b border-slate-700 bg-slate-800/80 backdrop-blur-md">
                    <ProductionControls />
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Interactive Command Panel */}
                    <div className="w-1/3 min-w-[400px] border-r border-slate-700 flex flex-col bg-slate-900/50">
                        {/* Command Tabs */}
                        <div className="flex border-b border-slate-700">
                            {['controls', 'traceability', 'config'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={cn(
                                        "flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-all",
                                        activeTab === tab
                                            ? "border-b-2 border-cyan-500 text-cyan-400 bg-slate-800"
                                            : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                                    )}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {activeTab === 'controls' && (
                                <div className="space-y-6">
                                    {/* 0. Auto-Registration Panel */}
                                    <AutoRegistrationPanel />

                                    <hr className="border-slate-700" />

                                    {/* 1. Manual Lot Registration */}
                                    <section>
                                        <h4 className="text-cyan-400 font-bold mb-2 flex items-center gap-2">
                                            <span className="text-lg">📥</span> Manual Input / Registration
                                        </h4>
                                        <LotRegistrationForm phaseId={activePhase?.id} />
                                    </section>

                                    <hr className="border-slate-700" />

                                    {/* 2. QC Gates for this Phase */}
                                    <section>
                                        <h4 className="text-yellow-400 font-bold mb-2 flex items-center gap-2">
                                            <span className="text-lg">🛡️</span> QC Gates
                                        </h4>
                                        {currentPhaseGate ? (
                                            <div className="space-y-4">
                                                {phaseLots.length > 0 ? (
                                                    phaseLots.map(lot => (
                                                        <div key={lot.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                                                            <div className="text-sm font-mono text-cyan-200 mb-2">{lot.lot_code}</div>
                                                            <QCDecisionPanel gate={currentPhaseGate} lotId={lot.id} />
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-sm text-slate-500 italic p-4 bg-slate-800/50 rounded text-center">
                                                        No active LOTs in this phase to check.
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-slate-500">No QC Gates configured for this phase.</div>
                                        )}
                                    </section>
                                </div>
                            )}

                            {activeTab === 'traceability' && (
                                <TraceabilityGraph />
                            )}

                            {activeTab === 'config' && (
                                <div className="space-y-6">
                                    <ConfigPanel />
                                    <hr className="border-slate-700" />
                                    <QCGatesManager />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Visualization & Status */}
                    <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col">
                        <div className="absolute top-4 right-4 z-10 flex gap-2">
                            <div className="bg-black/50 backdrop-blur border border-white/10 rounded-lg p-3 text-right">
                                <div className="text-xs text-slate-400">Current Phase</div>
                                <div className="text-xl font-bold text-cyan-400">{activePhase?.name?.en || 'Step ' + currentPhase}</div>
                            </div>
                        </div>

                        {/* Reusing V1 Canvas for Context */}
                        <div className="flex-1 opacity-60 hover:opacity-100 transition-opacity">
                            {scenario && (
                                <FlowCanvas
                                    streams={scenario.streams}
                                    phases={scenario.phases}
                                    currentPhase={currentPhase}
                                />
                            )}
                        </div>

                        {/* Live Event Log */}
                        <div className="h-48 border-t border-slate-700 bg-black/80 p-4 overflow-y-auto font-mono text-xs">
                            <div className="text-slate-500 mb-2">SYSTEM LOG</div>
                            {activeRun ? (
                                <div className="space-y-1">
                                    <div className="text-green-400">[{new Date(activeRun.started_at).toLocaleTimeString()}] Production Run Started ({activeRun.run_code})</div>
                                    {phaseLots.map(lot => (
                                        <div key={lot.id} className="text-cyan-400">
                                            [{new Date(lot.created_at).toLocaleTimeString()}] LOT Registered: {lot.lot_code} ({lot.weight_kg}kg)
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-slate-600">Waiting for run to start...</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
