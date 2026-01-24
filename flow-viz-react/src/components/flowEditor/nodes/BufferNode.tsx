/**
 * Buffer Node Component
 *
 * Represents a storage/buffer point in the flow.
 */

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Package } from 'lucide-react';
import { BaseNode } from './BaseNode';
import type { EditorNode } from '../../../types/flowEditor';
import { NODE_COLORS } from '../../../types/flowEditor';

function BufferNodeComponent(props: NodeProps<EditorNode>) {
    return (
        <BaseNode
            {...props}
            icon={<Package className="w-4 h-4" style={{ color: NODE_COLORS.buffer }} />}
            showTargetHandle={true}
            showSourceHandle={true}
        />
    );
}

export const BufferNode = memo(BufferNodeComponent);
