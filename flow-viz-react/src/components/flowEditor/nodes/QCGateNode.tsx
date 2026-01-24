/**
 * QC Gate Node Component
 *
 * Represents a quality control checkpoint.
 * Can be marked as a Critical Control Point (CCP).
 */

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { ShieldCheck } from 'lucide-react';
import { BaseNode } from './BaseNode';
import type { EditorNode } from '../../../types/flowEditor';
import { NODE_COLORS } from '../../../types/flowEditor';

function QCGateNodeComponent(props: NodeProps<EditorNode>) {
    const isCCP = props.data?.config?.isCCP === true;

    return (
        <div className="relative">
            {/* CCP Badge */}
            {isCCP && (
                <div className="absolute -top-2 -right-2 z-10 px-1.5 py-0.5 text-[9px] font-bold bg-red-500 text-white rounded">
                    CCP
                </div>
            )}
            <BaseNode
                {...props}
                icon={<ShieldCheck className="w-4 h-4" style={{ color: NODE_COLORS.qc_gate }} />}
                showTargetHandle={true}
                showSourceHandle={true}
            />
        </div>
    );
}

export const QCGateNode = memo(QCGateNodeComponent);
