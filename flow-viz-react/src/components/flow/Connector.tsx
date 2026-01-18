interface ConnectorProps {
    isActive: boolean
    color: string
}

export function Connector({ isActive, color }: ConnectorProps) {
    return (
        <div
            className={`
        flex-shrink-0 w-[30px] h-[2px] relative
        ${isActive ? 'opacity-100 animate-flow' : 'opacity-30'}
      `}
            style={{
                background: `linear-gradient(90deg, transparent, ${color})`,
                color: color,
            }}
        >
            <span
                className="absolute -right-2 top-1/2 -translate-y-1/2 text-base"
                style={{ color }}
            >
                →
            </span>
        </div>
    )
}
