import { useProductionStore } from '../../stores/useProductionStore';
import { useAuthStore } from '../../stores/useAuthStore';

export function ConfigPanel() {
    const { scenario, activeRun } = useProductionStore();
    const { user, role } = useAuthStore();

    const dbMode = import.meta.env.VITE_DB_MODE || 'mock';
    const isMock = import.meta.env.VITE_USE_MOCK === 'true';

    return (
        <div className="space-y-6">
            {/* System Info */}
            <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-cyan-400 font-bold mb-3 flex items-center gap-2">
                    <span>⚙️</span> System Configuration
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-slate-400">Database Mode:</div>
                    <div className={dbMode === 'postgres' ? 'text-emerald-400 font-mono' : 'text-yellow-400 font-mono'}>
                        {dbMode.toUpperCase()}
                    </div>
                    <div className="text-slate-400">Mock Data:</div>
                    <div className={isMock ? 'text-yellow-400' : 'text-emerald-400'}>
                        {isMock ? 'Enabled' : 'Disabled'}
                    </div>
                    <div className="text-slate-400">API Endpoint:</div>
                    <div className="text-white font-mono text-xs">/api/*</div>
                </div>
            </section>

            {/* User Profile */}
            <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-purple-400 font-bold mb-3 flex items-center gap-2">
                    <span>👤</span> Current User
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-slate-400">Email:</div>
                    <div className="text-white font-mono">{user?.email || 'N/A'}</div>
                    <div className="text-slate-400">Role:</div>
                    <div className="text-cyan-300 font-bold">{role || 'N/A'}</div>
                    <div className="text-slate-400">Full Name:</div>
                    <div className="text-white">{user?.full_name || 'N/A'}</div>
                </div>
            </section>

            {/* Active Scenario */}
            <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-yellow-400 font-bold mb-3 flex items-center gap-2">
                    <span>📋</span> Active Scenario
                </h4>
                {scenario ? (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="text-slate-400">Name:</div>
                        <div className="text-white">{scenario.meta?.title?.en || 'Unnamed'}</div>
                        <div className="text-slate-400">Version:</div>
                        <div className="text-white font-mono">{scenario.meta?.version || 'N/A'}</div>
                        <div className="text-slate-400">Phases:</div>
                        <div className="text-white">{scenario.phases?.length || 0}</div>
                        <div className="text-slate-400">Streams:</div>
                        <div className="text-white">{Object.keys(scenario.streams || {}).length}</div>
                        <div className="text-slate-400">QC Gates:</div>
                        <div className="text-white">{scenario.config?.qcGates?.length || 0}</div>
                    </div>
                ) : (
                    <div className="text-slate-500 italic">No scenario loaded</div>
                )}
            </section>

            {/* Active Run */}
            <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-emerald-400 font-bold mb-3 flex items-center gap-2">
                    <span>🏭</span> Active Production Run
                </h4>
                {activeRun ? (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="text-slate-400">Run Code:</div>
                        <div className="text-white font-mono">{activeRun.run_code}</div>
                        <div className="text-slate-400">Status:</div>
                        <div className={activeRun.status === 'ACTIVE' ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                            {activeRun.status}
                        </div>
                        <div className="text-slate-400">Started:</div>
                        <div className="text-white text-xs">{new Date(activeRun.started_at).toLocaleString()}</div>
                        <div className="text-slate-400">Target (kg):</div>
                        <div className="text-white">{activeRun.daily_target_kg || 'N/A'}</div>
                    </div>
                ) : (
                    <div className="text-slate-500 italic">No active run</div>
                )}
            </section>

            {/* Environment */}
            <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-red-400 font-bold mb-3 flex items-center gap-2">
                    <span>🔧</span> Environment
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-slate-400">Build Mode:</div>
                    <div className="text-white font-mono">{import.meta.env.MODE}</div>
                    <div className="text-slate-400">Base URL:</div>
                    <div className="text-white font-mono text-xs">{import.meta.env.BASE_URL}</div>
                </div>
            </section>
        </div>
    );
}
