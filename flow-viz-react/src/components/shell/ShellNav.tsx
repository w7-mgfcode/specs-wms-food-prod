/**
 * Shell Navigation
 *
 * Phase 8.5: Route Consolidation & UI Migration
 */

import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUIStore } from '../../stores/useUIStore';

interface ShellNavProps {
    isOpen: boolean;
    onClose: () => void;
}

type Language = 'hu' | 'en';

interface NavItem {
    path: string;
    icon: string;
    label: { hu: string; en: string };
    roles?: string[];
}

const allNavItems: NavItem[] = [
    {
        path: '/dashboard',
        icon: '\u{1F4FA}', // TV
        label: { hu: 'Irányítópult', en: 'Dashboard' },
    },
    {
        path: '/command',
        icon: '\u{1F3ED}', // Factory
        label: { hu: 'Parancsközpont', en: 'Command Center' },
        roles: ['OPERATOR', 'MANAGER', 'ADMIN'],
    },
    {
        path: '/validator',
        icon: '\u{1F50D}', // Magnifying glass
        label: { hu: 'Minőségellenőrzés', en: 'Quality Validator' },
        roles: ['AUDITOR', 'MANAGER', 'ADMIN'],
    },
    {
        path: '/flow-editor',
        icon: '\u{270F}\u{FE0F}', // Pencil
        label: { hu: 'Folyamat Editor', en: 'Flow Editor' },
        roles: ['OPERATOR', 'MANAGER', 'ADMIN'],
    },
    {
        path: '/presentation',
        icon: '\u{1F4CB}', // Clipboard
        label: { hu: 'Prezentáció', en: 'Presentation' },
    },
];

export function ShellNav({ isOpen, onClose }: ShellNavProps) {
    const { role } = useAuthStore();
    const { language } = useUIStore();

    // Filter items based on user role
    const navItems = allNavItems.filter(
        (item) => !item.roles || !role || item.roles.includes(role)
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
            ${
                isActive
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
                    <span>{item.label[language as Language]}</span>
                </NavLink>
            ))}
        </nav>
    );
}
