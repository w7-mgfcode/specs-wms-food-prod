import { useState } from 'react'
import { CodeSection } from '../../types/presentation'

export function CodeBlock({ section }: { section: CodeSection }) {
    const [copied, setCopied] = useState(false)

    const copyCode = () => {
        navigator.clipboard.writeText(section.content)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="bg-[#0a0e1a] border border-[var(--shell-border)] rounded-lg overflow-hidden my-4">
            <div className="flex justify-between items-center px-4 py-2 border-b border-[var(--shell-border)]">
                <span className="text-[var(--status-pass)] font-semibold text-sm">{section.codeTitle}</span>
                <button
                    onClick={copyCode}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-all ${copied
                        ? 'bg-[var(--status-pass)] text-black'
                        : 'bg-[var(--color-accent-blue)] text-white hover:bg-[var(--color-accent-cyan)]'
                        }`}
                >
                    {copied ? '✅ Másolva!' : '📋 Másolás'}
                </button>
            </div>
            <pre className="p-4 overflow-x-auto text-sm font-mono text-[#e2e8f0] leading-relaxed">
                {section.content}
            </pre>
        </div>
    )
}
