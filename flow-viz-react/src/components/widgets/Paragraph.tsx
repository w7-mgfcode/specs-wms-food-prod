import { ParagraphSection } from '../../types/presentation'

export function Paragraph({ section }: { section: ParagraphSection }) {
    return (
        <div className="text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
            {section.content.split('**').map((part, i) =>
                i % 2 === 1 ? <strong key={i} className="text-[var(--color-accent-cyan)]">{part}</strong> : part
            )}
        </div>
    )
}
