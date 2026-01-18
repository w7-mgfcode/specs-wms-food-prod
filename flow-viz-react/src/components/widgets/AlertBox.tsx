import { AlertSection } from '../../types/presentation'

export function AlertBox({ section }: { section: AlertSection }) {
    // Map variants to specific styles/icons if needed, or stick to the original logic
    const isBox = section.variant.includes('-box')

    // Legacy mapping (simplified) or Rich mapping
    const getStyles = () => {
        switch (section.variant) {
            case 'warning':
            case 'warning-box':
                return {
                    container: 'bg-[rgba(245,158,11,0.1)] border-l-4 border-[var(--status-warning)] text-[var(--status-warning)]',
                    title: 'text-[var(--status-warning)]'
                }
            case 'success':
            case 'success-box':
                return {
                    container: 'bg-[rgba(16,185,129,0.1)] border-l-4 border-[var(--status-pass)] text-[var(--status-pass)]',
                    title: 'text-[var(--status-pass)]'
                }
            case 'audit-critical':
                return {
                    container: 'bg-red-950/40 border-l-4 border-red-500 text-red-200 shadow-[0_0_20px_rgba(220,38,38,0.15)] relative overflow-hidden',
                    title: 'text-red-400 font-mono tracking-wider uppercase flex items-center gap-3',
                    badge: true
                }
            case 'info':
            case 'info-box':
            default:
                return {
                    container: 'bg-[rgba(59,130,246,0.1)] border-l-4 border-[var(--color-accent-blue)] text-[var(--color-accent-blue)]',
                    title: 'text-[var(--color-accent-blue)]'
                }
        }
    }

    const style = getStyles()

    if (isBox || section.variant === 'audit-critical') {
        const isAudit = section.variant === 'audit-critical'
        // Rich Box Style
        return (
            <div className={`p-4 rounded-r-lg my-4 ${style.container}`}>
                {section.title && (
                    <div className={`font-bold text-lg mb-2 ${style.title}`}>
                        {isAudit && (
                            <>
                                <span className="animate-pulse w-2 h-2 rounded-full bg-red-500 absolute left-[-6px]" />
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                                </svg>
                                <span className="bg-red-500/20 border border-red-500/50 text-red-500 text-[10px] px-2 py-0.5 rounded tracking-widest animate-pulse">
                                    AUDIT LOG // CRITICAL
                                </span>
                            </>
                        )}
                        <span dangerouslySetInnerHTML={{ __html: section.title }} />
                    </div>
                )}
                <div
                    className={`${isAudit ? 'text-red-100/90 font-mono text-sm' : 'text-[var(--color-text-primary)] opacity-90'} leading-relaxed`}
                    dangerouslySetInnerHTML={{ __html: section.content }}
                />
            </div>
        )
    }

    // Legacy Simple Alert
    return (
        <div className={`p-4 rounded my-4 ${style.container}`}>
            <strong>{section.title || section.variant.toUpperCase()}:</strong> {section.content}
        </div>
    )
}
