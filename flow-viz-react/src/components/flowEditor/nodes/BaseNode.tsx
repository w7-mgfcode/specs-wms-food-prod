/**
 * Base Node Component
 *
 * Shared component for all flow editor nodes.
 * Provides consistent styling and handle placement.
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '../../../lib/utils';
import { useUIStore } from '../../../stores/useUIStore';
import type { FlowNodeType, EditorNode } from '../../../types/flowEditor';
import { NODE_COLORS } from '../../../types/flowEditor';

interface BaseNodeProps extends NodeProps<EditorNode> {
    icon: React.ReactNode;
    showSourceHandle?: boolean;
    showTargetHandle?: boolean;
}

function BaseNodeComponent({
    data,
    selected,
    icon,
    showSourceHandle = true,
    showTargetHandle = true,
}: BaseNodeProps) {
    const { language } = useUIStore();
    const color = NODE_COLORS[data.nodeType as FlowNodeType] || '#6b7280';

    return (
        <div
            className={cn(
                'px-4 py-3 rounded-lg shadow-lg min-w-[140px]',
                'bg-[rgba(26,31,58,0.95)] border-2',
                'transition-all duration-150',
                selected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0a0e1a]' : ''
            )}
            style={{ borderColor: color }}
        >
            {/* Target Handle (incoming connections) */}
            {showTargetHandle && (
                <Handle
                    type="target"
                    position={Position.Top}
                    className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
                />
            )}

            {/* Node Content */}
            <div className="flex items-center gap-2">
                <div
                    className="p-1.5 rounded"
                    style={{ backgroundColor: `${color}20` }}
                >
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                        {data.label[language]}
                    </div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                        {data.nodeType.replace('_', ' ')}
                    </div>
                </div>
            </div>

            {/* Source Handle (outgoing connections) */}
            {showSourceHandle && (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
                />
            )}
        </div>
    );
}

export const BaseNode = memo(BaseNodeComponent);
