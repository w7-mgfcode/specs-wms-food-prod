export function FlowPhases() {
    return (
        <div className="flex flex-col gap-6 my-8">
            {[
                { tag: 'R', title: 'R1-R2: Átvétel', desc: 'Nyersanyag fogadás és QC' },
                { tag: 'C', title: 'C1-C4: Előkészítés', desc: 'Csontozás, darabolás, pácolás' },
                { tag: 'T', title: 'T5-T6: Termelés', desc: 'Keverés, töltés, hőkezelés' },
                { tag: 'F', title: 'F7: Fagyasztás', desc: 'Sokkoló hűtés (-18°C)' },
                { tag: 'L', title: 'L9: Logisztika', desc: 'Csomagolás és kiszállítás' },
            ].map((phase, i) => (
                <div key={i} className="relative bg-[rgba(37,99,235,0.1)] border-2 border-[var(--color-accent-blue)] rounded-xl p-6 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all group z-10">
                    <div className="text-xl font-bold text-[var(--color-accent-blue)] mb-2 flex items-center gap-3">
                        <span className="bg-[var(--color-accent-blue)] text-white w-8 h-8 rounded flex items-center justify-center text-sm">{phase.tag}</span>
                        {phase.title}
                    </div>
                    <div className="text-[var(--color-text-secondary)]">{phase.desc}</div>
                    {i < 4 && (
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[var(--color-accent-blue)] text-2xl animate-bounce z-0">
                            ↓
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}
