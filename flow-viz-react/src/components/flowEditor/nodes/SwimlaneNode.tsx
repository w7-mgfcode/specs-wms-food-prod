/**
 * Swimlane Node Component
 *
 * A group node that acts as a container for other nodes.
 * Child nodes can be constrained to stay within this container.
 */

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeResizer as Resizer } from '@xyflow/react';
import { LayoutGrid } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useUIStore } from '../../../stores/useUIStore';
import type { EditorNode, FlowNodeData } from '../../../types/flowEditor';
import { NODE_COLORS } from '../../../types/flowEditor';

function SwimlaneNodeComponent({ data, selected }: NodeProps<EditorNode>) {
    const { language } = useUIStore();
    const color = NODE_COLORS.group;
    const nodeData = data as FlowNodeData;

    return (
        <>
            {/* Resize handles (only when selected) */}
            <Resizer
                minWidth={200}
                minHeight={150}
                isVisible={selected ?? false}
                lineClassName="!border-white/50"
                handleClassName="!w-2 !h-2 !bg-white !border-0"
            />

            {/* Swimlane Container */}
            <div
                className={cn(
                    'w-full h-full rounded-xl',
                    'bg-[rgba(255,255,255,0.03)] border-2 border-dashed',
                    selected ? 'border-white/40' : 'border-gray-600/50'
                )}
                style={{ borderColor: selected ? undefined : `${color}50` }}
            >
                {/* Header */}
                <div
                    className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-t-xl',
                        'bg-gradient-to-r from-gray-800/80 to-transparent'
                    )}
                >
                    <LayoutGrid className="w-4 h-4" style={{ color }} />
                    <span className="text-sm font-medium text-white">
                        {nodeData.label[language]}
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider ml-auto">
                        Swimlane
                    </span>
                </div>

                {/* Content Area (nodes are rendered inside by React Flow) */}
                <div className="w-full h-[calc(100%-40px)]" />
            </div>
        </>
    );
}

export const SwimlaneNode = memo(SwimlaneNodeComponent);
