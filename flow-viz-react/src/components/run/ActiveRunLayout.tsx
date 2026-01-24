/**
 * Active Run Layout
 *
 * Container for active run with tab navigation.
 * Phase 8.5: Route Consolidation & UI Migration
 */

import { useEffect } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useUIStore } from '../../stores/useUIStore';
import { useRunStore } from '../../stores/useRunStore';

const TABS = [
    { path: '', label: { hu: 'Vezérlés', en: 'Controls' } },
    { path: 'buffers', label: { hu: 'Pufferek', en: 'Buffers' } },
    { path: 'lots', label: { hu: 'Lotok', en: 'Lots' } },
    { path: 'qc', label: { hu: 'Minőség', en: 'QC' } },
];

const STEP_NAMES = [
    { hu: 'Kezdés', en: 'Start' },
    { hu: 'Átvétel', en: 'Receipt' },
    { hu: 'Kicsontolás', en: 'Deboning' },
    { hu: 'Bulk Puffer', en: 'Bulk Buffer' },
    { hu: 'Keverés', en: 'Mixing' },
    { hu: 'Nyársalás', en: 'Skewering' },
    { hu: 'SKU Bontás', en: 'SKU Split' },
    { hu: 'Fagyasztás', en: 'Freezing' },
    { hu: 'Csomagolás', en: 'Packaging' },
    { hu: 'Raklapozás', en: 'Palletizing' },
    { hu: 'Szállítás', en: 'Shipment' },
];

const STATUS_STYLES: Record<string, string> = {
    RUNNING: 'bg-green-500/20 text-green-400',
    IDLE: 'bg-gray-500/20 text-gray-400',
    HOLD: 'bg-yellow-500/20 text-yellow-400',
    COMPLETED: 'bg-blue-500/20 text-blue-400',
    ABORTED: 'bg-red-500/20 text-red-400',
};

export function ActiveRunLayout() {
    const { runId } = useParams<{ runId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { language } = useUIStore();

    const {
        currentRun,
        isLoading,
        isAdvancing,
        error,
        loadRun,
        loadSteps,
        loadBuffers,
        doStartRun,
        doAdvanceStep,
        doHoldRun,
    } = useRunStore();

    useEffect(() => {
        if (runId) {
            loadRun(runId);
            loadSteps(runId);
            loadBuffers(runId);
        }
    }, [runId, loadRun, loadSteps, loadBuffers]);

    // Determine current tab from URL
    const pathParts = location.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    const currentTab = TABS.some(t => t.path === lastPart) ? lastPart : '';

    const handleTabClick = (path: string) => {
        navigate(`/command/run/${runId}${path ? `/${path}` : ''}`);
    };

    const handleBack = () => {
        navigate('/command');
    };

    const handleStart = () => {
        if (runId) doStartRun(runId);
    };

    const handleAdvance = () => {
        if (runId) doAdvanceStep(runId);
    };

    const handleHold = () => {
        if (runId) {
            const reason = prompt(
                language === 'hu' ? 'Indoklás (min 10 karakter):' : 'Reason (min 10 chars):'
            );
            if (reason && reason.length >= 10) {
                doHoldRun(runId, reason);
            }
        }
    };

    if (isLoading || !currentRun) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="bg-[rgba(26,31,58,0.95)] border-b border-white/10">
                <div className="flex items-center justify-between px-6 py-4">
                    {/* Back + Run Info */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleBack}
                            className="p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                        >
                            <span className="text-xl">&larr;</span>
                        </button>
                        <div>
                            <h1 className="text-lg font-mono text-white">
                                {currentRun.run_code}
                            </h1>
                            <p className="text-sm text-gray-400">
                                {STEP_NAMES[currentRun.current_step_index]?.[language] ||
                                    `Step ${currentRun.current_step_index}`}
                            </p>
                        </div>
                    </div>

                    {/* Status + Actions */}
                    <div className="flex items-center gap-4">
                        {/* Status Badge */}
                        <span
                            className={`px-3 py-1 rounded text-sm font-medium ${STATUS_STYLES[currentRun.status] || 'bg-gray-500/20 text-gray-400'}`}
                        >
                            {currentRun.status}
                        </span>

                        {/* Action Buttons */}
                        {currentRun.status === 'IDLE' && (
                            <button
                                onClick={handleStart}
                                disabled={isAdvancing}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors"
                            >
                                <span>&#9654;</span>
                                {language === 'hu' ? 'Indítás' : 'Start'}
                            </button>
                        )}

                        {currentRun.status === 'RUNNING' && (
                            <>
                                <button
                                    onClick={handleAdvance}
                                    disabled={isAdvancing || currentRun.current_step_index >= 10}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
                                >
                                    <span>&#9193;</span>
                                    {language === 'hu' ? 'Tovább' : 'Advance'}
                                </button>
                                <button
                                    onClick={handleHold}
                                    disabled={isAdvancing}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-50 transition-colors"
                                >
                                    <span>&#10074;&#10074;</span>
                                    {language === 'hu' ? 'Felfüggesztés' : 'Hold'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Step Progress Bar */}
                <div className="px-6 pb-4">
                    <div className="flex items-center gap-1">
                        {Array.from({ length: 11 }, (_, i) => {
                            let bgClass = 'bg-gray-700';
                            if (i < currentRun.current_step_index) {
                                bgClass = 'bg-green-500';
                            } else if (i === currentRun.current_step_index) {
                                bgClass = 'bg-blue-500';
                            }
                            return (
                                <div
                                    key={i}
                                    className={`flex-1 h-2 rounded-full transition-colors ${bgClass}`}
                                    title={STEP_NAMES[i]?.[language]}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-6">
                    {TABS.map((tab) => {
                        const isActive = currentTab === tab.path;
                        return (
                            <button
                                key={tab.path}
                                onClick={() => handleTabClick(tab.path)}
                                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                                    isActive
                                        ? 'bg-[rgba(255,255,255,0.1)] text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
                                }`}
                            >
                                {tab.label[language]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
                    <span className="text-red-400">&#9888;</span>
                    <span className="text-sm text-red-400">{error}</span>
                </div>
            )}

            {/* Tab Content */}
            <div className="flex-1 overflow-auto">
                <Outlet />
            </div>
        </div>
    );
}
