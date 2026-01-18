import { useState } from 'react'

// Types
interface ComplianceRule {
    id: string
    title: string
    type: 'MANDATORY' | 'CCP' | 'AUDIT'
    shortDesc: string
    whyList?: string[]
    triggerCode?: string
    complianceQuery?: string
    viewCode?: string
}

interface ComplianceWidgetProps {
    rules: ComplianceRule[]
}

// Icons
const ShieldIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
)

const LockIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
)

const ThermometerIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5M18.364 5.636l-1.06 1.06M21 12h-1.5M18.364 18.364l-1.06-1.06M12 19.5V21M6.696 17.304l-1.06 1.06M4.5 12H3M6.696 6.696l-1.06-1.06M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
    </svg>
)

const ExclamationIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
)

const ChevronIcon = ({ className, expanded }: { className?: string, expanded: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        className={`${className} transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
)

const CheckCircleIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
)

// Type Badge Component
function TypeBadge({ type }: { type: 'MANDATORY' | 'CCP' | 'AUDIT' }) {
    const styles = {
        MANDATORY: 'bg-gradient-to-r from-rose-600 to-red-500 text-white shadow-lg shadow-rose-500/30',
        CCP: 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/30',
        AUDIT: 'bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-lg shadow-purple-500/30',
    }

    const icons = {
        MANDATORY: <LockIcon className="w-3 h-3" />,
        CCP: <ThermometerIcon className="w-3 h-3" />,
        AUDIT: <ShieldIcon className="w-3 h-3" />,
    }

    return (
        <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider ${styles[type]}`}>
            {icons[type]}
            <span className="hidden xs:inline">{type}</span>
        </span>
    )
}

// Code Block Component
function CodeBlock({ title, code, variant = 'default' }: { title: string, code: string, variant?: 'default' | 'query' | 'view' }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const borderColors = {
        default: 'border-indigo-500/30',
        query: 'border-emerald-500/30',
        view: 'border-amber-500/30',
    }

    const headerColors = {
        default: 'bg-indigo-900/50 border-indigo-500/30',
        query: 'bg-emerald-900/50 border-emerald-500/30',
        view: 'bg-amber-900/50 border-amber-500/30',
    }

    return (
        <div className={`rounded-lg border ${borderColors[variant]} overflow-hidden bg-black/40 backdrop-blur-sm`}>
            <div className={`flex items-center justify-between px-3 py-1.5 border-b ${headerColors[variant]}`}>
                <span className="font-mono text-[10px] text-slate-300 uppercase tracking-wider">{title}</span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] bg-white/10 hover:bg-white/20 transition-colors"
                >
                    {copied ? <CheckCircleIcon className="w-3 h-3 text-green-400" /> : null}
                    {copied ? 'Copied!' : '📋 Copy'}
                </button>
            </div>
            <pre className="p-3 text-[10px] font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-[200px] overflow-y-auto">
                {code}
            </pre>
        </div>
    )
}

