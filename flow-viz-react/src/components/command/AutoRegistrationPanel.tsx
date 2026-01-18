import { useProductionStore } from '../../stores/useProductionStore';

export function AutoRegistrationPanel() {
    const {
        autoRegistrationEnabled,
        setAutoRegistrationEnabled,
        currentPhase,
        getPhaseConfig,
        generateAutoLot,
        autoLotLog,
        clearAutoLotLog,
        activeRun
    } = useProductionStore();

    const phaseConfig = getPhaseConfig(currentPhase);

    const handleGenerateLot = async () => {
        if (!activeRun) {
            alert('Start a production run first!');
            return;
        }
        await generateAutoLot(currentPhase);
    };

    // Format time ago
    const timeAgo = (date: Date) => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        return `${Math.floor(minutes / 60)}h ago`;
    };

    return (
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl border border-cyan-500/30 overflow-hidden">
            {/* Header with Toggle */}
            <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-cyan-900/20">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🤖</span>
                    <div>
                        <h4 className="font-bold text-cyan-400">AUTO-REGISTRATION</h4>
                        <p className="text-xs text-slate-400">Generate phase-appropriate LOT data automatically</p>
                    </div>
                </div>

                {/* Toggle Switch */}
                <button
                    onClick={() => setAutoRegistrationEnabled(!autoRegistrationEnabled)}
                    className={`relative w-14 h-7 rounded-full transition-all duration-300 ${autoRegistrationEnabled
                            ? 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]'
                            : 'bg-slate-700'
                        }`}
                >
                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${autoRegistrationEnabled ? 'translate-x-8' : 'translate-x-1'
                        }`} />
                    <span className="sr-only">{autoRegistrationEnabled ? 'Disable' : 'Enable'} auto-registration</span>
                </button>
            </div>

            <div className="p-4 space-y-4">
                {/* Current Phase Info */}
                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-slate-400">Current Phase:</div>
                        <div className="text-white font-bold">{currentPhase}. {phaseConfig?.description || 'N/A'}</div>

                        <div className="text-slate-400">Expected LOT Type:</div>
                        <div className={`font-mono font-bold ${phaseConfig ? 'text-cyan-400' : 'text-slate-500'}`}>
                            {phaseConfig?.lotType || 'No LOT'}
                        </div>

                        {phaseConfig && (
                            <>
                                <div className="text-slate-400">Weight Range:</div>
                                <div className="text-white">{phaseConfig.weightMin}–{phaseConfig.weightMax} kg</div>

                                <div className="text-slate-400">Temp Range:</div>
                                <div className="text-white">{phaseConfig.tempMin}°C to {phaseConfig.tempMax}°C</div>
                            </>
                        )}
                    </div>
                </div>

                {/* Generate Button */}
                <button
                    onClick={handleGenerateLot}
                    disabled={!activeRun || !phaseConfig}
                    className={`w-full py-3 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all ${activeRun && phaseConfig
                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg hover:shadow-cyan-500/30'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                >
                    <span className="text-xl">🎲</span>
                    GENERATE SAMPLE LOT
                </button>

                {/* Auto-registration status */}
                {autoRegistrationEnabled && (
                    <div className="flex items-center gap-2 text-xs text-cyan-400 bg-cyan-900/20 rounded-lg p-2 border border-cyan-500/30">
                        <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                        Auto-registration ON: LOTs will be generated when advancing phases
                    </div>
                )}

                {/* Recent Auto-Generated Log */}
                {autoLotLog.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h5 className="text-sm font-semibold text-slate-300">Recent Auto-Generated:</h5>
                            <button
                                onClick={clearAutoLotLog}
                                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                            >
                                Clear
                            </button>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                            {autoLotLog.map((entry) => (
                                <div
                                    key={entry.id}
                                    className="flex items-center justify-between text-xs bg-slate-900/50 rounded p-2 border border-slate-700"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${entry.lotType === 'RAW' ? 'bg-blue-900/50 text-blue-400' :
                                                entry.lotType === 'FRZ' ? 'bg-cyan-900/50 text-cyan-400' :
                                                    entry.lotType === 'FG' ? 'bg-green-900/50 text-green-400' :
                                                        'bg-purple-900/50 text-purple-400'
                                            }`}>
                                            {entry.lotType}
                                        </span>
                                        <span className="text-slate-300 font-mono">{entry.lotCode}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-500">
                                        <span>{entry.weight}kg</span>
                                        <span>{entry.temperature}°C</span>
                                        <span>{timeAgo(entry.timestamp)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
