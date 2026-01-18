import { ApiEndpointSection } from '../../types/presentation'

export function ApiEndpointList({ section }: { section: ApiEndpointSection }) {
    return (
        <div className="space-y-3 my-6">
            {section.apiEndpoints.map((ep, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-[rgba(15,23,42,0.6)] border border-[var(--shell-border)] rounded-lg hover:border-[var(--color-accent-blue)] transition-all group">
                    <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 rounded text-xs font-bold w-16 text-center ${ep.method === 'GET' ? 'bg-blue-900 text-blue-200' : 'bg-green-900 text-green-200'
                            }`}>
                            {ep.method}
                        </span>
                        <code className="text-[#e2e8f0] font-mono group-hover:text-[var(--color-accent-blue)] transition-colors">
                            {ep.url}
                        </code>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[var(--color-text-secondary)] text-sm hidden md:block">{ep.desc}</span>
                        {ep.status && (
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${ep.status === 'high' ? 'bg-[#ef4444] text-white' :
                                ep.status === 'medium' ? 'bg-[#f59e0b] text-black' :
                                    'bg-[var(--color-text-muted)] text-white'
                                }`}>
                                {ep.status} PRIORITY
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
