/**
 * Node Components Index
 *
 * Export all custom node components for React Flow registration.
 */

import type { NodeTypes } from '@xyflow/react';

export { StartNode } from './StartNode';
export { EndNode } from './EndNode';
export { ProcessNode } from './ProcessNode';
export { QCGateNode } from './QCGateNode';
export { BufferNode } from './BufferNode';
export { SwimlaneNode } from './SwimlaneNode';

// Node type registry for React Flow
import { StartNode } from './StartNode';
import { EndNode } from './EndNode';
import { ProcessNode } from './ProcessNode';
import { QCGateNode } from './QCGateNode';
import { BufferNode } from './BufferNode';
import { SwimlaneNode } from './SwimlaneNode';

// Using explicit type to satisfy React Flow's NodeTypes constraint
export const nodeTypes: NodeTypes = {
    start: StartNode,
    end: EndNode,
    process: ProcessNode,
    qc_gate: QCGateNode,
    buffer: BufferNode,
    group: SwimlaneNode,
};
