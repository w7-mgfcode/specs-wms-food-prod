import { useState } from 'react'

// Icons
const PackageIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
)

const TagIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
    </svg>
)

const TruckIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
)

const CheckCircleIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
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
            <pre className="p-3 text-[9px] sm:text-[10px] font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-[180px] overflow-y-auto">
                {code}
            </pre>
        </div>
    )
}

// Phase Card Component
function PhaseCard({
    phase,
    title,
    badge,
    badgeColor,
    icon: Icon,
    iconBg,
    purpose,
    children,
    defaultOpen = false
}: {
    phase: string
    title: string
    badge: string
    badgeColor: string
    icon: React.ComponentType<{ className?: string }>
    iconBg: string
    purpose: string
    children: React.ReactNode
    defaultOpen?: boolean
}) {
    const [expanded, setExpanded] = useState(defaultOpen)

    return (
        <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm overflow-hidden">
            {/* Header */}
            <div
                className="p-3 sm:p-4 cursor-pointer flex items-start gap-3"
                onClick={() => setExpanded(!expanded)}
            >
                {/* Phase Icon */}
                <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-500">{phase}</span>
                        <h3 className="text-sm sm:text-base font-bold text-white">{title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${badgeColor}`}>
                            {badge}
                        </span>
                    </div>
                    <p className="text-[10px] sm:text-xs text-slate-400">{purpose}</p>
                </div>

                {/* Expand Arrow */}
                <ChevronIcon className="w-5 h-5 text-slate-500 flex-shrink-0" expanded={expanded} />
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-slate-700/50 pt-3 animate-fadeIn">
                    {children}
                </div>
            )}
        </div>
    )
}

// QC Check Item
function QCCheckItem({ icon, title, desc }: { icon: string, title: string, desc: string }) {
    return (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-800/30 border border-slate-700/30">
            <span className="text-lg">{icon}</span>
            <div>
                <div className="text-xs font-semibold text-white">{title}</div>
                <div className="text-[10px] text-slate-400">{desc}</div>
            </div>
        </div>
    )
}

// Pallet Table
function PalletTable() {
    const rows = [
        { id: 'PAL-CHK15-A-0001', sscc: '00123...5678', sku: 'CHK15', lots: 'FG-...-0002, 0003', customer: 'VEVŐ-A', count: '20 db', weight: '300 kg' },
        { id: 'PAL-CHK30-B-0001', sscc: '00123...5679', sku: 'CHK30', lots: 'FG-...-0001', customer: 'VEVŐ-B', count: '8 db', weight: '240 kg' },
    ]

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[9px] sm:text-[10px]">
                <thead>
                    <tr className="border-b border-slate-700/50">
                        <th className="px-2 py-1.5 text-left text-slate-400 font-medium">Pallet</th>
                        <th className="px-2 py-1.5 text-left text-slate-400 font-medium">SKU</th>
                        <th className="px-2 py-1.5 text-left text-slate-400 font-medium hidden sm:table-cell">FG Lots</th>
                        <th className="px-2 py-1.5 text-left text-slate-400 font-medium">Vevő</th>
                        <th className="px-2 py-1.5 text-right text-slate-400 font-medium">Db</th>
                        <th className="px-2 py-1.5 text-right text-slate-400 font-medium">Tömeg</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                            <td className="px-2 py-2 font-mono text-cyan-400">{row.id}</td>
                            <td className="px-2 py-2">
                                <span className="px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded text-[8px] font-bold">{row.sku}</span>
                            </td>
                            <td className="px-2 py-2 text-slate-400 hidden sm:table-cell">{row.lots}</td>
                            <td className="px-2 py-2 text-amber-400">{row.customer}</td>
                            <td className="px-2 py-2 text-right text-white">{row.count}</td>
                            <td className="px-2 py-2 text-right text-emerald-400 font-semibold">{row.weight}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// Main Component
export function PackagingWidget() {
    return (
        <div className="w-full space-y-4">
            {/* Header with Flow */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-900/30 via-purple-900/20 to-pink-900/30 border border-purple-500/30 p-4">
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.02)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_3s_linear_infinite]"></div>

                {/* Phase Flow */}
                <div className="relative flex flex-wrap items-center justify-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                        <PackageIcon className="w-5 h-5 text-indigo-400" />
                        <div>
                            <div className="text-xs font-bold text-indigo-300">P8</div>
                            <div className="text-[8px] text-indigo-400/70">PACK</div>
                        </div>
                    </div>

                    <div className="text-2xl text-slate-600">→</div>

                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
                        <TagIcon className="w-5 h-5 text-purple-400" />
                        <div>
                            <div className="text-xs font-bold text-purple-300">L9</div>
                            <div className="text-[8px] text-purple-400/70">PALLET</div>
                        </div>
                    </div>

                    <div className="text-2xl text-slate-600">→</div>

                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                        <TruckIcon className="w-5 h-5 text-emerald-400" />
                        <div>
                            <div className="text-xs font-bold text-emerald-300">SHP</div>
                            <div className="text-[8px] text-emerald-400/70">SHIP</div>
                        </div>
                    </div>
                </div>

                {/* Key Info */}
                <div className="relative mt-4 pt-3 border-t border-purple-500/20 flex flex-wrap justify-center gap-4 sm:gap-8">
                    <div className="text-center">
                        <div className="text-lg font-black text-white">-18°C</div>
                        <div className="text-[9px] text-purple-300/60 uppercase">Min Temp</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-black text-white">≤10 min</div>
                        <div className="text-[9px] text-purple-300/60 uppercase">Expozíció</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-black text-emerald-400">✓</div>
                        <div className="text-[9px] text-purple-300/60 uppercase">1-Forward</div>
                    </div>
                </div>
            </div>

            {/* Phase Cards */}
            <div className="space-y-3">
                {/* P8: Packaging */}
                <PhaseCard
                    phase="P8"
                    title="CSOMAGOLÁS + JELÖLÉS"
                    badge="CCP/oPRP"
                    badgeColor="bg-red-500/80 text-white"
                    icon={PackageIcon}
                    iconBg="bg-gradient-to-br from-indigo-500 to-indigo-700"
                    purpose="B2B jelölés, lezárás, metal detection"
                    defaultOpen={true}
                >
                    <div className="space-y-4">
                        {/* Quick Info */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/30">
                                <div className="text-[9px] text-slate-500 uppercase">Input</div>
                                <div className="text-xs text-cyan-400">FRZ batch → FG lot</div>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/30">
                                <div className="text-[9px] text-slate-500 uppercase">Hőmérséklet</div>
                                <div className="text-xs text-blue-400">-18°C alatt</div>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/30 col-span-2 sm:col-span-1">
                                <div className="text-[9px] text-slate-500 uppercase">Kritikus</div>
                                <div className="text-xs text-rose-400">Metal + Seal + Label</div>
                            </div>
                        </div>

                        {/* QC Checks */}
                        <div>
                            <div className="text-xs font-semibold text-emerald-400 mb-2">✅ P8 QC Ellenőrzések:</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <QCCheckItem icon="🏷️" title="Label Check" desc="LOT number, date, SKU, weight" />
                                <QCCheckItem icon="🔒" title="Seal Integrity" desc="Vacuum, closure validation" />
                                <QCCheckItem icon="🧲" title="Metal Detection" desc="CCP log, sensitivity check" />
                                <QCCheckItem icon="📏" title="Weight Verification" desc="Final weight vs freeze batch" />
                            </div>
                        </div>

                        {/* Code Example */}
                        <CodeBlock
                            title="PACKAGING EVENT példa"
                            code={`{
  "event_id": "PACK-CHK15-20260115-0001",
  "input_freeze_batch": "FRZ-CHK15-20260115-DUNA-0001",
  "output_fg_lot": "FG-CHK15-20260115-DUNA-0002",
  "metal_detector_log": {
    "device_id": "MD-PKG-01",
    "sensitivity": "2.5mm Fe",
    "test_passed": true
  },
  "label_print_log": {
    "template_version": "v3.2",
    "print_quality_check": "PASS"
  },
  "seal_check": { "vacuum_level": "98%", "integrity": "PASS" },
  "temperature_exposure_log": {
    "exposure_duration_min": 10,
    "max_temp_recorded": -16.5
  }
}`}
                        />
                    </div>
                </PhaseCard>

                {/* L9: Palletizing */}
                <PhaseCard
                    phase="L9"
                    title="RAKLAPKÉPZÉS + SSCC"
                    badge="PRP"
                    badgeColor="bg-purple-500/80 text-white"
                    icon={TagIcon}
                    iconBg="bg-gradient-to-br from-purple-500 to-purple-700"
                    purpose="Vevőnként külön paletta, SSCC kapcsolás"
                >
                    <div className="space-y-4">
                        {/* SKU Separation Alert */}
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                            <div className="text-xs font-bold text-amber-400 mb-2">🔒 SKU Szeparáció Raklapon:</div>
                            <ul className="text-[10px] text-amber-300/80 space-y-1">
                                <li>• CHK15 / CHK30 / TUR15 / TUR30 <strong className="text-white">KÜLÖN</strong> raklapokon</li>
                                <li>• Egy raklap = <strong className="text-white">egy SKU + egy vevő</strong></li>
                                <li>• SSCC = GS1 szabvány szerinti egyedi azonosító</li>
                            </ul>
                        </div>

                        {/* Pallet Table */}
                        <div className="rounded-lg border border-slate-700/50 overflow-hidden">
                            <PalletTable />
                        </div>
                    </div>
                </PhaseCard>

                {/* SHP: Shipping */}
                <PhaseCard
                    phase="SHP"
                    title="KISZÁLLÍTÁS"
                    badge="1-Forward Ready"
                    badgeColor="bg-emerald-500/80 text-white"
                    icon={TruckIcon}
                    iconBg="bg-gradient-to-br from-emerald-500 to-emerald-700"
                    purpose="Hűtőlánc átadás, teljes dokumentáció"
                >
                    <div className="space-y-4">
                        {/* Ready Status */}
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                            <CheckCircleIcon className="w-8 h-8 text-emerald-400" />
                            <div>
                                <div className="text-sm font-bold text-emerald-400">1-Forward Trace READY</div>
                                <div className="text-[10px] text-emerald-300/70">Recall ready: RAW → ... → Vevő nyomkövetés működik</div>
                            </div>
                        </div>

                        {/* Code Example */}
                        <CodeBlock
                            title="SHIPMENT RECORD"
                            code={`{
  "shipment_id": "SHP-20260116-0042",
  "customer_id": "CUST-A",
  "dispatch_timestamp": "2026-01-16T08:30:00Z",
  "vehicle_id": "TRUCK-05",
  "pallets": [{
    "sscc": "00123456789012345678",
    "pallet_id": "PAL-CHK15-...-A-0001",
    "fg_lots": ["FG-CHK15-...-0002", "FG-CHK15-...-0003"],
    "temperature_proof": {
      "loading_temp": -19.2,
      "vehicle_setpoint": -18.0,
      "datalogger_id": "LOGGER-TRUCK-05"
    }
  }],
  "documentation": {
    "delivery_note": "DN-2026-0116-042",
    "temperature_cert": "TEMP-CERT-042.pdf",
    "coa_attached": true
  },
  "recall_ready": true  // ✅ 1-forward trace működik
}`}
                        />
                    </div>
                </PhaseCard>
            </div>
        </div>
    )
}
