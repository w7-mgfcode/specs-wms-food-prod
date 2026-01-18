import { KVPairsSection } from '../../types/presentation'

export function KVPairs({ section }: { section: KVPairsSection }) {
    return (
        <div className="my-4 bg-[rgba(15,23,42,0.5)] rounded-lg p-4">
            {section.title && <h4 className="text-[var(--color-accent-blue)] font-semibold mb-3" dangerouslySetInnerHTML={{ __html: section.title }} />}
            {section.kvPairs.map((kv, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-[var(--shell-border)] last:border-0">
                    <span className="text-[var(--color-text-muted)] font-semibold">{kv.key}:</span>
                    <span className="font-mono text-[var(--color-text-primary)]">{kv.value}</span>
                </div>
            ))}
        </div>
    )
}
