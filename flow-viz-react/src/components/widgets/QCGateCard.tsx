import { QCGateSection } from '../../types/presentation'

export function QCGateCard({ section }: { section: QCGateSection }) {
    const gate = section.qcGate

    return (
        <div className="bg-[#0f172a] border-2 border-[var(--color-accent-blue)] rounded-xl overflow-hidden my-6 shadow-2xl relative">
            {/* Header */}
            <div className="p-6 pb-4 flex justify-between items-start border-b border-[rgba(59,130,246,0.3)] bg-[rgba(30,41,59,0.5)]">
                <div>
                    <h3 className="text-2xl font-bold text-[#10b981] mb-2">{gate.id}: {gate.title}</h3>
                    <p className="text-[var(--color-text-secondary)] italic">{gate.goal}</p>
                </div>
                <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse shadow-lg">
                    {gate.badge}
                </span>
            </div>

            {/* Checklist */}
            <div className="p-6 bg-[rgba(15,23,42,0.3)]">
                <h4 className="text-[#10b981] font-bold mb-4 flex items-center gap-2">
                    <span className="bg-[#10b981] text-[#0f172a] rounded w-5 h-5 flex items-center justify-center text-xs">✓</span>
                    Ellenőrzési checklist:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {gate.checklist.map((item, i) => (
                        <div key={i} className="flex items-start gap-3 text-[var(--color-text-secondary)]">
                            <span className="text-xl">{item.icon}</span>
                            <span className="text-sm">{item.text}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="p-4 bg-[rgba(37,99,235,0.1)]">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-white">
                            {gate.table.headers.map((h, i) => (
                                <th key={i} className="py-2 px-3 font-bold">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-[rgba(15,23,42,0.6)] rounded-lg overflow-hidden">
                        {gate.table.rows.map((row, i) => (
                            <tr key={i} className="border-b border-[rgba(255,255,255,0.05)] last:border-0 hover:bg-[rgba(255,255,255,0.05)] transition-colors">
                                <td className="py-3 px-3">
                                    <span className="bg-[#f59e0b] text-black px-2 py-0.5 rounded text-xs font-bold shadow-sm">
                                        {row.prev}
                                    </span>
                                </td>
                                <td className="py-3 px-3 relative">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.resultType === 'success' ? 'text-[#10b981] bg-[rgba(16,185,129,0.1)]' :
                                        row.resultType === 'warning' ? 'text-[#f59e0b]' :
                                            'text-red-500 bg-[rgba(239,68,68,0.1)]'
                                        }`}>
                                        {row.result}
                                    </span>
                                </td>
                                <td className="py-3 px-3">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold text-white shadow-sm ${row.resultType === 'success' ? 'bg-[#10b981]' :
                                        row.resultType === 'warning' ? 'bg-[#f59e0b]' :
                                            'bg-red-600'
                                        }`}>
                                        {row.next}
                                    </span>
                                </td>
                                <td className="py-3 px-3 text-[var(--color-text-secondary)]">
                                    {row.action}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
