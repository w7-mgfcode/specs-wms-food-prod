interface PhaseProgressProps {
    phases: { id: number; name: string }[]
    currentPhase: number
    onPhaseClick?: (phaseId: number) => void
}

export function PhaseProgress({ phases, currentPhase, onPhaseClick }: PhaseProgressProps) {
    return (
        <div className="flex gap-1">
            {phases.map((phase) => {
                const isCompleted = phase.id < currentPhase
                const isActive = phase.id === currentPhase

                return (
                    <div
                        key={phase.id}
                        onClick={() => onPhaseClick?.(phase.id)}
                        className={`
              flex-1 h-2 rounded transition-all duration-300 cursor-pointer
              ${isCompleted ? 'bg-[var(--status-pass)]' : ''}
              ${isActive ? 'bg-[var(--color-accent-cyan)] h-3' : ''}
              ${!isCompleted && !isActive ? 'bg-[rgba(74,158,255,0.2)]' : ''}
            `}
                        title={phase.name}
                    />
                )
            })}
        </div>
    )
}
