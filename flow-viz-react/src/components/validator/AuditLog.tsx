import { useProductionStore } from '../../stores/useProductionStore';

interface AuditEvent {
    id: string;
    timestamp: string;
    type: 'RUN' | 'LOT' | 'QC';
    action: string;
    details: string;
    user: string;
}

export function AuditLog() {
    const { activeRun, lots, qcDecisions } = useProductionStore();

    if (!activeRun) return <div className="p-4 text-slate-500">No active audit trail.</div>;

    // Aggregate Events
    const events: AuditEvent[] = [];

    // Helper for safe strings
    const safeStr = (val: string | null | undefined): string => val || '';

    // 1. Run Events
    events.push({
        id: activeRun.id,
        timestamp: safeStr(activeRun.started_at),
        type: 'RUN',
        action: 'STARTED',
        details: `Run ${activeRun.run_code} initiated`,
        user: safeStr(activeRun.operator_id)
    });

    if (activeRun.ended_at) {
        events.push({
            id: activeRun.id + '_end',
            timestamp: safeStr(activeRun.ended_at),
            type: 'RUN',
            action: 'COMPLETED',
            details: `Run ${activeRun.run_code} finalized`,
            user: safeStr(activeRun.operator_id)
        });
    }

    // 2. Lot Events
    Object.values(lots).forEach(lot => {
        if (lot.production_run_id === activeRun.id) {
            events.push({
                id: lot.id,
                timestamp: lot.created_at, // CreatedAt is usually non-null in DB default, but let's be safe if types say otherwise
                type: 'LOT',
                action: 'REGISTERED',
                details: `${lot.lot_code} (${lot.lot_type}) added to ${lot.phase_id ? 'Phase' : 'Stock'}`,
                user: safeStr(lot.operator_id) || 'System'
            });
        }
    });

    // 3. QC Events
    Object.values(qcDecisions).forEach(qc => {
        events.push({
            id: qc.id,
            timestamp: safeStr(qc.decided_at),
            type: 'QC',
            action: safeStr(qc.decision),
            details: `Decision for gate ${qc.qc_gate_id} on Lot`,
            user: safeStr(qc.operator_id) || 'System'
        });
    });

    // Sort by Time (Newest First)
    const sortedEvents = events.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Download CSV
    const downloadCSV = () => {
        const headers = ['ID', 'Time', 'Type', 'Action', 'Details', 'User'];
        const rows = sortedEvents.map(evt => [
            evt.id,
            new Date(evt.timestamp).toISOString(),
            evt.type,
            evt.action,
            `"${evt.details.replace(/"/g, '""')}"`, // Escape quotes
            evt.user
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `audit_log_${activeRun.run_code}_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-slate-900 rounded-lg border border-slate-700 h-full flex flex-col">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <span>📋</span> Audit Trail
                    </h3>
                    <button
                        onClick={downloadCSV}
                        className="text-xs bg-slate-700 hover:bg-slate-600 text-cyan-400 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                        title="Export to CSV"
                    >
                        <span>⬇️</span> CSV
                    </button>
                </div>
                <span className="text-xs font-mono text-slate-500">RUN: {activeRun.run_code}</span>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar p-2">
                <table className="w-full text-left text-sm">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-800/50 sticky top-0">
                        <tr>
                            <th className="px-3 py-2">Time</th>
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Action</th>
                            <th className="px-3 py-2">Details</th>
                            <th className="px-3 py-2">User</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {sortedEvents.map(evt => (
                            <tr key={evt.id} className="hover:bg-slate-800/30 transition-colors">
                                <td className="px-3 py-2 font-mono text-xs text-slate-400">
                                    {new Date(evt.timestamp).toLocaleTimeString()}
                                </td>
                                <td className="px-3 py-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded
                                        ${evt.type === 'RUN' ? 'bg-blue-500/20 text-blue-400' : ''}
                                        ${evt.type === 'LOT' ? 'bg-cyan-500/20 text-cyan-400' : ''}
                                        ${evt.type === 'QC' ? 'bg-purple-500/20 text-purple-400' : ''}
                                    `}>
                                        {evt.type}
                                    </span>
                                </td>
                                <td className="px-3 py-2 font-bold text-slate-300">
                                    {evt.action}
                                </td>
                                <td className="px-3 py-2 text-slate-400 truncate max-w-[200px]" title={evt.details}>
                                    {evt.details}
                                </td>
                                <td className="px-3 py-2 font-mono text-xs text-slate-500">
                                    {evt.user.slice(0, 8)}...
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {sortedEvents.length === 0 && (
                    <div className="p-8 text-center text-slate-600">No events recorded.</div>
                )}
            </div>
        </div>
    );
}
