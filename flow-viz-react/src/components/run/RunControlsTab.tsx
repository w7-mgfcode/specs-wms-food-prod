/**
 * Run Controls Tab
 *
 * Default controls view for active run.
 * Phase 8.5: Route Consolidation & UI Migration
 */

import { useUIStore } from '../../stores/useUIStore';
import { useRunStore } from '../../stores/useRunStore';

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

const STEP_STATUS_STYLES: Record<string, string> = {
    PENDING: 'bg-gray-700 text-gray-400',
    IN_PROGRESS: 'bg-blue-500/20 text-blue-400 border-blue-500',
    COMPLETED: 'bg-green-500/20 text-green-400',
    SKIPPED: 'bg-gray-600 text-gray-500',
};

export function RunControlsTab() {
    const { language } = useUIStore();
    const { currentRun, steps } = useRunStore();

    if (!currentRun) {
        return null;
    }

    return (
        <div className="p-6">
            {/* Run Summary */}
            <div className="mb-6 p-4 rounded-lg bg-[rgba(26,31,58,0.95)] border border-white/10">
                <h2 className="text-lg font-semibold text-white mb-4">
                    {language === 'hu' ? 'Futtatás összesítő' : 'Run Summary'}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-xs text-gray-400">
                            {language === 'hu' ? 'Kód' : 'Code'}
                        </p>
                        <p className="text-sm font-mono text-white">{currentRun.run_code}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">
                            {language === 'hu' ? 'Státusz' : 'Status'}
                        </p>
                        <p className="text-sm text-white">{currentRun.status}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">
                            {language === 'hu' ? 'Aktuális lépés' : 'Current Step'}
                        </p>
                        <p className="text-sm text-white">
                            {currentRun.current_step_index} -{' '}
                            {STEP_NAMES[currentRun.current_step_index]?.[language]}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">
                            {language === 'hu' ? 'Indítva' : 'Started'}
                        </p>
                        <p className="text-sm text-white">
                            {currentRun.started_at
                                ? new Date(currentRun.started_at).toLocaleString()
                                : '-'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Step Timeline */}
            <div className="p-4 rounded-lg bg-[rgba(26,31,58,0.95)] border border-white/10">
                <h2 className="text-lg font-semibold text-white mb-4">
                    {language === 'hu' ? 'Lépések' : 'Steps'}
                </h2>
                <div className="space-y-2">
                    {STEP_NAMES.map((step, index) => {
                        const stepData = steps.find((s) => s.step_index === index);
                        const status = stepData?.status || 'PENDING';
                        const isCurrent = index === currentRun.current_step_index;

                        return (
                            <div
                                key={index}
                                className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                                    isCurrent ? 'border border-blue-500' : ''
                                } ${STEP_STATUS_STYLES[status]}`}
                            >
                                <span className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-sm font-medium">
                                    {index}
                                </span>
                                <div className="flex-1">
                                    <p className="text-sm font-medium">{step[language]}</p>
                                    {stepData?.started_at && (
                                        <p className="text-xs opacity-70">
                                            {new Date(stepData.started_at).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                                <span className="text-xs uppercase">{status}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
