import { Thermometer } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getTempStatus, type TempStatus, type FlowLotType } from '../../types/flow';

interface TempBadgeProps {
    temperature: number;
    lotType: FlowLotType;
    showIcon?: boolean;
}

const statusStyles: Record<TempStatus, string> = {
    ok: 'bg-[var(--status-pass)] text-black',
    warning: 'bg-[var(--status-hold)] text-black',
    critical: 'bg-[var(--status-fail)] text-white',
};

export function TempBadge({ temperature, lotType, showIcon = true }: TempBadgeProps) {
    const status = getTempStatus(temperature, lotType);

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium',
                statusStyles[status]
            )}
            title={`Temperature: ${temperature}°C (${status})`}
        >
            {showIcon && <Thermometer className="w-3 h-3" />}
            {temperature.toFixed(1)}°C
        </span>
    );
}
