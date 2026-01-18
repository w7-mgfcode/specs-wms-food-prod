import { useState, useEffect } from 'react'
import { FlowCanvas } from '../components/flow/FlowCanvas'
import { PhaseProgress } from '../components/flow/PhaseProgress'
import { AlertBanner } from '../components/flow/AlertBanner'
import type { ScenarioConfig, Language } from '../types/scenario'

export function FlowVizV1() {
    const [scenario, setScenario] = useState<ScenarioConfig | null>(null)
    const [currentPhase, setCurrentPhase] = useState(0)
    const [lang, setLang] = useState<Language>('hu')
    const [isAutoPlaying, setIsAutoPlaying] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Load scenario data
    useEffect(() => {
        fetch('/scenarios/doner-kft.json')
            .then((res) => res.json())
            .then((data) => {
                setScenario(data)
                setLoading(false)
            })
            .catch((err) => {
                setError(err.message)
                setLoading(false)
            })
    }, [])

    // Auto-play
    useEffect(() => {
        if (!isAutoPlaying || !scenario) return

        const interval = setInterval(() => {
            setCurrentPhase((prev) => {
                const maxPhase = scenario.phases.length - 1
                if (prev >= maxPhase) {
                    setIsAutoPlaying(false)
                    return prev
                }
                return prev + 1
            })
        }, 2000)

        return () => clearInterval(interval)
    }, [isAutoPlaying, scenario])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[var(--shell-border)] border-t-[var(--shell-accent-cyan)] rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[var(--shell-text-secondary)]">Loading scenario...</p>
                </div>
            </div>
        )
    }

    if (error || !scenario) {
        return (
            <div className="p-8 text-center text-[var(--status-fail)]">
                Error loading scenario: {error}
            </div>
        )
    }

    const currentPhaseData = scenario.phases[currentPhase]
    const maxPhase = scenario.phases.length - 1

    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-6">
            {/* QC Alert Banner - Top Fixed */}
            <AlertBanner />

            {/* Phase Navigation */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-4 flex-wrap mb-4">
                    <button
                        onClick={() => setCurrentPhase((p) => Math.max(0, p - 1))}
                        disabled={currentPhase === 0}
                        className="px-4 py-2 bg-[rgba(74,158,255,0.2)] border border-[var(--color-accent-blue)] rounded-md text-white hover:bg-[rgba(74,158,255,0.4)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        ◀ {lang === 'hu' ? 'Előző' : 'Previous'}
                    </button>

                    <button
                        onClick={() => setCurrentPhase((p) => Math.min(maxPhase, p + 1))}
                        disabled={currentPhase === maxPhase}
                        className="px-4 py-2 bg-[rgba(74,158,255,0.2)] border border-[var(--color-accent-blue)] rounded-md text-white hover:bg-[rgba(74,158,255,0.4)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        {lang === 'hu' ? 'Következő' : 'Next'} ▶
                    </button>

                    <select
                        value={currentPhase}
                        onChange={(e) => setCurrentPhase(Number(e.target.value))}
                        className="flex-1 min-w-[200px] bg-[rgba(26,31,58,0.8)] border border-[var(--color-accent-blue)] text-white px-4 py-2 rounded-md"
                    >
                        {scenario.phases.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.id}. {p.name[lang]}
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                        className={`px-4 py-2 border rounded-md transition-all ${isAutoPlaying
                            ? 'bg-[var(--color-accent-blue)] border-[var(--color-accent-cyan)] text-white'
                            : 'bg-[rgba(74,158,255,0.2)] border-[var(--color-accent-blue)] text-white hover:bg-[rgba(74,158,255,0.4)]'
                            }`}
                    >
                        {isAutoPlaying ? '⏸' : '▶'} Auto
                    </button>

                    <button
                        onClick={() => setCurrentPhase(0)}
                        className="px-4 py-2 bg-[rgba(74,158,255,0.2)] border border-[var(--color-accent-blue)] rounded-md text-white hover:bg-[rgba(74,158,255,0.4)] transition-all"
                    >
                        ↻ Reset
                    </button>

                    <div className="flex border border-[var(--color-accent-blue)] rounded-md overflow-hidden">
                        <button
                            onClick={() => setLang('hu')}
                            className={`px-4 py-2 text-sm font-semibold transition-all ${lang === 'hu'
                                ? 'bg-[var(--color-accent-blue)] text-white'
                                : 'bg-transparent text-[var(--shell-text-secondary)]'
                                }`}
                        >
                            HU
                        </button>
                        <button
                            onClick={() => setLang('en')}
                            className={`px-4 py-2 text-sm font-semibold transition-all ${lang === 'en'
                                ? 'bg-[var(--color-accent-blue)] text-white'
                                : 'bg-transparent text-[var(--shell-text-secondary)]'
                                }`}
                        >
                            EN
                        </button>
                    </div>
                </div>

                <PhaseProgress
                    phases={scenario.phases.map((p) => ({ id: p.id, name: p.name[lang] }))}
                    currentPhase={currentPhase}
                    onPhaseClick={setCurrentPhase}
                />
            </div>

            {/* Phase Info */}
            <div className="glass-card p-6">
                <h2 className="text-2xl font-bold text-[var(--color-accent-cyan)] mb-2">
                    {currentPhase}. {currentPhaseData?.name[lang]}
                </h2>
                {currentPhaseData?.qcGate && (
                    <p className="text-sm text-[var(--color-text-muted)] mb-2">
                        QC Gate #{currentPhaseData.qcGate}
                    </p>
                )}
                <p className="text-[var(--color-text-secondary)]">
                    {currentPhaseData?.desc[lang]}
                </p>
                {currentPhaseData?.lots.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        <strong className="text-[var(--color-text-secondary)]">
                            {lang === 'hu' ? 'Érintett LOT-ok:' : 'Related LOTs:'}
                        </strong>
                        {currentPhaseData.lots.map((lot) => (
                            <span
                                key={lot}
                                className="px-2 py-1 bg-[rgba(74,158,255,0.2)] border border-[var(--color-accent-blue)] rounded text-xs font-mono"
                            >
                                {lot}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Flow Diagram */}
            <FlowCanvas
                streams={scenario.streams}
                phases={scenario.phases}
                currentPhase={currentPhase}
                theme={scenario.meta.theme}
                lang={lang}
            />
        </div>
    )
}