// Single Rule Card Component
function RuleCard({ rule, index }: { rule: ComplianceRule, index: number }) {
    const [expanded, setExpanded] = useState(false)

    const gradients = [
        'from-rose-500/10 via-transparent to-transparent border-rose-500/20',
        'from-blue-500/10 via-transparent to-transparent border-blue-500/20',
        'from-emerald-500/10 via-transparent to-transparent border-emerald-500/20',
        'from-amber-500/10 via-transparent to-transparent border-amber-500/20',
    ]

    const numberColors = [
        'text-rose-400 bg-rose-500/20 border-rose-500/30',
        'text-blue-400 bg-blue-500/20 border-blue-500/30',
        'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
        'text-amber-400 bg-amber-500/20 border-amber-500/30',
    ]

    return (
        <div className={`rounded-xl border bg-gradient-to-br ${gradients[index % 4]} backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-slate-900/50`}>
            {/* Header - Always Visible */}
            <div
                className="p-3 sm:p-4 cursor-pointer flex items-start gap-2 sm:gap-4"
                onClick={() => setExpanded(!expanded)}
            >
                {/* Number Badge */}
                <div className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center font-black text-base sm:text-lg border ${numberColors[index % 4]}`}>
                    {index + 1}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-1 sm:mb-2">
                        <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-2 sm:truncate">{rule.title}</h3>
                        <TypeBadge type={rule.type} />
                    </div>
                    <p className="text-[10px] sm:text-xs text-slate-400 leading-relaxed line-clamp-2 sm:line-clamp-none">{rule.shortDesc}</p>

                    {/* Why List Preview - Hidden on mobile, shown on sm+ */}
                    {rule.whyList && rule.whyList.length > 0 && (
                        <div className="hidden sm:flex mt-3 flex-wrap gap-2">
                            {rule.whyList.map((item, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/50 text-[9px] text-slate-400">
                                    <span className="w-1 h-1 rounded-full bg-current"></span>
                                    {item}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Expand Arrow */}
                <ChevronIcon className="w-5 h-5 text-slate-500 flex-shrink-0" expanded={expanded} />
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2 sm:space-y-3 border-t border-slate-800/50 pt-3 sm:pt-4 animate-fadeIn">
                    {/* Why List - Show in expanded on mobile */}
                    {rule.whyList && rule.whyList.length > 0 && (
                        <div className="flex sm:hidden flex-wrap gap-1.5 mb-2">
                            {rule.whyList.map((item, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/50 text-[8px] text-slate-400">
                                    <span className="w-1 h-1 rounded-full bg-current"></span>
                                    {item}
                                </span>
                            ))}
                        </div>
                    )}
                    {rule.triggerCode && (
                        <CodeBlock title="PostgreSQL Trigger" code={rule.triggerCode} variant="default" />
                    )}
                    {rule.complianceQuery && (
                        <CodeBlock title="Compliance Query" code={rule.complianceQuery} variant="query" />
                    )}
                    {rule.viewCode && (
                        <CodeBlock title="Compliance View" code={rule.viewCode} variant="view" />
                    )}
                </div>
            )}
        </div>
    )
}

// Main Component
export function ComplianceWidget({ rules }: ComplianceWidgetProps) {
    return (
        <div className="w-full space-y-3 sm:space-y-4">
            {/* Header Banner */}
            <div className="relative overflow-hidden rounded-lg sm:rounded-xl bg-gradient-to-r from-rose-900/30 via-red-900/20 to-rose-900/30 border border-rose-500/30 p-3 sm:p-4">
                {/* Animated Background */}
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.02)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_3s_linear_infinite]"></div>

                <div className="relative flex items-center gap-3 sm:gap-4">
                    <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
                        <ExclamationIcon className="w-5 h-5 sm:w-7 sm:h-7 text-rose-400" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm sm:text-lg font-black text-white flex items-center gap-2">
                            🚨 KRITIKUS SZABÁLYOK
                        </h2>
                        <p className="text-[10px] sm:text-xs text-rose-300/80 mt-0.5 line-clamp-2 sm:line-clamp-none">
                            <span className="hidden sm:inline">Ezek a szabályok </span><strong className="text-white">DB trigger-ek</strong> → <strong className="text-rose-400">NEM MEGKERÜLHETŐ</strong>
                        </p>
                    </div>
                </div>

                {/* Stats */}
                <div className="relative flex flex-wrap gap-3 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-rose-500/20">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-rose-500/20 flex items-center justify-center">
                            <LockIcon className="w-3 h-3 sm:w-4 sm:h-4 text-rose-400" />
                        </div>
                        <div>
                            <div className="text-base sm:text-lg font-black text-white">{rules.filter(r => r.type === 'MANDATORY').length}</div>
                            <div className="text-[8px] sm:text-[9px] text-rose-300/60 uppercase tracking-wider">Mandatory</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-amber-500/20 flex items-center justify-center">
                            <ThermometerIcon className="w-3 h-3 sm:w-4 sm:h-4 text-amber-400" />
                        </div>
                        <div>
                            <div className="text-base sm:text-lg font-black text-white">{rules.filter(r => r.type === 'CCP').length}</div>
                            <div className="text-[8px] sm:text-[9px] text-amber-300/60 uppercase tracking-wider">CCP</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-emerald-500/20 flex items-center justify-center">
                            <ShieldIcon className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400" />
                        </div>
                        <div>
                            <div className="text-base sm:text-lg font-black text-white">{rules.length}</div>
                            <div className="text-[8px] sm:text-[9px] text-emerald-300/60 uppercase tracking-wider">Összes</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Rules Grid - Always single column */}
            <div className="flex flex-col gap-3 sm:gap-4">
                {rules.map((rule, index) => (
                    <RuleCard key={rule.id} rule={rule} index={index} />
                ))}
            </div>
        </div>
    )
}

// Export types for use in slides.ts
export type { ComplianceRule, ComplianceWidgetProps }
