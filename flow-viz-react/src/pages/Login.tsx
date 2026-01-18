import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';

export function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, isLoading, error } = useAuthStore();
    const { language, setLanguage } = useUIStore();

    // Local state for form
    const [email, setEmail] = useState('');
    const [selectedRole, setSelectedRole] = useState<'MANAGER' | 'OPERATOR' | 'AUDITOR' | 'VIEWER'>('MANAGER');

    const from = location.state?.from?.pathname || '/dashboard';

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        await login(email, selectedRole);
        navigate(from, { replace: true });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e] text-white overflow-hidden relative">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse-glow" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-600/20 rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: '1s' }} />
            </div>

            <div className="relative z-10 w-full max-w-md p-8 glass-card border border-slate-700/50 rounded-2xl shadow-xl backdrop-blur-xl bg-slate-900/40">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm mb-6">
                        {error}
                    </div>
                )}

                <div className="text-center mb-8">
                    <div className="text-4xl mb-2">🥙</div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                        DÖNER KFT
                    </h1>
                    <p className="text-slate-400 text-sm">Unified Production System</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-500 transition-colors text-white placeholder-slate-500"
                            placeholder="user@donerkft.hu"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Select Role {import.meta.env.VITE_USE_MOCK === 'true' ? '(Mock)' : '(Auto-assigned)'}</label>
                        <select
                            value={selectedRole}
                            disabled={import.meta.env.VITE_USE_MOCK !== 'true'}
                            onChange={(e) => setSelectedRole(e.target.value as any)}
                            className={`w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-500 transition-colors text-white ${import.meta.env.VITE_USE_MOCK !== 'true' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <option value="MANAGER">Manager (Full Access)</option>
                            <option value="OPERATOR">Operator (Limited)</option>
                            <option value="AUDITOR">Auditor (Read Only)</option>
                            <option value="VIEWER">Viewer (Display)</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold py-2 px-4 rounded-lg transform transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {isLoading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>

                <div className="mt-6 flex justify-center gap-4 text-xs text-slate-500">
                    <button onClick={() => setLanguage('hu')} className={language === 'hu' ? 'text-cyan-400' : ''}>Magyar</button>
                    <span>|</span>
                    <button onClick={() => setLanguage('en')} className={language === 'en' ? 'text-cyan-400' : ''}>English</button>
                </div>
            </div>
        </div>
    );
}
