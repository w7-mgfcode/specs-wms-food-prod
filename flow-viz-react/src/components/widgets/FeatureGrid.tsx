import { FeatureGridSection } from '../../types/presentation'

export function FeatureGrid({ section }: { section: FeatureGridSection }) {
    const { featureGrid } = section

    return (
        <div className="bg-[#0f172a] border-2 border-[var(--color-accent-blue)] rounded-xl overflow-hidden my-6 shadow-2xl">
            <div className="p-6 pb-4 flex justify-between items-start border-b border-[rgba(59,130,246,0.3)] bg-[rgba(30,41,59,0.5)]">
                <h3 className="text-2xl font-bold text-[#10b981] mb-2">{featureGrid.title}</h3>
                <span className="bg-[#10b981] text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                    {featureGrid.badge}
                </span>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-[rgba(15,23,42,0.3)]">
                {featureGrid.features.map((feat, i) => (
                    <div key={i} className="flex items-start gap-4">
                        <span className="text-2xl mt-1">{feat.icon}</span>
                        <div>
                            <div className="font-bold text-white text-lg">{feat.title}</div>
                            <div className="text-[var(--color-text-secondary)] text-sm">{feat.desc}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
