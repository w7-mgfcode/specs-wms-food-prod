/**
 * Run Buffers Tab
 *
 * Buffer inventory board for active run (formerly "First Flow").
 * Phase 8.5: Route Consolidation & UI Migration
 */

import { useUIStore } from '../../stores/useUIStore';
import { useRunStore } from '../../stores/useRunStore';

const BUFFER_COLORS: Record<string, string> = {
    LK: '#3b82f6', // blue
    MIX: '#8b5cf6', // violet
    SKW15: '#22c55e', // green
    SKW30: '#10b981', // emerald
    FRZ: '#06b6d4', // cyan
    PAL: '#f59e0b', // amber
};

export function RunBuffersTab() {
    const { language } = useUIStore();
    const { buffers } = useRunStore();

    if (buffers.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                {language === 'hu' ? 'Nincsenek pufferek' : 'No buffers available'}
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {buffers.map((bufferData) => {
                    const { buffer, items, total_quantity_kg } = bufferData;
                    const color = BUFFER_COLORS[buffer.buffer_type] || '#6b7280';
                    const capacityPercent =
                        (Number(total_quantity_kg) / Number(buffer.capacity_kg)) * 100;

                    let capacityBarColor = 'bg-green-500';
                    if (capacityPercent > 90) {
                        capacityBarColor = 'bg-red-500';
                    } else if (capacityPercent > 70) {
                        capacityBarColor = 'bg-yellow-500';
                    }

                    return (
                        <div
                            key={buffer.id}
                            className="rounded-xl overflow-hidden bg-[rgba(26,31,58,0.95)] border border-white/10"
                        >
                            {/* Header */}
                            <div
                                className="px-4 py-3 flex items-center justify-between"
                                style={{ backgroundColor: `${color}20` }}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-lg" style={{ color }}>
                                        &#128230;
                                    </span>
                                    <span className="font-semibold text-white">
                                        {buffer.buffer_code}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-400">{buffer.buffer_type}</span>
                            </div>

                            {/* Capacity Bar */}
                            <div className="px-4 py-2 border-b border-white/5">
                                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                                    <span>
                                        {Number(total_quantity_kg).toFixed(1)} /{' '}
                                        {Number(buffer.capacity_kg).toFixed(0)} kg
                                    </span>
                                    <span>{capacityPercent.toFixed(0)}%</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div
                                        className={`rounded-full h-2 transition-all ${capacityBarColor}`}
                                        style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* Temperature Range */}
                            <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2 text-xs text-gray-400">
                                <span>&#127777;</span>
                                <span>
                                    {Number(buffer.temp_min_c).toFixed(0)}°C -{' '}
                                    {Number(buffer.temp_max_c).toFixed(0)}°C
                                </span>
                            </div>

                            {/* Lot Cards */}
                            <div className="p-3 space-y-2 max-h-60 overflow-auto">
                                {items.length === 0 ? (
                                    <div className="text-center text-gray-500 text-sm py-4">
                                        {language === 'hu' ? 'Üres' : 'Empty'}
                                    </div>
                                ) : (
                                    items.map((item) => (
                                        <div
                                            key={item.id}
                                            className="p-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/5"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-mono text-white">
                                                    {item.lot_code}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {Number(item.quantity_kg).toFixed(1)} kg
                                                </span>
                                            </div>
                                            {item.temperature_c !== null && (
                                                <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
                                                    <span>&#127777;</span>
                                                    {Number(item.temperature_c).toFixed(1)}°C
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
