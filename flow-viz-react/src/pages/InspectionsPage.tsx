/**
 * Inspections Page
 *
 * QC inspection log with filtering.
 * Phase 8.5: Route Consolidation & UI Migration
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../stores/useUIStore';
import { listInspections, QCInspection, InspectionFilters } from '../lib/api/qc';

const DECISION_STYLES: Record<string, string> = {
    PASS: 'bg-green-500/20 text-green-400',
    HOLD: 'bg-yellow-500/20 text-yellow-400',
    FAIL: 'bg-red-500/20 text-red-400',
};

export function InspectionsPage() {
    const navigate = useNavigate();
    const { language } = useUIStore();

    const [inspections, setInspections] = useState<QCInspection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<InspectionFilters>({});

    useEffect(() => {
        const fetchInspections = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await listInspections(filters);
                setInspections(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load inspections');
            } finally {
                setIsLoading(false);
            }
        };
        fetchInspections();
    }, [filters]);

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 bg-[rgba(26,31,58,0.95)] border-b border-white/10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/validator')}
                        className="p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                    >
                        <span className="text-xl">&larr;</span>
                    </button>
                    <div>
                        <h1 className="text-xl font-semibold text-white">
                            {language === 'hu' ? 'Ellenőrzések' : 'Inspections'}
                        </h1>
                        <p className="text-sm text-gray-400 mt-1">
                            {language === 'hu' ? 'QC döntések listája' : 'QC decision log'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="px-6 py-4 bg-[rgba(26,31,58,0.6)] border-b border-white/5">
                <div className="flex items-center gap-4">
                    <select
                        value={filters.decision || ''}
                        onChange={(e) =>
                            setFilters((f) => ({
                                ...f,
                                decision: e.target.value || undefined,
                            }))
                        }
                        className="px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-white"
                    >
                        <option value="">{language === 'hu' ? 'Összes döntés' : 'All decisions'}</option>
                        <option value="PASS">PASS</option>
                        <option value="HOLD">HOLD</option>
                        <option value="FAIL">FAIL</option>
                    </select>
                    <input
                        type="text"
                        placeholder={language === 'hu' ? 'Lot ID szűrés...' : 'Filter by Lot ID...'}
                        value={filters.lot_id || ''}
                        onChange={(e) =>
                            setFilters((f) => ({
                                ...f,
                                lot_id: e.target.value || undefined,
                            }))
                        }
                        className="flex-1 px-4 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : error ? (
                    <div className="text-red-400 text-center">{error}</div>
                ) : inspections.length === 0 ? (
                    <div className="text-gray-400 text-center">
                        {language === 'hu' ? 'Nincsenek ellenőrzések' : 'No inspections found'}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {inspections.map((inspection) => (
                            <div
                                key={inspection.id}
                                className="p-4 rounded-lg bg-[rgba(26,31,58,0.95)] border border-white/10"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span
                                            className={`px-2 py-1 rounded text-xs font-medium ${DECISION_STYLES[inspection.decision]}`}
                                        >
                                            {inspection.decision}
                                        </span>
                                        <span className="font-mono text-white text-sm">
                                            {inspection.lot_id.slice(0, 8)}...
                                        </span>
                                        {inspection.is_ccp && (
                                            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs">
                                                CCP
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {new Date(inspection.inspected_at).toLocaleString()}
                                    </span>
                                </div>
                                <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                                    <span>
                                        {language === 'hu' ? 'Típus:' : 'Type:'} {inspection.inspection_type}
                                    </span>
                                    <span>
                                        {language === 'hu' ? 'Lépés:' : 'Step:'} {inspection.step_index}
                                    </span>
                                </div>
                                {inspection.notes && (
                                    <div className="mt-2 text-sm text-gray-300 bg-white/5 p-2 rounded">
                                        {inspection.notes}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
