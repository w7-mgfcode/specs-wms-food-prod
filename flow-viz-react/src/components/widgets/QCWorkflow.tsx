import { QCWorkflowSection } from '../../types/presentation'


export function QCWorkflow({ section }: { section: QCWorkflowSection }) {
    return (
        <div className="w-full my-8 font-mono text-sm">
            {/* Header / Meta Line */}
            <div className="flex items-center justify-between uppercase tracking-widest text-[10px] text-slate-500 mb-4 px-4">
                <span>System Log: QC-FLOW-V2</span>
                <span>Mode: LIVE_VIEW</span>
            </div>

            <div className="relative space-y-0">
                {/* Continuous Vertical Line */}
                <div className="absolute left-6 top-4 bottom-4 w-px bg-slate-700/50" />

                {section.qcSteps.map((step, i) => (
                    <div key={i} className="relative group grid grid-cols-[60px_200px_1fr] gap-6 items-start py-4 transition-colors hover:bg-slate-800/20 rounded-r-lg">

                        {/* Column 1: Timeline Marker (Centered) */}
                        <div className="relative flex justify-center pt-2">
                            <div className={`w-5 h-5 rounded-sm border-2 z-10 flex items-center justify-center bg-slate-900 transition-colors duration-300 ${step.status === 'success' ? 'border-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' :
                                    step.status === 'warning' ? 'border-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]' :
                                        step.status === 'critical' ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' :
                                            'border-slate-600 group-hover:border-cyan-500'
                                }`}>
                                <div className={`w-2 h-2 rounded-[1px] ${step.status === 'success' ? 'bg-green-500' :
                                        step.status === 'warning' ? 'bg-orange-500' :
                                            step.status === 'critical' ? 'bg-red-500' :
                                                'bg-slate-600 group-hover:bg-cyan-500'
                                    }`} />
                            </div>
                        </div>

                        {/* Column 2: Context (Title & Status - Fixed Width) */}
                        <div className="flex flex-col pt-1">
                            <span className={`text-xs font-bold uppercase tracking-wider mb-2 ${step.status === 'success' ? 'text-green-400' :
                                    step.status === 'warning' ? 'text-orange-400' :
                                        step.status === 'critical' ? 'text-red-400' :
                                            'text-slate-300'
                                }`}>
                                {step.title}
                            </span>
                            <StatusBadge status={step.status} />
                        </div>

                        {/* Column 3: Data Details (Expands to fill) */}
                        <div className="bg-slate-900/80 border border-slate-700/50 rounded p-3 text-slate-300 hover:border-slate-600 transition-colors shadow-sm mr-4">
                            <div
                                className="space-y-1.5 leading-relaxed [&>strong]:text-cyan-500 [&>strong]:font-semibold uppercase text-[11px] font-mono tracking-tight"
                                dangerouslySetInnerHTML={{ __html: step.desc }}
                            />
                        </div>

                    </div>
                ))}
            </div>

            {/* Footer Line */}
            <div className="h-px bg-slate-700/50 mt-4 mx-4" />
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    let classes = "px-1.5 py-0.5 text-[10px] font-bold uppercase border bg-opacity-10 inline-block w-fit "
    let text = status

    switch (status) {
        case 'success':
            classes += " bg-green-500/20 text-green-400 border border-green-500/30"
            break
        case 'warning':
            classes += " bg-orange-500/20 text-orange-400 border border-orange-500/30"
            text = "review"
            break
        case 'critical':
            classes += " bg-red-500/20 text-red-400 border border-red-500/30"
            break
        default:
            classes += " bg-blue-500/10 text-blue-300 border border-blue-500/20"
            text = "process"
    }

    return <span className={classes}>{text}</span>
}
