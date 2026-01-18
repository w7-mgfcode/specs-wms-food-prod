import { useProductionStore } from '../../stores/useProductionStore';

export function RunSummaryModal() {
    const { lastRunSummary, showRunSummary, dismissRunSummary, startProductionRun } = useProductionStore();

    if (!showRunSummary || !lastRunSummary) return null;

    const formatDuration = (minutes: number) => {
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    };

    const formatTime = (iso: string) => {
        return new Date(iso).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleStartNew = () => {
        dismissRunSummary();
        startProductionRun('current-user-id');
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 p-6 text-center">
                    <div className="text-4xl mb-2">✅</div>
                    <h2 className="text-2xl font-bold text-white">Production Run Complete</h2>
                    <p className="text-white/80 font-mono text-sm mt-1">{lastRunSummary.run_code}</p>
                </div>

                {/* Stats Grid */}
                <div className="p-6 space-y-4">
                    {/* Time Info */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="bg-slate-900/50 rounded-lg p-3">
                            <div className="text-xs text-slate-400 mb-1">Started</div>
                            <div className="text-white font-mono">{formatTime(lastRunSummary.started_at)}</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3">
                            <div className="text-xs text-slate-400 mb-1">Ended</div>
                            <div className="text-white font-mono">{formatTime(lastRunSummary.ended_at)}</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3">
                            <div className="text-xs text-slate-400 mb-1">Duration</div>
                            <div className="text-cyan-400 font-bold">{formatDuration(lastRunSummary.duration_minutes)}</div>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-white">{lastRunSummary.total_lots}</div>
                            <div className="text-sm text-slate-400">LOTs Registered</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-white">{lastRunSummary.phases_completed}</div>
                            <div className="text-sm text-slate-400">Phases Completed</div>
                        </div>
                    </div>

                    {/* QC Decisions */}
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="text-sm text-slate-400 mb-3 text-center">QC Decisions</div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-green-900/30 rounded-lg p-2 border border-green-500/30">
                                <div className="text-xl font-bold text-green-400">{lastRunSummary.qc_pass}</div>
                                <div className="text-xs text-green-400/70">PASS</div>
                            </div>
                            <div className="bg-yellow-900/30 rounded-lg p-2 border border-yellow-500/30">
                                <div className="text-xl font-bold text-yellow-400">{lastRunSummary.qc_hold}</div>
                                <div className="text-xs text-yellow-400/70">HOLD</div>
                            </div>
                            <div className="bg-red-900/30 rounded-lg p-2 border border-red-500/30">
                                <div className="text-xl font-bold text-red-400">{lastRunSummary.qc_fail}</div>
                                <div className="text-xs text-red-400/70">FAIL</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-6 pt-0 flex gap-3">
                    <button
                        onClick={dismissRunSummary}
                        className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleStartNew}
                        className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-semibold transition-colors shadow-lg"
                    >
                        Start New Run
                    </button>
                </div>
            </div>
        </div>
    );
}
