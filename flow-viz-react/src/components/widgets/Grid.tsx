import { GridSection } from '../../types/presentation'

export function Grid({ section }: { section: GridSection }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-4">
            {section.gridItems.map((item, i) => (
                <div key={i} className="bg-[rgba(15,23,42,0.5)] border-l-4 border-[var(--color-accent-blue)] p-4 rounded-lg">
                    <div className="text-2xl font-bold text-[var(--color-accent-blue)]">{item.title}</div>
                    <div className="text-sm text-[var(--color-text-muted)]">
                        {item.items.map((sub, j) => (
                            <div key={j}>{sub.key}: {sub.value}</div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
