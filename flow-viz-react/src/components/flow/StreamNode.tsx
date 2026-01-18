import type { NodeStatus } from '../../types/scenario'

interface StreamNodeProps {
    title: string
    lotId?: string
    qcGate?: number | null
    status: NodeStatus
    isActive: boolean
    isCompleted: boolean
    streamColor: string
}

export function StreamNode({
    title,
    lotId,
    qcGate,
    status,
    isActive,
    isCompleted,
    streamColor,
}: StreamNodeProps) {
    const getStatusIcon = () => {
        switch (status) {
            case 'pass':
                return '✓'
            case 'processing':
                return '⟳'
            case 'pending':
            default:
                return '○'
        }
    }

    const getStatusClasses = () => {
        switch (status) {
            case 'pass':
                return 'bg-[var(--status-pass)] text-[var(--color-bg-dark)]'
            case 'processing':
                return 'bg-[var(--status-processing)] text-white animate-spin-slow'
            case 'pending':
            default:
                return 'bg-[var(--status-pending)] text-white'
        }
    }

    return (
        <div
            className={`
        relative bg-[rgba(26,31,58,0.8)] border-2 rounded-xl p-4 min-w-[140px]
        transition-all duration-300
        ${isActive ? 'scale-105 shadow-[0_0_30px] animate-pulse-glow opacity-100' : ''}
        ${isCompleted ? 'opacity-70' : ''}
        ${!isActive && !isCompleted ? 'opacity-40' : ''}
      `}
            style={{
                borderColor: streamColor,
                color: streamColor,
            }}
        >
            {/* Status Badge */}
            <div
                className={`
          absolute -top-2 -right-2 w-6 h-6 rounded-full 
          border-2 border-[var(--color-bg-dark)]
          flex items-center justify-center text-xs font-bold
          ${getStatusClasses()}
        `}
            >
                {getStatusIcon()}
            </div>

            {/* Content */}
            <div className="text-xs font-semibold uppercase mb-1 text-white">
                {title}
            </div>

            {qcGate && (
                <div className="text-[10px] text-[var(--color-accent-yellow)]">
                    QC #{qcGate}
                </div>
            )}

            {lotId && (
                <div className="font-mono text-[10px] text-[var(--color-text-secondary)]">
                    {lotId}
                </div>
            )}
        </div>
    )
}
