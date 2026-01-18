import { useState } from 'react'

// Icons
const SnowflakeIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0-18l-3 3m3-3l3 3m-3 15l-3-3m3 3l3-3M3 12h18M3 12l3-3m-3 3l3 3m15-3l-3-3m3 3l-3 3" />
    </svg>
)

const LockIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
)

const ThermometerIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
)

const CheckCircleIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
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

// Code Block with copy
function CodeBlock({ title, code }: { title: string, code: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="rounded-lg border border-slate-700/50 overflow-hidden bg-black/40 backdrop-blur-sm">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/50 bg-slate-900/50">
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">{title}</span>
                <button onClick={handleCopy} className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] bg-white/10 hover:bg-white/20 transition-colors">
                    {copied ? <CheckCircleIcon className="w-3 h-3 text-green-400" /> : null}
                    {copied ? 'Copied!' : '📋'}
                </button>
            </div>
            <pre className="p-3 text-[9px] sm:text-[10px] font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-[200px] overflow-y-auto">
                {code}
            </pre>
        </div>
    )
}

// Expandable Section
function ExpandableSection({
    title,
    badge,
    badgeColor,
    children,
    defaultOpen = false
}: {
    title: string
    badge?: string
    badgeColor?: string
    children: React.ReactNode
    defaultOpen?: boolean
}) {
    const [expanded, setExpanded] = useState(defaultOpen)

    return (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
            <div
                className="p-3 cursor-pointer flex items-center justify-between"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-white">{title}</h4>
                    {badge && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${badgeColor}`}>
                            {badge}
                        </span>
                    )}
                </div>
                <ChevronIcon className="w-4 h-4 text-slate-500" expanded={expanded} />
            </div>
            {expanded && (
                <div className="px-3 pb-3 border-t border-slate-700/30 pt-3 animate-fadeIn">
                    {children}
                </div>
            )}
        </div>
    )
}

// Temperature Curve Visualization
function TemperatureCurve() {
    const data = [
        { time: '07:45', temp: 3.2, status: 'START' },
        { time: '08:00', temp: -2.1, status: 'Cooling' },
        { time: '08:15', temp: -8.4, status: 'Cooling' },
        { time: '08:30', temp: -14.2, status: 'Cooling' },
        { time: '08:45', temp: -18.1, status: 'TARGET', isTarget: true },
        { time: '09:00', temp: -20.3, status: 'Maintaining' },
        { time: '09:15', temp: -21.8, status: 'END' },
    ]

    const minTemp = -25
    const maxTemp = 5
    const range = maxTemp - minTemp

    return (
        <div className="space-y-3">
            {/* Visual Chart */}
            <div className="relative h-32 bg-gradient-to-b from-red-900/20 via-transparent to-cyan-900/30 rounded-lg border border-slate-700/50 p-3 overflow-hidden">
                {/* Target line */}
                <div
                    className="absolute left-0 right-0 h-px bg-cyan-400/50 border-t border-dashed border-cyan-400"
                    style={{ top: `${((maxTemp - (-18)) / range) * 100}%` }}
                >
                    <span className="absolute right-2 -top-3 text-[8px] text-cyan-400">-18°C Target</span>
                </div>

                {/* Data points */}
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polyline
                        fill="none"
                        stroke="url(#tempGradient)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={data.map((d, i) => {
                            const x = (i / (data.length - 1)) * 100
                            const y = ((maxTemp - d.temp) / range) * 100
                            return `${x},${y}`
                        }).join(' ')}
                    />
                    <defs>
                        <linearGradient id="tempGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="50%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                    </defs>
                    {data.map((d, i) => {
                        const x = (i / (data.length - 1)) * 100
                        const y = ((maxTemp - d.temp) / range) * 100
                        return (
                            <circle
                                key={i}
                                cx={x}
                                cy={y}
                                r={d.isTarget ? 4 : 2}
                                fill={d.isTarget ? '#10b981' : '#fff'}
                                className={d.isTarget ? 'animate-pulse' : ''}
                            />
                        )
                    })}
                </svg>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-[9px] sm:text-[10px]">
                    <thead>
                        <tr className="border-b border-slate-700/50">
                            <th className="px-2 py-1.5 text-left text-slate-400">Időpont</th>
                            <th className="px-2 py-1.5 text-right text-slate-400">Maghő</th>
                            <th className="px-2 py-1.5 text-left text-slate-400">Státusz</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((d, i) => (
                            <tr key={i} className={`border-b border-slate-800/50 ${d.isTarget ? 'bg-emerald-500/10' : ''}`}>
                                <td className="px-2 py-1.5 font-mono text-slate-300">{d.time}</td>
                                <td className={`px-2 py-1.5 text-right font-mono font-bold ${d.temp > 0 ? 'text-red-400' : d.isTarget ? 'text-emerald-400' : 'text-cyan-400'}`}>
                                    {d.temp > 0 ? '+' : ''}{d.temp}°C
                                </td>
                                <td className="px-2 py-1.5">
                                    {d.isTarget ? (
                                        <span className="px-1.5 py-0.5 bg-emerald-500/30 text-emerald-400 rounded text-[8px] font-bold">✅ TARGET REACHED</span>
                                    ) : d.status === 'END' ? (
                                        <span className="px-1.5 py-0.5 bg-cyan-500/30 text-cyan-400 rounded text-[8px] font-bold">🏁 {d.status}</span>
                                    ) : (
                                        <span className="text-slate-400">{d.status}</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// Main Component
export function FreezingWidget() {
    return (
        <div className="w-full space-y-4">
            {/* Header with CCP Badge */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-cyan-900/40 via-blue-900/30 to-cyan-900/40 border border-cyan-500/30 p-4">
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.02)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_3s_linear_infinite]"></div>

                <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                        <SnowflakeIcon className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-cyan-400/80">F7</span>
                            <h2 className="text-base sm:text-lg font-black text-white">SOKKOLÁS / GYORSFAGYASZTÁS</h2>
                            <span className="px-2 py-0.5 bg-red-500 text-white text-[9px] font-black rounded-full animate-pulse">
                                CCP - Critical Control Point
                            </span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-cyan-300/70">
                            Élelmiszer-biztonságos fagyasztás, maghő ≤ -18°C
                        </p>
                    </div>
                </div>

                {/* Key Metrics */}
                <div className="relative mt-4 pt-3 border-t border-cyan-500/20 grid grid-cols-3 gap-3 sm:gap-6">
                    <div className="text-center">
                        <div className="text-xl sm:text-2xl font-black text-cyan-400">-18°C</div>
                        <div className="text-[8px] sm:text-[9px] text-cyan-300/60 uppercase">CCP Target</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xl sm:text-2xl font-black text-white">1 SKU</div>
                        <div className="text-[8px] sm:text-[9px] text-cyan-300/60 uppercase">SKU Lock Rule</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xl sm:text-2xl font-black text-white">90-120</div>
                        <div className="text-[8px] sm:text-[9px] text-cyan-300/60 uppercase">Minutes</div>
                    </div>
                </div>
            </div>

            {/* Critical Rules */}
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <div className="text-xs font-bold text-rose-400 mb-3">🚨 KRITIKUS SZABÁLYOK:</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-900/50 border border-slate-700/50">
                        <LockIcon className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <div className="text-[10px] font-bold text-white">SKU LOCK</div>
                            <div className="text-[9px] text-slate-400">Egy freeze batch = egy SKU</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-900/50 border border-slate-700/50">
                        <ThermometerIcon className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <div className="text-[10px] font-bold text-white">CCP STÁTUSZ</div>
                            <div className="text-[9px] text-slate-400">Maghő dokumentáció kötelező</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-900/50 border border-slate-700/50">
                        <CheckCircleIcon className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <div className="text-[10px] font-bold text-white">TEGNAPI SKW</div>
                            <div className="text-[9px] text-slate-400">F7-ben ENGEDÉLYEZETT</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Expandable Sections */}
            <div className="space-y-3">
                {/* Freeze Batch Event */}
                <ExpandableSection title="FREEZE BATCH EVENT példa" defaultOpen={true}>
                    <CodeBlock
                        title="JSON"
                        code={`{
  "freeze_batch_id": "FRZ-CHK30-20260115-DUNA-0001",
  "sku_lock": "CHK30",  // ⭐ CSAK 30 kg rudak!
  "input_skewers": [
    "SKW-CHK30-20260115-DUNA-0001",  // 30.14 kg
    "SKW-CHK30-20260115-DUNA-0002",  // 29.87 kg
    "SKW-CHK30-20260115-DUNA-0003",  // 30.21 kg
    "SKW-CHK30-20260114-DUNA-0002"   // ✅ TEGNAPI - OK F7-ben!
  ],
  "total_skewers": 15,
  "total_weight_kg": 450.2,
  "freezer_id": "FREEZER-01",
  "start_timestamp": "2026-01-15T07:45:00Z",
  "end_timestamp": "2026-01-15T09:15:00Z",
  "core_temp_target": -18.0,
  "ccp_flag": true
}`}
                    />
                </ExpandableSection>

                {/* Temperature Curve */}
                <ExpandableSection
                    title="🌡️ Maghőmérséklet Görbe"
                    badge="MANDATORY"
                    badgeColor="bg-rose-500/80 text-white"
                    defaultOpen={true}
                >
                    <TemperatureCurve />
                </ExpandableSection>

                {/* SQL Trigger */}
                <ExpandableSection title="SQL - SKU Lock Validáció (Database Trigger)">
                    <CodeBlock
                        title="PostgreSQL"
                        code={`CREATE OR REPLACE FUNCTION validate_freeze_batch_sku_lock()
RETURNS TRIGGER AS $$
DECLARE
  sku_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT sku) INTO sku_count
  FROM freeze_batch_items
  WHERE freeze_batch_id = NEW.freeze_batch_id;
  
  IF sku_count > 1 THEN
    RAISE EXCEPTION 'SKU LOCK VIOLATION: Freeze batch % contains multiple SKUs!', 
      NEW.freeze_batch_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_sku_lock
  AFTER INSERT OR UPDATE ON freeze_batch_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_freeze_batch_sku_lock();`}
                    />
                </ExpandableSection>

                {/* CCP Deviation */}
                <ExpandableSection
                    title="CCP DEVIATION Kezelés (példa)"
                    badge="Non-Conformance"
                    badgeColor="bg-amber-500/80 text-black"
                >
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                            <ExclamationIcon className="w-5 h-5 text-amber-400" />
                            <span className="text-[10px] text-amber-300">Probe showed -16.8°C at end (target ≤ -18°C) → EXTENDED FREEZE → ✅ RELEASED</span>
                        </div>
                        <CodeBlock
                            title="CCP Deviation Record"
                            code={`{
  "deviation_id": "CCP-DEV-20260115-0042",
  "freeze_batch_id": "FRZ-TUR15-20260115-DUNA-0003",
  "deviation_type": "CORE_TEMP_NOT_REACHED",
  "details": "Probe showed -16.8°C at end (target ≤ -18°C)",
  "batch_status": "HOLD",
  "corrective_action": {
    "action_type": "EXTENDED_FREEZE",
    "additional_time": 30,  // minutes
    "re_probe_result": -19.2,  // ✅ OK
    "final_decision": "RELEASED"
  },
  "root_cause": "Freezer door left open for 3 min during loading",
  "preventive_action": "Operator retraining + door alarm"
}`}
                        />
                    </div>
                </ExpandableSection>
            </div>
        </div>
    )
}
