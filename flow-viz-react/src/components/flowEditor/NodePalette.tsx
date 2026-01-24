/**
 * Node Palette Component
 *
 * Sidebar with draggable node templates for the flow editor.
 */

import { memo } from 'react';
import {
    Play,
    Flag,
    Cog,
    ShieldCheck,
    Package,
    LayoutGrid,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/useUIStore';
import type { FlowNodeType } from '../../types/flowEditor';
import { NODE_TEMPLATES, NODE_COLORS } from '../../types/flowEditor';

// Icon mapping
const ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
    Play,
    Flag,
    Cog,
    ShieldCheck,
    Package,
    LayoutGrid,
};

interface NodePaletteProps {
    onDragStart: (event: React.DragEvent, nodeType: FlowNodeType) => void;
}

function NodePaletteComponent({ onDragStart }: NodePaletteProps) {
    const { language } = useUIStore();

    const handleDragStart = (event: React.DragEvent, nodeType: FlowNodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart(event, nodeType);
    };

    return (
        <div className="w-56 bg-[rgba(26,31,58,0.95)] border-r border-white/10 overflow-y-auto">
            {/* Header */}
            <div className="p-4 border-b border-white/10">
                <h2 className="text-sm font-semibold text-white">
                    {language === 'hu' ? 'Csomópontok' : 'Nodes'}
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                    {language === 'hu'
                        ? 'Húzd a vászonra'
                        : 'Drag onto canvas'}
                </p>
            </div>

            {/* Node Templates */}
            <div className="p-3 space-y-2">
                {NODE_TEMPLATES.map((template) => {
                    const IconComponent = ICONS[template.icon];
                    const color = NODE_COLORS[template.type];

                    return (
                        <div
                            key={template.type}
                            draggable
                            onDragStart={(e) => handleDragStart(e, template.type)}
                            className={cn(
                                'p-3 rounded-lg cursor-grab active:cursor-grabbing',
                                'bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)]',
                                'border border-transparent hover:border-white/20',
                                'transition-all duration-150'
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="p-2 rounded"
                                    style={{ backgroundColor: `${color}20` }}
                                >
                                    {IconComponent && (
                                        <IconComponent
                                            className="w-4 h-4"
                                            style={{ color }}
                                        />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-white">
                                        {template.label[language]}
                                    </div>
                                    <div className="text-[10px] text-gray-400 truncate">
                                        {template.description[language]}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Tips */}
            <div className="p-4 border-t border-white/10">
                <div className="text-[10px] text-gray-500 space-y-1">
                    <div>
                        {language === 'hu'
                            ? '• Dupla kattintás: szerkesztés'
                            : '• Double-click: edit'}
                    </div>
                    <div>
                        {language === 'hu'
                            ? '• Delete: csomópont törlése'
                            : '• Delete: remove node'}
                    </div>
                    <div>
                        {language === 'hu'
                            ? '• Shift+Drag: több kijelölése'
                            : '• Shift+Drag: select multiple'}
                    </div>
                </div>
            </div>
        </div>
    );
}

export const NodePalette = memo(NodePaletteComponent);
