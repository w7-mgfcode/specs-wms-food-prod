import { useProductionStore } from '../../stores/useProductionStore';

export function ProductionControls() {
    const {
        activeRun,
        currentPhase,
        scenario,
        startProductionRun,
        endProductionRun,
        advancePhase,
        setPhase,
        loadScenario
    } = useProductionStore();

    // Ensure scenario is loaded
    if (!scenario && !activeRun) {
        loadScenario();
    }

    const phases = scenario?.phases || [];

    const handleStart = () => {
        // Mock operator ID
        startProductionRun('current-user-id');
    };

    return (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold text-white">Production Run</h3>
                    {activeRun ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/50">ACTIVE</span>
                            <span className="text-xs font-mono text-slate-400">{activeRun.run_code}</span>
                        </div>
                    ) : (
                        <span className="text-xs bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded border border-slate-500/50">IDLE</span>
                    )}
                </div>

                {activeRun ? (
                    <button
                        onClick={endProductionRun}
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                    >
                        End Run
                    </button>
                ) : (
                    <button
                        onClick={handleStart}
                        className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/50 px-4 py-2 rounded-lg text-sm font-semibold transition-all animate-pulse-glow"
                    >
                        Start Production
                    </button>
                )}
            </div>

            {/* Stepper */}
            <div className="mt-6 relative">
                <div className="absolute top-[14px] left-0 w-full h-0.5 bg-slate-700 -z-10" />
                <div className="flex justify-between items-start overflow-x-auto pb-2 gap-4">
                    {phases.map((phase: any, index: number) => {
                        const stepNumber = index + 1;
                        const isActive = currentPhase === stepNumber;
                        const isCompleted = currentPhase > stepNumber;
                        const isPending = currentPhase < stepNumber;

                        return (
                            <button
                                key={phase.id}
                                disabled={!activeRun}
                                onClick={() => activeRun && setPhase(stepNumber)}
                                className={`group flex flex-col items-center min-w-[80px] transition-all ${!activeRun ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <div className={`
                                     w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all z-10
                                     ${isActive ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)] scale-110' : ''}
                                     ${isCompleted ? 'bg-slate-700 border-cyan-900 text-cyan-500' : ''}
                                     ${isPending ? 'bg-slate-800 border-slate-600 text-slate-500' : ''}
                                 `}>
                                    {stepNumber}
                                </div>
                                <div className="mt-2 text-center">
                                    <div className={`text-xs font-semibold ${isActive ? 'text-cyan-400' : 'text-slate-400'}`}>
                                        {phase.name.en}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Advance Button (only if active run and not at end) */}
            {activeRun && currentPhase < phases.length && (
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={advancePhase}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                    >
                        Next Phase
                        <span>→</span>
                    </button>
                </div>
            )}
        </div>
    );
}
