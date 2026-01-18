import { useState, useEffect } from 'react'
import {
    RelationalSchemaSection,
    TraceabilityFlowSection
} from '../../types/presentation'

// ----------------------------------------------------------------------
// Internal Icon Components (Replacing Heroicons to avoid dependency issues)
// ----------------------------------------------------------------------
const CubeIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
)

const TruckIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0 1.5 1.5 0 0 1 3 0Zm0 0-6.327-.938a1.5 1.5 0 0 1-1.28-1.478V4.875a1.5 1.5 0 0 1 1.5-1.5h10.932a1.5 1.5 0 0 1 1.5 1.5L14.625 18.75m0 0H8.25m6.375 0a1.5 1.5 0 0 1 3 0 1.5 1.5 0 0 1-3 0Zm0 0h2.955a1.5 1.5 0 0 0 1.5-1.5v-6.931a1.5 1.5 0 0 0-.416-1.018l-3.23-3.623a1.5 1.5 0 0 0-1.107-.468h-2.197" />
    </svg>
)

const UserGroupIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 5.223m0 0a9.093 9.093 0 0 0-2.418-2.652A5.986 5.986 0 0 1 6 12.75 6 6 0 0 1 12 6.75a6 6 0 0 1 6 6 5.986 5.986 0 0 1-.95 3.328M12 6.75A6 6 0 1 0 12 6.75a6 6 0 0 0 0 0zm0 0V4.5m0 2.25 3-3m-3 3-3-3" />
    </svg>
)

const ClipboardDocumentCheckIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m11.99 15.75 2.25 2.25 4.5-5.25" />
    </svg>
)

const BoltIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
)

const BuildingStorefrontIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72L4.318 3.44A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72m-13.5 8.65h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .415.336.75.75.75Z" />
    </svg>
)

