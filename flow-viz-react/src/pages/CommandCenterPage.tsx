/**
 * Command Center Page
 *
 * Main operator interface for managing production runs.
 * Phase 8.5: Route Consolidation & UI Migration
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../stores/useUIStore';
import { listRuns, ProductionRun, RunStatus } from '../lib/api/runs';

const STATUS_COLORS: Record<RunStatus, string> = {
    IDLE: 'bg-gray-500',
    RUNNING: 'bg-green-500',
    HOLD: 'bg-yellow-500',
    COMPLETED: 'bg-blue-500',
    ABORTED: 'bg-red-500',
    ARCHIVED: 'bg-gray-400',
};

const STATUS_LABELS: Record<RunStatus, { hu: string; en: string }> = {
    IDLE: { hu: 'Várakozik', en: 'Idle' },
    RUNNING: { hu: 'Fut', en: 'Running' },
    HOLD: { hu: 'Felfüggesztve', en: 'On Hold' },
    COMPLETED: { hu: 'Befejezve', en: 'Completed' },
    ABORTED: { hu: 'Megszakítva', en: 'Aborted' },
    ARCHIVED: { hu: 'Archivált', en: 'Archived' },
};

export function CommandCenterPage() {
    const navigate = useNavigate();
    const { language } = useUIStore();

    const [runs, setRuns] = useState<ProductionRun[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('');

    useEffect(() => {
        async function loadRuns() {
            try {
                setIsLoading(true);
                const data = await listRuns(statusFilter || undefined);
                setRuns(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load runs');
            } finally {
                setIsLoading(false);
            }
        }
        loadRuns();
    }, [statusFilter]);

    const handleOpenRun = (runId: string) => {
        navigate(`/command/run/${runId}`);
    };

    const handleCreateRun = () => {
        navigate('/command/new');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[rgba(26,31,58,0.95)] border-b border-white/10">
                <div>
                    <h1 className="text-xl font-semibold text-white">
                        {language === 'hu' ? 'Parancsközpont' : 'Command Center'}
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        {language === 'hu'
                            ? 'Gyártási futtatások kezelése'
                            : 'Manage production runs'}
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-white text-sm"
                    >
                        <option value="">{language === 'hu' ? 'Összes' : 'All'}</option>
                        <option value="IDLE">{language === 'hu' ? 'Várakozik' : 'Idle'}</option>
                        <option value="RUNNING">{language === 'hu' ? 'Fut' : 'Running'}</option>
                        <option value="HOLD">{language === 'hu' ? 'Felfüggesztve' : 'On Hold'}</option>
                        <option value="COMPLETED">{language === 'hu' ? 'Befejezve' : 'Completed'}</option>
                    </select>

                    {/* Create Button */}
                    <button
                        onClick={handleCreateRun}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                        <span className="text-lg">+</span>
                        {language === 'hu' ? 'Új futtatás' : 'New Run'}
                    </button>
                </div>
            </div>

            {/* Run List */}
            <div className="flex-1 overflow-auto p-6">
                {error ? (
                    <div className="text-red-400 text-center">{error}</div>
                ) : runs.length === 0 ? (
                    <div className="text-gray-400 text-center">
                        {language === 'hu' ? 'Nincsenek futtatások' : 'No runs found'}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {runs.map((run) => (
                            <div
                                key={run.id}
                                onClick={() => handleOpenRun(run.id)}
                                className="p-4 rounded-lg cursor-pointer bg-[rgba(26,31,58,0.95)] border border-white/10 hover:border-white/20 transition-all"
                            >
                                {/* Run Code */}
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-mono text-white">
                                        {run.run_code}
                                    </h3>
                                    <span
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-white ${STATUS_COLORS[run.status]}`}
                                    >
                                        {STATUS_LABELS[run.status][language]}
                                    </span>
                                </div>

                                {/* Step Progress */}
                                <div className="mt-3">
                                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                                        <span>
                                            {language === 'hu' ? 'Lépés' : 'Step'} {run.current_step_index}/10
                                        </span>
                                        <span>{Math.round((run.current_step_index / 10) * 100)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2">
                                        <div
                                            className="bg-blue-500 rounded-full h-2 transition-all"
                                            style={{ width: `${(run.current_step_index / 10) * 100}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Timestamps */}
                                <div className="mt-3 text-[10px] text-gray-500">
                                    {run.started_at && (
                                        <div>
                                            {language === 'hu' ? 'Indítva:' : 'Started:'}{' '}
                                            {new Date(run.started_at).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
