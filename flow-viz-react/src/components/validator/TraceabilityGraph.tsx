import { useState, useEffect } from 'react';
import { useProductionStore } from '../../stores/useProductionStore';
import { cn } from '../../lib/utils';
import type { Database } from '../../types/database.types';

type Lot = Database['public']['Tables']['lots']['Row'];
type TraceDirection = 'backward' | 'forward';

export function TraceabilityGraph() {
    const { lots, activeRun } = useProductionStore();
    const [direction, setDirection] = useState<TraceDirection>('backward');

    const [apiData, setApiData] = useState<{ central: Lot, parents: Lot[], children: Lot[] } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (import.meta.env.VITE_DB_MODE === 'postgres' && searchTerm) {
            fetch(`/api/traceability/${searchTerm}`)
                .then(res => res.json())
                .then(data => {
                    if (!data.error) setApiData(data);
                })
                .catch(console.error);
        }
    }, [searchTerm]);

    // Derived lots based on mode
    const displayLots = import.meta.env.VITE_DB_MODE === 'postgres' && apiData
        ? [apiData.central, ...apiData.parents, ...apiData.children]
        : Object.values(lots);

    // Sort lots by creation time
    const sortedLots = displayLots.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Build graph relationships based on direction (Simplified View for now)
    const relationships = sortedLots.map(lot => {
        // For Mock Mode: Use Metadata

        if (import.meta.env.VITE_DB_MODE === 'postgres' && apiData) {
            // Logic for API Data
            if (direction === 'backward') {
                if (lot.id === apiData.central.id) {
                    return { lot, related: apiData.parents, label: 'Ingredients (Parents)' };
                }
            } else {
                if (lot.id === apiData.central.id) {
                    return { lot, related: apiData.children, label: 'Products (Children)' };
                }
            }
            // For non-central lots in API mode, we don't show further relations in this simple view yet
            return { lot, related: [], label: '' };
        }

        // Mock Mode Fallback
        const parentIds = ((lot.metadata as any)?.parentLots || []).map((p: any) => p.lotId);

        if (direction === 'backward') {
            const parents = parentIds.map((id: string) => lots[id]).filter(Boolean);
            return { lot, related: parents, label: 'Ingredients (Parents)' };
        } else {
            const children = displayLots.filter(child => {
                const childParents = ((child.metadata as any)?.parentLots || []).map((p: any) => p.lotId);
                return childParents.includes(lot.id);
            });
            return { lot, related: children, label: 'Products (Children)' };
        }
    });

    // In Postgres mode, always show the UI with search capability
    const isPostgresMode = import.meta.env.VITE_DB_MODE === 'postgres';

    if (!activeRun && !isPostgresMode) {
        return <div className="p-8 text-center text-slate-500">No active run data to analyze.</div>;
    }

    if (sortedLots.length === 0 && !isPostgresMode) {
        return <div className="p-8 text-center text-slate-500">No LOTs registered yet.</div>;
    }

    return (
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700 h-full overflow-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <h3 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
                        <span>🔗</span> Genealogy Graph
                    </h3>
                    {import.meta.env.VITE_DB_MODE === 'postgres' && (
                        <input
                            type="text"
                            placeholder="Search Lot Code..."
                            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                            onBlur={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && setSearchTerm(e.currentTarget.value)}
                        />
                    )}
                </div>

                {/* Direction Toggle */}
                <div className="flex border border-slate-600 rounded-lg overflow-hidden">
                    <button
                        onClick={() => setDirection('backward')}
                        className={cn(
                            "px-4 py-2 text-sm font-semibold transition-all",
                            direction === 'backward'
                                ? 'bg-cyan-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        )}
                    >
                        ← 1-Back
                    </button>
                    <button
                        onClick={() => setDirection('forward')}
                        className={cn(
                            "px-4 py-2 text-sm font-semibold transition-all",
                            direction === 'forward'
                                ? 'bg-cyan-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        )}
                    >
                        1-Forward →
                    </button>
                </div>
            </div>

            <div className="space-y-8 relative">
                {relationships.map(({ lot, related, label }) => (
                    <div key={lot.id} className="relative pl-8">
                        {related.length > 0 && (
                            <div className="absolute left-[15px] top-[-20px] bottom-[50%] w-0.5 bg-slate-600" />
                        )}

                        <div className="flex items-start gap-4">
                            <div className="absolute left-0 top-3 w-8 h-8 rounded-full bg-slate-800 border-2 border-cyan-500/50 flex items-center justify-center z-10">
                                <span className="text-xs">📦</span>
                            </div>

                            <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700 min-w-[300px] hover:border-cyan-500/50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="font-mono text-cyan-300 font-bold">{lot.lot_code}</div>
                                    <div className="text-xs bg-black/30 px-2 py-0.5 rounded text-slate-400">{lot.lot_type}</div>
                                </div>

                                <div className="text-sm text-slate-400 grid grid-cols-2 gap-2 mb-2">
                                    <div>Weight: <span className="text-white">{lot.weight_kg}kg</span></div>
                                    <div>Temp: <span className={cn(
                                        "font-bold",
                                        (lot.temperature_c || 0) > 4 ? "text-red-400" : "text-emerald-400"
                                    )}>{lot.temperature_c}°C</span></div>
                                </div>

                                {related.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                                        <div className="text-xs text-slate-500 uppercase mb-1">{label}</div>
                                        <div className="space-y-1">
                                            {related.map((item: Lot) => (
                                                <div key={item.id} className="text-xs flex items-center gap-2 text-slate-300 bg-slate-900/50 px-2 py-1 rounded border border-slate-700 border-dashed">
                                                    <span className="text-slate-500">{direction === 'backward' ? '↳' : '→'}</span>
                                                    <span className="font-mono">{item.lot_code}</span>
                                                    <span className="text-slate-500">({item.lot_type})</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {relationships.length > 1 && (
                    <div className="absolute left-[15px] top-4 bottom-10 w-0.5 bg-slate-700 -z-10" />
                )}
            </div>
        </div>
    );
}
