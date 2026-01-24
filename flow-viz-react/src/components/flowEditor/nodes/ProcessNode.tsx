/**
 * Process Node Component
 *
 * Represents a processing step in the flow.
 */

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Cog } from 'lucide-react';
import { BaseNode } from './BaseNode';
import type { EditorNode } from '../../../types/flowEditor';
import { NODE_COLORS } from '../../../types/flowEditor';

function ProcessNodeComponent(props: NodeProps<EditorNode>) {
    return (
        <BaseNode
            {...props}
            icon={<Cog className="w-4 h-4" style={{ color: NODE_COLORS.process }} />}
            showTargetHandle={true}
            showSourceHandle={true}
        />
    );
}

export const ProcessNode = memo(ProcessNodeComponent);
