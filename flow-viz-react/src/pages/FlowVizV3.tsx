import { useState } from 'react';
import { LiveComplianceWidget } from '../components/widgets/LiveComplianceWidget';
import { TraceabilityGraph } from '../components/validator/TraceabilityGraph';
import { AuditLog } from '../components/validator/AuditLog';
import { cn } from '../lib/utils';
import { useProductionStore } from '../stores/useProductionStore';

export function FlowVizV3() {
    const { activeRun } = useProductionStore();
    const [activeTab, setActiveTab] = useState<'trace' | 'audit'>('trace');

    return (
        <div className="h-full flex flex-col bg-slate-900 text-white">
            {/* Header / Context Bar */}
            <div className="p-4 border-b border-slate-700 bg-slate-800/80 backdrop-blur-md flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                        🛡️ QUALITY VALIDATOR
                    </h1>
                    <div className="text-xs text-slate-400 font-mono">
                        SYSTEM: {activeRun ? 'ACTIVE' : 'IDLE'} | ROLE: AUDITOR
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                    <button
                        onClick={() => setActiveTab('trace')}
                        className={cn("px-4 py-1.5 rounded-md text-sm font-bold transition-all",
                            activeTab === 'trace' ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-white"
                        )}
                    >
                        Genealogy Graph
                    </button>
                    <button
                        onClick={() => setActiveTab('audit')}
                        className={cn("px-4 py-1.5 rounded-md text-sm font-bold transition-all",
                            activeTab === 'audit' ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-white"
                        )}
                    >
                        Audit Logs
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left: Compliance Engine (Always Visible) */}
                <div className="w-1/3 min-w-[350px] border-r border-slate-700 p-4 bg-slate-900/50 overflow-y-auto custom-scrollbar">
                    <LiveComplianceWidget />

                    <div className="mt-8 p-4 bg-purple-900/10 border border-purple-500/30 rounded-xl">
                        <h4 className="font-bold text-purple-300 mb-2">💡 Auditor Notes</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            System automatically flags Cold Chain violations (CCP) and Daily Target misses (Mandatory).
                            Review the Validation list above before signing off on the batch.
                        </p>
                    </div>
                </div>

                {/* Right: Toggleable View */}
                <div className="flex-1 bg-slate-950 p-4 overflow-hidden relative">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none"
                        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}
                    />

                    {activeTab === 'trace' ? (
                        <div className="h-full">
                            <TraceabilityGraph />
                        </div>
                    ) : (
                        <div className="h-full">
                            <AuditLog />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
