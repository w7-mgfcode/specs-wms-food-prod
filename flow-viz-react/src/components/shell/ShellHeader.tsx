import { useAuthStore } from '../../stores/useAuthStore';
import { useNavigate } from 'react-router-dom';

interface ShellHeaderProps {
    onMenuToggle: () => void
}

export function ShellHeader({ onMenuToggle }: ShellHeaderProps) {
    const { user, role, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <header className="bg-[var(--shell-nav-bg)] border-b-2 border-[var(--shell-accent-cyan)] p-6 flex items-center justify-between flex-wrap gap-4 shadow-lg">
            {/* Logo */}
            <div className="flex items-center gap-4">
                <div className="text-4xl drop-shadow-md">🥙</div>
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--shell-accent-cyan)] to-[var(--shell-accent-blue)] bg-clip-text text-transparent">
                        DÖNER KFT Production Suite
                    </h1>
                    <p className="text-xs text-[var(--shell-text-muted)] font-mono">
                        Visualization & Process Flow Management
                    </p>
                </div>
            </div>

            {/* Auth Controls */}
            <div className="flex items-center gap-4 ml-auto">
                {user ? (
                    <div className="hidden sm:flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-sm font-bold text-white">{user.email}</div>
                            <div className="text-xs text-cyan-400 font-mono">{role}</div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="text-xs border border-red-500/50 text-red-400 hover:bg-red-500/10 px-3 py-1 rounded transition-colors"
                        >
                            LOGOUT
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => navigate('/login')}
                        className="text-sm bg-cyan-600/20 text-cyan-400 px-4 py-2 rounded border border-cyan-500/50 hover:bg-cyan-600/30 transition-all"
                    >
                        LOGIN
                    </button>
                )}

                {/* Hamburger (mobile) */}
                <button
                    onClick={onMenuToggle}
                    className="md:hidden bg-transparent border-2 border-[var(--shell-accent-cyan)] text-[var(--shell-accent-cyan)] text-2xl px-4 py-2 rounded-md hover:bg-[var(--shell-hover)] transition-all"
                    aria-label="Toggle menu"
                >
                    ☰
                </button>
            </div>
        </header>
    )
}
