import { ListSection } from '../../types/presentation'

export function SimpleList({ section }: { section: ListSection }) {
    return (
        <div className="my-4">
            {section.title && <h4 className="text-[var(--status-pass)] font-semibold mb-3">{section.title}</h4>}
            <ul className="space-y-2">
                {section.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[var(--color-text-secondary)]">
                        <span className="text-[var(--status-pass)]">•</span>
                        <span dangerouslySetInnerHTML={{ __html: item }} />
                    </li>
                ))}
            </ul>
        </div>
    )
}
