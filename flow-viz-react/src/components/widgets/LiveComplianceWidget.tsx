import { useProductionStore } from '../../stores/useProductionStore';

// Types
type RuleType = 'MANDATORY' | 'CCP' | 'AUDIT';

interface ValidationResult {
    id: string;
    title: string;
    type: RuleType;
    status: 'PASS' | 'FAIL' | 'WARNING';
    message: string;
}

export function LiveComplianceWidget() {
    const { activeRun, lots, qcDecisions } = useProductionStore();

    // LIVE VALIDATION LOGIC
    const results: ValidationResult[] = [];

    // 1. Mandatory: Check Daily Target
    if (activeRun) {
        // Mock calculation of active weight (sum of all lot weights)
        const totalWeight = Object.values(lots || {}).reduce((acc: number, lot: any) => acc + (lot.weight_kg || 0), 0);
        const target = activeRun.daily_target_kg || 1000;

        results.push({
            id: 'R1',
            title: 'Daily Production Target',
            type: 'AUDIT',
            status: totalWeight >= target ? 'PASS' : 'WARNING',
            message: `Current: ${totalWeight.toFixed(1)}kg / Target: ${target}kg`
        });
    } else {
        results.push({
            id: 'R1',
            title: 'Active Production Run',
            type: 'MANDATORY',
            status: 'FAIL',
            message: 'No active production run found.'
        });
    }

    // 2. CCP: Temperature Check
    // Scan all active lots for temp violations > 4C (Mock rule)
    const hotLots = Object.values(lots || {}).filter((l: any) => (l.temperature_c || 0) > 4);
    if (hotLots.length > 0) {
        results.push({
            id: 'R2',
            title: 'Cold Chain Integrity (<4°C)',
            type: 'CCP',
            status: 'FAIL',
            message: `${hotLots.length} LOTs exceeded temperature limit!`
        });
    } else {
        results.push({
            id: 'R2',
            title: 'Cold Chain Integrity (<4°C)',
            type: 'CCP',
            status: 'PASS',
            message: 'All registered temps within limits.'
        });
    }

    // 3. Mandatory: QC Checkpoints
    // Check if any "FAIL" decisions exist in the current run
    const failedDecisions = Object.values(qcDecisions || {}).filter((d: any) => d.decision === 'FAIL');
    if (failedDecisions.length > 0) {
        results.push({
            id: 'R3',
            title: 'QC Gate Clearance',
            type: 'MANDATORY',
            status: 'FAIL',
            message: `${failedDecisions.length} lots FAILED QC checks.`
        });
    } else {
        results.push({
            id: 'R3',
            title: 'QC Gate Clearance',
            type: 'MANDATORY',
            status: 'PASS',
            message: 'No critical failures recorded.'
        });
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 backdrop-blur-sm">
                <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
                    🛡️ Automated Compliance Checks
                </h2>
                <p className="text-sm text-slate-400">Real-time validation against EU 178/2002 & HACCP rules.</p>
            </div>

            {/* Results Grid */}
            <div className="grid gap-3">
                {results.map((res) => (
                    <div
                        key={res.id}
                        className={`p-4 rounded-lg border flex items-center gap-4 transition-all
                            ${res.status === 'PASS' ? 'bg-green-500/10 border-green-500/30' : ''}
                            ${res.status === 'WARNING' ? 'bg-yellow-500/10 border-yellow-500/30' : ''}
                            ${res.status === 'FAIL' ? 'bg-red-500/10 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : ''}
                        `}
                    >
                        <div className={`p-2 rounded-full font-bold text-lg w-10 h-10 flex items-center justify-center
                            ${res.status === 'PASS' ? 'bg-green-500/20 text-green-400' : ''}
                            ${res.status === 'WARNING' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                            ${res.status === 'FAIL' ? 'bg-red-500/20 text-red-400' : ''}
                         `}>
                            {res.status === 'PASS' ? '✓' : res.status === 'FAIL' ? '✕' : '!'}
                        </div>

                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-white">{res.title}</h4>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                                    {res.type}
                                </span>
                            </div>
                            <div className="text-sm text-slate-300">{res.message}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