// ----------------------------------------------------------------------
// 1. Relational Schema Widget (2-Column Grid with Centered Bottom)
// ----------------------------------------------------------------------
export function RelationalSchema({ section }: { section: RelationalSchemaSection }) {
    if (!section || !section.tables) return null

    return (
        <div className="w-full my-4 bg-slate-900/40 border border-slate-800 rounded-xl p-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-700 pb-2">
                <CubeIcon className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    {section.title || 'Relational Architecture'}
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.tables.map((table, idx) => {
                    const isLastOdd = idx === 2

                    return (
                        <div key={idx} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden flex flex-col ${isLastOdd ? 'md:col-span-2 mx-auto w-full md:w-2/3' : ''}`}>
                            <div className="bg-slate-900/80 px-3 py-2 border-b border-indigo-500/30 flex justify-between items-center">
                                <span className="font-mono text-xs font-bold text-indigo-300">{table.title}</span>
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                                    <div className="w-2 h-2 rounded-full bg-yellow-500/50"></div>
                                    <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
                                </div>
                            </div>

                            <div className="p-2 space-y-1">
                                {table.rows?.map((row, rIdx) => (
                                    <div key={rIdx} className="grid grid-cols-[120px_1fr] gap-2 text-[11px] border-b border-slate-700/30 last:border-0 pb-1 last:pb-0 font-mono hover:bg-slate-700/30 transition-colors">
                                        <span className={`font-semibold truncate ${row[0].includes('PK') ? 'text-yellow-400' : (row[0].includes('FK') ? 'text-blue-400' : 'text-slate-400')}`}>
                                            {row[0]}
                                        </span>
                                        <span className="text-slate-500 truncate" title={row[1]}>{row[1]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ----------------------------------------------------------------------
// 2. TraceabilityFlow Diagram (Snake Grid Layout for Backward)
// ----------------------------------------------------------------------
export function TraceabilityFlow({ section }: { section: TraceabilityFlowSection }) {
    const isForward = section.variant === 'forward'
    const isBackward = !isForward

    // Animation: Step Index
    const [stepIndex, setStepIndex] = useState(-1)

    // Auto-Sequence Effect
    useEffect(() => {
        if (!section.nodes?.length) return

        let current = 0
        const interval = setInterval(() => {
            if (current <= section.nodes.length) {
                setStepIndex(current)
            } else {
                setStepIndex(-1)
                current = -1
            }
            current++
        }, 1500)

        return () => clearInterval(interval)
    }, [section.nodes?.length])

    // Render Backward Trace (Snake Layout)
    if (isBackward) {
        return (
            <div className="w-full my-4 bg-slate-900/60 border border-slate-800 rounded-xl p-6 relative">
                <div className="absolute top-0 left-0 p-0 transform -translate-y-1/2 translate-x-4 z-20">
                    <span className="inline-flex items-center px-3 py-1 rounded shadow-[0_0_15px_rgba(244,63,94,0.4)] text-xs font-bold border uppercase tracking-wider bg-rose-900 text-white border-rose-500">
                        ⏪ Backward Trace (FG → Supplier)
                    </span>
                </div>

                {/* Snake Grid: 4 Columns x 2 Rows */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">

                    {/* Row 1: Steps 0, 1, 2, 3 (Left -> Right) */}
                    {section.nodes?.slice(0, 4).map((node, i) => (
                        <SnakeNode key={i} node={node} index={i} activeIndex={stepIndex} direction="right" isLastInRow={i === 3} />
                    ))}

                    {/* Row 2: Data Console (Col 1) + Steps 6, 5, 4 (Right -> Left) */}

                    {/* The Integrated Data Console (Takes First Slot of Row 2) */}
                    <div className="hidden md:flex flex-col justify-end h-full min-h-[140px] bg-black/40 border border-rose-900/30 rounded-xl p-3 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(255,0,0,0.02),rgba(255,0,0,0.06))] z-0 pointer-events-none bg-[length:100%_4px,3px_100%]"></div>

                        <div className="relative z-10 font-mono text-[10px] text-rose-400">
                            <div className="border-b border-rose-800/50 pb-1 mb-2 opacity-70 flex justify-between">
                                <span>TERMINAL_OUTPUT</span>
                                <span className="animate-pulse">● REC</span>
                            </div>

                            <div className="space-y-1">
                                {section.nodes && stepIndex >= 0 && stepIndex < section.nodes.length && (
                                    <>
                                        <div className="opacity-50">QUERY: SELECT parent FROM lot_genealogy...</div>
                                        <div className="text-white font-bold">
                                            ➜ FOUND: {section.nodes[stepIndex].label}
                                        </div>
                                        <div className="text-rose-200 indent-2">
                                            ID: {section.nodes[stepIndex].subLabel}
                                        </div>
                                        {section.nodes[stepIndex].status === 'highlight' && (
                                            <div className="bg-rose-500 text-black px-1 inline-block mt-1 font-bold">
                                                !! CRITICAL MATCH !!
                                            </div>
                                        )}
                                    </>
                                )}
                                {stepIndex === -1 && <div className="opacity-40 italic">Initializing Trace Sequence...</div>}
                                {section.nodes && stepIndex >= section.nodes.length && <div className="text-green-400 font-bold">✔ TRACE SEQUENCE COMPLETE</div>}
                            </div>
                        </div>
                    </div>

                    {/* Remaining Nodes: 6, 5, 4 (Reversed for Right-to-Left visual) */}
                    {section.nodes && [section.nodes[6], section.nodes[5], section.nodes[4]].map((node, i) => {
                        const realIndex = 6 - i
                        if (!node) return null;

                        return (
                            <div key={realIndex} className="md:col-start-auto">
                                <SnakeNode node={node} index={realIndex} activeIndex={stepIndex} direction="left" isLastInRow={false} isFirstInRow={i === 0} />
                            </div>
                        )
                    })}
                </div>

                <div className="hidden md:block absolute top-[50%] right-[calc(12.5%-1px)] h-[25%] w-1 bg-slate-700 -z-0"></div>
                {stepIndex >= 3 && stepIndex <= 4 && (
                    <div className="hidden md:block absolute top-[50%] right-[calc(12.5%-1px)] h-[25%] w-1 bg-rose-500 -z-0 animate-[height_1s_ease-out]"></div>
                )}
            </div>
        )
    }

    // Forward Trace (Linear Implementation)
    return (
        <div className="w-full my-4 bg-slate-900/40 border border-slate-800 rounded-xl p-6 relative overflow-visible">
            <div className="absolute top-0 left-0 p-0 transform -translate-y-1/2 translate-x-4 z-20">
                <span className="inline-flex items-center px-3 py-1 rounded shadow-lg text-xs font-bold border uppercase tracking-wider bg-indigo-900 text-indigo-100 border-indigo-500">
                    ⏩ Forward Trace
                </span>
            </div>

            <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-2 mt-4 relative">
                {section.nodes?.map((node, i) => {
                    const isActive = i === stepIndex
                    return (
                        <div key={i} className="flex-1 min-w-[120px] flex items-center relative z-10">
                            <div className={`relative flex flex-col items-center justify-center p-3 w-full min-h-[90px] rounded-xl border-2 transition-all duration-500 ${isActive
                                ? 'bg-indigo-500/20 border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.5)] scale-105'
                                : node.status === 'highlight' ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-slate-800 border-slate-700 opacity-80'
                                }`}>
                                <NodeIcon type={node.icon} status={node.status} size="normal" />
                                <span className="text-xs font-bold mt-2 text-white">{node.label}</span>
                                <span className="text-[9px] font-mono text-slate-400 max-w-full break-all text-center">{node.subLabel}</span>
                            </div>
                            {i < (section.nodes?.length || 0) - 1 && (
                                <div className="px-2 text-slate-600">▶</div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function SnakeNode({ node, index, activeIndex, direction, isLastInRow }: any) {
    const isActive = index === activeIndex
    const isPassed = index < activeIndex
    const isCritical = node.status === 'highlight'

    return (
        <div className="relative flex items-center justify-center w-full h-full min-h-[140px]">
            {!isLastInRow && direction === 'right' && (
                <div className="absolute right-[-50%] top-1/2 w-full h-[2px] bg-slate-700 -z-10"></div>
            )}
            {!isLastInRow && direction === 'left' && (
                <div className="absolute left-[-50%] top-1/2 w-full h-[2px] bg-slate-700 -z-10"></div>
            )}

            {(isActive || isPassed) && !isLastInRow && direction === 'right' && (
                <div className={`absolute right-[-50%] top-1/2 w-full h-[2px]  -z-10 ${isPassed ? 'bg-rose-500/50' : 'bg-rose-500 animate-[width_1s_ease-out] origin-left'}`}></div>
            )}

            <div className={`
                relative w-full max-w-[180px] p-4 rounded-xl border-2 flex flex-col items-center gap-2
                transition-all duration-500
                ${isActive
                    ? 'bg-rose-600/20 border-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.6)] scale-110 z-20'
                    : isCritical
                        ? 'bg-rose-900/20 border-rose-600/60 z-10'
                        : 'bg-slate-800 border-slate-700 text-slate-500 z-10'
                }
                ${isPassed && !isCritical ? 'opacity-40 grayscale' : 'opacity-100'}
            `}>
                <div className={`absolute -top-3 px-2 py-0.5 rounded text-[8px] font-bold tracking-widest uppercase border ${isActive ? 'bg-rose-500 text-white border-rose-400' : 'bg-slate-900 text-slate-500 border-slate-700'
                    }`}>
                    STEP {index + 1}
                </div>

                <div className={`transition-transform duration-500 ${isActive ? 'scale-125 text-white' : ''}`}>
                    <NodeIcon type={node.icon} status={node.status} size="normal" />
                </div>

                <div className="text-center">
                    <div className={`text-xs font-bold mb-1 ${isActive ? 'text-white' : 'text-slate-300'}`}>{node.label}</div>
                    <div className={`text-[9px] font-mono px-1.5 py-0.5 rounded border break-all leading-tight ${isActive
                        ? 'bg-black/50 text-rose-200 border-rose-500/30'
                        : 'bg-black/20 text-slate-600 border-transparent'
                        }`}>
                        {node.subLabel || 'N/A'}
                    </div>
                </div>

                {isActive && (
                    <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                        <div className="absolute top-0 left-0 w-full h-[20%] bg-gradient-to-b from-rose-500/0 via-rose-500/10 to-rose-500/0 animate-[scan_2s_linear_infinite]"></div>
                    </div>
                )}
            </div>
        </div>
    )
}

function NodeIcon({ type, status, size = 'normal' }: { type?: string, status?: string, size?: 'small' | 'normal' }) {
    const colorClass = status === 'highlight' ? 'text-white' : 'text-slate-500'
    const sizeClass = size === 'small' ? 'w-4 h-4' : 'w-6 h-6'

    switch (type) {
        case 'box': return <CubeIcon className={`${sizeClass} ${colorClass}`} />
        case 'factory': return <BuildingStorefrontIcon className={`${sizeClass} ${colorClass}`} />
        case 'truck': return <TruckIcon className={`${sizeClass} ${colorClass}`} />
        case 'users': return <UserGroupIcon className={`${sizeClass} ${colorClass}`} />
        case 'check': return <ClipboardDocumentCheckIcon className={`${sizeClass} ${colorClass}`} />
        default: return <BoltIcon className={`${sizeClass} ${colorClass}`} />
    }
}
