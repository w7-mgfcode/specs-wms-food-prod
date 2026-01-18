import { StatusGridSection } from '../../types/presentation'

export function StatusGrid({ section }: { section: StatusGridSection }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
            {section.gridItems.map((item, i) => (
                <div key={i} className="bg-[#1e293b] p-4 rounded-lg border border-[var(--shell-border)] shadow-lg text-center group hover:border-[var(--color-accent-blue)] transition-all">
                    <div className="text-3xl font-bold text-white mb-2 group-hover:scale-110 transition-transform">{item.title}</div>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                        {item.items.map((sub, j) => (
                            <div key={j}><span className="text-[var(--color-accent-blue)] font-bold">{sub.key}</span> {sub.value}</div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
