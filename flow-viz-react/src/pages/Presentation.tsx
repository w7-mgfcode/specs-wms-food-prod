import { useState } from 'react'
import { SectionRenderer } from '../components/SectionRenderer'
import { slides } from '../data/slides'

type Lang = 'hu' | 'en'

export function Presentation() {
    const [currentSlide, setCurrentSlide] = useState(0)
    const [lang] = useState<Lang>('hu')

    const slide = slides[currentSlide]
    const totalSlides = slides.length

    return (
        <div className="flex h-full">
            {/* Sidebar Placeholder */}
            <aside className="w-64 bg-[#1e293b] border-r border-[var(--shell-border)] overflow-y-auto flex-shrink-0">
                <div className="p-4">
                    <h2 className="text-sm font-semibold text-[var(--color-text-muted)] mb-4">
                        {lang === 'hu' ? 'Tartalomjegyzék' : 'Contents'}
                    </h2>
                    <div className="space-y-1">
                        {slides.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => setCurrentSlide(s.id)}
                                className={`w-full text-left px-3 py-2 rounded transition-all text-sm ${currentSlide === s.id
                                    ? 'bg-[rgba(37,99,235,0.2)] text-[var(--color-accent-cyan)] border-l-4 border-[var(--color-accent-blue)] pl-2'
                                    : 'text-[var(--color-text-secondary)] hover:bg-[rgba(37,99,235,0.1)]'
                                    }`}
                            >
                                {s.navTitle}
                            </button>
                        ))}
                    </div>
                </div>
            </aside>

            {/* Main Content Placeholder */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Progress Bar */}
                <div className="h-1 bg-[var(--shell-border)]">
                    <div
                        className="h-full bg-gradient-to-r from-[var(--status-pass)] to-[var(--color-accent-blue)] transition-all duration-300"
                        style={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }}
                    />
                </div>

                {/* Progress Dots */}
                <div className="flex justify-center gap-2 py-4 bg-[#1e293b]">
                    {slides.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentSlide(idx)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${idx < currentSlide
                                ? 'bg-[var(--status-pass)] text-black'
                                : idx === currentSlide
                                    ? 'bg-[var(--color-accent-blue)] text-white shadow-[0_0_20px_rgba(37,99,235,0.6)]'
                                    : 'bg-[#1e293b] border-4 border-[var(--shell-border)] text-[var(--color-text-muted)]'
                                }`}
                        >
                            {idx + 1}
                        </button>
                    ))}
                </div>

                {/* Header Banner - Only on first slide */}
                {currentSlide === 0 && (
                    <div className="bg-gradient-to-r from-[#1e3a8a] to-[#3b82f6] p-8 text-center border-b border-[var(--shell-border)]">
                        <div className="flex items-center justify-center gap-4 mb-2">
                            <span className="text-5xl">🥙</span>
                            <h1 className="text-3xl font-bold text-white">DÖNER KFT Production System</h1>
                        </div>
                        <p className="text-[#93c5fd] text-lg">Audit-Ready, HACCP-Compatible, EU 852/2004 & 853/2004 Compliant</p>
                        <span className="inline-block mt-3 px-4 py-1 bg-[#10b981] text-white text-sm font-bold rounded-full">
                            EU Compliant
                        </span>
                    </div>
                )}

                {/* Slide Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-4xl mx-auto">
                        <h2 className="text-3xl font-bold text-[var(--color-accent-blue)] mb-6 pb-3 border-b-4 border-[var(--color-accent-blue)]">
                            {slide?.title}
                        </h2>

                        {slide?.sections.map((section, idx) => (
                            <SectionRenderer key={idx} section={section} idx={idx} />
                        ))}
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center p-4 border-t border-[var(--shell-border)] bg-[#1e293b]">
                    <button
                        onClick={() => setCurrentSlide((p) => Math.max(0, p - 1))}
                        disabled={currentSlide === 0}
                        className="px-6 py-2 bg-[#0f172a] border-2 border-[var(--shell-border)] rounded-lg text-white font-bold hover:border-[var(--color-accent-blue)] disabled:opacity-30 transition-all"
                    >
                        ← {lang === 'hu' ? 'Előző' : 'Previous'}
                    </button>

                    <span className="text-[var(--color-text-muted)]">
                        {currentSlide + 1} / {totalSlides}
                    </span>

                    <button
                        onClick={() => setCurrentSlide((p) => Math.min(totalSlides - 1, p + 1))}
                        disabled={currentSlide === totalSlides - 1}
                        className="px-6 py-2 bg-[var(--color-accent-blue)] rounded-lg text-white font-bold hover:shadow-[0_5px_15px_rgba(37,99,235,0.4)] disabled:opacity-30 transition-all"
                    >
                        {currentSlide === totalSlides - 1
                            ? (lang === 'hu' ? '🏁 Vissza az Elejére' : '🏁 Back to Start')
                            : (lang === 'hu' ? 'Következő →' : 'Next →')
                        }
                    </button>
                </div>
            </main>
        </div>
    )
}
