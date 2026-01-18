import { ReactNode, useState } from 'react'
import { ShellHeader } from './ShellHeader'
import { ShellNav } from './ShellNav'

interface AppShellProps {
    children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    return (
        <div className="min-h-screen flex flex-col overflow-hidden bg-gradient-to-br from-[var(--shell-bg-dark)] to-[var(--shell-bg-medium)]">
            <ShellHeader onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
            <ShellNav isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

            {/* Mobile Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    )
}
