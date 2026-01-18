import { cn } from '../../lib/utils';
import type { FlowGate } from '../../types/flow';
import type { Language } from '../../types/scenario';

interface GateStepperProps {
    gates: FlowGate[];
    lang: Language;
    onGateClick?: (gateId: number | string) => void;
    isInteractive?: boolean;
}

export function GateStepper({ gates, lang, onGateClick, isInteractive = true }: GateStepperProps) {
    const handleGateClick = (gateId: number | string) => {
        if (isInteractive && onGateClick) {
            onGateClick(gateId);
        }
    };

    return (
        <div className="glass-card p-4 rounded-xl mb-6">
            <div className="flex items-center justify-between overflow-x-auto pb-2">
                {gates.map((gate, idx) => (
                    <div key={gate.id} className="flex items-center flex-shrink-0">
                        {/* Gate Node */}
                        <button
                            onClick={() => handleGateClick(gate.id)}
                            disabled={!isInteractive || !onGateClick}
                            className={cn(
                                'flex flex-col items-center min-w-[70px] px-1 sm:min-w-[80px] sm:px-2',
                                'focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--color-bg-dark)] rounded-lg',
                                isInteractive && onGateClick
                                    ? 'cursor-pointer hover:opacity-80'
                                    : 'cursor-default'
                            )}
                            aria-label={`Gate ${gate.id}: ${gate.name[lang]}`}
                            aria-current={gate.isActive ? 'step' : undefined}
                        >
                            {/* Circle */}
                            <div
                                className={cn(
                                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                                    'border-2 transition-all duration-300',
                                    gate.isCompleted &&
                                        'bg-[var(--status-pass)] border-[var(--status-pass)] text-black',
                                    gate.isActive &&
                                        !gate.isCompleted &&
                                        'bg-[var(--status-processing)] border-[var(--status-processing)] text-white animate-pulse',
                                    !gate.isActive &&
                                        !gate.isCompleted &&
                                        'bg-transparent border-gray-500 text-gray-400'
                                )}
                            >
                                {gate.isCompleted ? '✓' : gate.id}
                            </div>

                            {/* Label */}
                            <span
                                className={cn(
                                    'text-[9px] sm:text-[10px] mt-1 text-center whitespace-nowrap max-w-[70px] truncate',
                                    gate.isActive
                                        ? 'text-white font-semibold'
                                        : 'text-[var(--color-text-secondary)]'
                                )}
                            >
                                {gate.name[lang]}
                            </span>
                        </button>

                        {/* Connector Line */}
                        {idx < gates.length - 1 && (
                            <div
                                className={cn(
                                    'h-0.5 w-4 sm:w-8 flex-shrink-0',
                                    gate.isCompleted ? 'bg-[var(--status-pass)]' : 'bg-gray-600'
                                )}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
