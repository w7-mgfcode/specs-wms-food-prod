import { memo } from 'react';
import { cn } from '../../lib/utils';
import { TempBadge } from './TempBadge';
import type { FlowLot } from '../../types/flow';
import type { Language } from '../../types/scenario';

interface LotCardProps {
    lot: FlowLot;
    lang: Language;
    onClick?: () => void;
    isSelected?: boolean;
    isInteractive?: boolean;
}

const statusColors: Record<string, string> = {
    pass: 'border-[var(--status-pass)]',
    processing: 'border-[var(--status-processing)]',
    pending: 'border-[var(--status-pending)]',
    hold: 'border-[var(--status-hold)]',
    fail: 'border-[var(--status-fail)]',
};

function LotCardComponent({ lot, lang, onClick, isSelected, isInteractive = true }: LotCardProps) {
    const description = lot.description[lang];
    const hasWeight = lot.weight_kg !== undefined;
    const hasQuantity = lot.quantity !== undefined;
    const hasTemp = lot.temperature_c !== undefined;

    return (
        <div
            className={cn(
                'bg-[rgba(26,31,58,0.8)] border-2 rounded-lg p-3',
                'transition-all duration-200',
                statusColors[lot.qcStatus] || 'border-gray-600',
                isInteractive && onClick && 'cursor-pointer hover:scale-[1.02] hover:shadow-lg',
                !isInteractive && 'cursor-default',
                isSelected && 'ring-2 ring-white ring-offset-2 ring-offset-[var(--color-bg-dark)]'
            )}
            onClick={isInteractive && onClick ? onClick : undefined}
            role={isInteractive && onClick ? 'button' : undefined}
            tabIndex={isInteractive && onClick ? 0 : undefined}
            onKeyDown={
                isInteractive && onClick
                    ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onClick();
                          }
                      }
                    : undefined
            }
        >
            {/* Lot Code */}
            <div className="font-mono text-[10px] text-[var(--color-text-secondary)] truncate">
                {lot.code}
            </div>

            {/* Description */}
            <div className="text-xs font-medium text-white mt-1 truncate">{description}</div>

            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
                {hasWeight && (
                    <span className="text-[10px] bg-[var(--color-accent-blue,#4a9eff)] text-white px-2 py-0.5 rounded">
                        {lot.weight_kg} kg
                    </span>
                )}
                {hasQuantity && (
                    <span className="text-[10px] bg-[var(--color-accent-purple,#9d4edd)] text-white px-2 py-0.5 rounded">
                        {lot.quantity} pcs
                    </span>
                )}
                {hasTemp && <TempBadge temperature={lot.temperature_c!} bufferType={lot.bufferId} />}
            </div>
        </div>
    );
}

// Memoize to prevent unnecessary re-renders when lots list changes
export const LotCard = memo(LotCardComponent);
