import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';

interface ShellNavProps {
    isOpen: boolean;
    onClose: () => void;
}

const allNavItems = [
    { path: '/dashboard', icon: '📺', label: 'Live Dashboard', badge: 'V1', roles: ['VIEWER', 'OPERATOR', 'MANAGER', 'AUDITOR', 'ADMIN'] },
    { path: '/command', icon: '🏭', label: 'Command Center', badge: 'V2', roles: ['OPERATOR', 'MANAGER', 'ADMIN'] },
    { path: '/validator', icon: '🔍', label: 'Quality Validator', badge: 'V3', roles: ['AUDITOR', 'MANAGER', 'ADMIN'] },
    { path: '/first-flow', icon: '🌊', label: 'First Flow', badge: 'V4', roles: ['VIEWER', 'OPERATOR', 'MANAGER', 'AUDITOR', 'ADMIN'] },
    { path: '/presentation', icon: '📋', label: 'Presentation', badge: 'DOCS', roles: ['VIEWER', 'OPERATOR', 'MANAGER', 'AUDITOR', 'ADMIN'] },
];

export function ShellNav({ isOpen, onClose }: ShellNavProps) {
    const { role } = useAuthStore();

    // Filter items based on user role
    const navItems = allNavItems.filter(item =>
        !role || item.roles.includes(role)
    );

    return (
        <nav
            className={`
        bg-[var(--shell-nav-bg)] border-b border-[var(--shell-border)] 
        flex gap-2 px-6 overflow-x-auto shadow-md
        scrollbar-thin scrollbar-track-[var(--shell-bg-dark)] scrollbar-thumb-[var(--shell-border)]
        
        /* Mobile drawer */
        md:relative md:flex
        fixed top-0 left-0 w-72 h-full z-50 flex-col p-6 gap-0
        border-r-2 border-[var(--shell-border)]
        transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:w-auto md:h-auto md:flex-row md:border-r-0 md:p-0 md:py-0
      `}
        >
            {navItems.map((item) => (
                <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) => `
            flex items-center gap-2 px-6 py-4 text-sm font-semibold whitespace-nowrap
            border-b-[3px] transition-all
            ${isActive
                            ? 'text-[var(--shell-accent-cyan)] border-[var(--shell-accent-cyan)] bg-[var(--shell-active)]'
                            : 'text-[var(--shell-text-secondary)] border-transparent hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text-primary)]'
                        }
            
            /* Mobile adjustments */
            md:border-b-[3px] md:border-l-0
            border-l-4 border-b border-b-[var(--shell-border)]
            ${isActive ? 'md:border-l-0 border-l-[var(--shell-accent-cyan)]' : ''}
          `}
                >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                    <span className="text-[10px] bg-[rgba(74,158,255,0.3)] px-1.5 py-0.5 rounded-full text-[var(--shell-accent-blue)] font-bold">
                        {item.badge}
                    </span>
                </NavLink>
            ))}
        </nav>
    );
}
