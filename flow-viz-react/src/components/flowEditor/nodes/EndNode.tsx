/**
 * End Node Component
 *
 * Flow termination point. Has no outgoing connections.
 */

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Flag } from 'lucide-react';
import { BaseNode } from './BaseNode';
import type { EditorNode } from '../../../types/flowEditor';
import { NODE_COLORS } from '../../../types/flowEditor';

function EndNodeComponent(props: NodeProps<EditorNode>) {
    return (
        <BaseNode
            {...props}
            icon={<Flag className="w-4 h-4" style={{ color: NODE_COLORS.end }} />}
            showTargetHandle={true}
            showSourceHandle={false}
        />
    );
}

export const EndNode = memo(EndNodeComponent);
