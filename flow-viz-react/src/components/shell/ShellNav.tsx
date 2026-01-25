/**
 * Shell Navigation
 *
 * Phase 8.5: Route Consolidation & UI Migration
 */

import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUIStore } from '../../stores/useUIStore';

interface ShellNavProps {
    isOpen: boolean;
    onClose: () => void;
}

type Language = 'hu' | 'en';

interface NavItem {
    path?: string;
    icon: string;
    label: { hu: string; en: string };
    roles?: string[];
    children?: NavItem[];
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
    {
        icon: '\u{1F4E6}', // Package
        label: { hu: 'Régi', en: 'OLD' },
        children: [
            {
                path: '/old/command',
                icon: '\u{1F3ED}', // Factory
                label: { hu: 'Parancsközpont V2', en: 'Command Center V2' },
            },
            {
                path: '/old/validator',
                icon: '\u{1F50D}', // Magnifying glass
                label: { hu: 'Minőségellenőrzés V3', en: 'Quality Validator V3' },
            },
            {
                path: '/old/first-flow',
                icon: '\u{1F30A}', // Wave
                label: { hu: 'First Flow V4', en: 'First Flow V4' },
            },
        ],
    },
];

export function ShellNav({ isOpen, onClose }: ShellNavProps) {
    const { role } = useAuthStore();
    const { language } = useUIStore();
    const location = useLocation();
    const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

    // Filter items based on user role
    const navItems = allNavItems.filter(
        (item) => !item.roles || !role || item.roles.includes(role)
    );

    const toggleSubmenu = (label: string) => {
        setExpandedMenus((prev) => {
            const next = new Set(prev);
            if (next.has(label)) {
                next.delete(label);
            } else {
                next.add(label);
            }
            return next;
        });
    };

    const isChildActive = (children: NavItem[] | undefined) => {
        if (!children) return false;
        return children.some((child) => child.path && location.pathname.startsWith(child.path));
    };

    const navLinkClasses = (isActive: boolean, isChild = false) => `
        flex items-center gap-2 px-6 py-4 text-sm font-semibold whitespace-nowrap
        border-b-[3px] transition-all cursor-pointer
        ${isChild ? 'pl-10' : ''}
        ${
            isActive
                ? 'text-[var(--shell-accent-cyan)] border-[var(--shell-accent-cyan)] bg-[var(--shell-active)]'
                : 'text-[var(--shell-text-secondary)] border-transparent hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text-primary)]'
        }
        /* Mobile adjustments */
        md:border-b-[3px] md:border-l-0
        border-l-4 border-b border-b-[var(--shell-border)]
        ${isActive ? 'md:border-l-0 border-l-[var(--shell-accent-cyan)]' : ''}
    `;

    return (
        <nav
            className={`
        bg-[var(--shell-nav-bg)] border-b border-[var(--shell-border)]
        flex gap-2 px-6 overflow-x-auto overflow-y-visible md:overflow-visible shadow-md
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
            {navItems.map((item) => {
                const menuKey = item.label.en;

                // Item with children (submenu)
                if (item.children) {
                    const isExpanded = expandedMenus.has(menuKey);
                    const hasActiveChild = isChildActive(item.children);

                    return (
                        <div key={menuKey} className="md:relative">
                            <button
                                onClick={() => toggleSubmenu(menuKey)}
                                className={navLinkClasses(hasActiveChild)}
                            >
                                <span>{item.icon}</span>
                                <span>{item.label[language as Language]}</span>
                                <span
                                    className={`ml-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                >
                                    {'\u{25BC}'}
                                </span>
                            </button>

                            {/* Submenu dropdown */}
                            {isExpanded && (
                                <div
                                    className={`
                                        md:absolute md:top-full md:left-0
                                        bg-[var(--shell-nav-bg)] border border-[var(--shell-border)]
                                        rounded-b-lg shadow-lg min-w-[200px]
                                        flex flex-col z-[100]
                                    `}
                                >
                                    {item.children.map((child) => (
                                        <NavLink
                                            key={child.path}
                                            to={child.path!}
                                            onClick={onClose}
                                            className={({ isActive }) =>
                                                navLinkClasses(isActive, true)
                                            }
                                        >
                                            <span>{child.icon}</span>
                                            <span>{child.label[language as Language]}</span>
                                        </NavLink>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                }

                // Regular item (no children)
                return (
                    <NavLink
                        key={item.path}
                        to={item.path!}
                        onClick={onClose}
                        className={({ isActive }) => navLinkClasses(isActive)}
                    >
                        <span>{item.icon}</span>
                        <span>{item.label[language as Language]}</span>
                    </NavLink>
                );
            })}
        </nav>
    );
}
