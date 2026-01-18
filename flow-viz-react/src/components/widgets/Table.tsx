import { TableSection } from '../../types/presentation'

export function Table({ section }: { section: TableSection }) {
    return (
        <div className="overflow-x-auto my-4">
            <table className="w-full border-collapse bg-[rgba(15,23,42,0.5)] rounded-lg overflow-hidden">
                <thead>
                    <tr className="bg-[var(--color-accent-blue)]">
                        {section.columns.map((col, i) => (
                            <th key={i} className="p-3 text-left font-bold text-white">{col}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {section.rows.map((row, i) => (
                        <tr key={i} className="border-b border-[var(--shell-border)] hover:bg-[rgba(74,158,255,0.1)] transition-colors">
                            {row.map((cell, j) => (
                                <td key={j} className="p-3 text-[var(--color-text-secondary)]">
                                    <div dangerouslySetInnerHTML={{ __html: cell }} />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
