/**
 * Start Node Component
 *
 * Flow entry point. Has no incoming connections.
 */

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';
import { BaseNode } from './BaseNode';
import type { EditorNode } from '../../../types/flowEditor';
import { NODE_COLORS } from '../../../types/flowEditor';

function StartNodeComponent(props: NodeProps<EditorNode>) {
    return (
        <BaseNode
            {...props}
            icon={<Play className="w-4 h-4" style={{ color: NODE_COLORS.start }} />}
            showTargetHandle={false}
            showSourceHandle={true}
        />
    );
}

export const StartNode = memo(StartNodeComponent);
