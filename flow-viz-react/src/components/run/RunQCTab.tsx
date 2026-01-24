/**
 * Run QC Tab
 *
 * QC decisions for active run.
 * Phase 8.5: Route Consolidation & UI Migration
 */

import { useUIStore } from '../../stores/useUIStore';

export function RunQCTab() {
    const { language } = useUIStore();

    return (
        <div className="p-6">
            <div className="flex items-center justify-center h-64 rounded-lg bg-[rgba(26,31,58,0.95)] border border-white/10">
                <div className="text-center">
                    <p className="text-gray-400">
                        {language === 'hu'
                            ? 'Minőségellenőrzés hamarosan...'
                            : 'Quality control coming soon...'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                        {language === 'hu'
                            ? 'QC döntések a futtatáshoz'
                            : 'QC decisions for this run'}
                    </p>
                </div>
            </div>
        </div>
    );
}
