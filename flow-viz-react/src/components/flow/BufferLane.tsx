import { cn } from '../../lib/utils';
import { LotCard } from './LotCard';
import type { BufferConfig, FlowLot } from '../../types/flow';
import type { Language } from '../../types/scenario';

interface BufferLaneProps {
    buffer: BufferConfig;
    lots: FlowLot[];
    lang: Language;
    onLotClick?: (lot: FlowLot) => void;
    selectedLotId?: string | null;
    isInteractive?: boolean;
}

export function BufferLane({
    buffer,
    lots,
    lang,
    onLotClick,
    selectedLotId,
    isInteractive = true,
}: BufferLaneProps) {
    const bufferName = buffer.name[lang];
    const lotCount = lots.length;

    return (
        <div
            className={cn('glass-card p-4 rounded-xl')}
            style={{ borderLeft: `4px solid ${buffer.color}` }}
        >
            {/* Lane Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{bufferName}</h3>
                    <span className="text-[10px] bg-[rgba(255,255,255,0.1)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded">
                        {lotCount} {lang === 'hu' ? 'db' : 'items'}
                    </span>
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">{buffer.tempRange}</span>
            </div>

            {/* Lot Cards Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {lots.map((lot) => (
                    <LotCard
                        key={lot.id}
                        lot={lot}
                        lang={lang}
                        onClick={onLotClick ? () => onLotClick(lot) : undefined}
                        isSelected={selectedLotId === lot.id}
                        isInteractive={isInteractive}
                    />
                ))}
                {lots.length === 0 && (
                    <div className="col-span-full text-center text-xs text-[var(--color-text-secondary)] py-8">
                        {lang === 'hu' ? 'Nincs LOT ebben a bufferben' : 'No lots in this buffer'}
                    </div>
                )}
            </div>
        </div>
    );
}
