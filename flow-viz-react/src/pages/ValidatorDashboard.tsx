/**
 * Validator Dashboard
 *
 * Landing page for Quality Validator with navigation to sub-sections.
 * Phase 8.5: Route Consolidation & UI Migration
 */

import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../stores/useUIStore';

const SECTIONS = [
    {
        path: 'genealogy',
        icon: '\u{1F4CC}', // pushpin
        label: { hu: 'Nyomkövetés', en: 'Genealogy' },
        description: { hu: '1-vissza / 1-előre lekérdezés', en: '1-back / 1-forward trace' },
        color: '#3b82f6',
    },
    {
        path: 'inspections',
        icon: '\u{2705}', // check mark
        label: { hu: 'Ellenőrzések', en: 'Inspections' },
        description: { hu: 'QC döntések listája', en: 'QC decision log' },
        color: '#22c55e',
    },
    {
        path: 'audit',
        icon: '\u{1F4DC}', // scroll
        label: { hu: 'Audit napló', en: 'Audit Log' },
        description: { hu: 'Rendszer események', en: 'System events' },
        color: '#8b5cf6',
    },
];

export function ValidatorDashboard() {
    const navigate = useNavigate();
    const { language } = useUIStore();

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 bg-[rgba(26,31,58,0.95)] border-b border-white/10">
                <h1 className="text-xl font-semibold text-white">
                    {language === 'hu' ? 'Minőségellenőrzés' : 'Quality Validator'}
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                    {language === 'hu'
                        ? 'Nyomkövetés, ellenőrzések és audit'
                        : 'Traceability, inspections, and audit'}
                </p>
            </div>

            {/* Section Cards */}
            <div className="flex-1 p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {SECTIONS.map((section) => (
                        <div
                            key={section.path}
                            onClick={() => navigate(`/validator/${section.path}`)}
                            className="p-6 rounded-xl cursor-pointer bg-[rgba(26,31,58,0.95)] border border-white/10 hover:border-white/20 transition-all group"
                        >
                            <div
                                className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-2xl"
                                style={{ backgroundColor: `${section.color}20` }}
                            >
                                {section.icon}
                            </div>
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                {section.label[language]}
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    &rarr;
                                </span>
                            </h3>
                            <p className="text-sm text-gray-400 mt-1">
                                {section.description[language]}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
