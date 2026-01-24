/**
 * Flow Canvas Component
 *
 * The main canvas for editing flows using React Flow.
 * Handles drag-drop, connections, and selection.
 */

import { memo, useCallback, useRef, useEffect } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    type ReactFlowInstance,
    type Connection,
    type NodeChange,
    type EdgeChange,
    type Node,
    BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useFlowEditorStore } from '../../stores/useFlowEditorStore';
import { nodeTypes } from './nodes';
import type { FlowNodeType, EditorNode, FlowNodeData } from '../../types/flowEditor';

// Debounce hook for auto-save
function useDebounce(callback: () => void, delay: number, deps: unknown[]) {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            callback();
        }, delay);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
}

interface FlowCanvasProps {
    onDragOver: (event: React.DragEvent) => void;
    onDrop: (event: React.DragEvent) => void;
}

function FlowCanvasComponent({ onDragOver, onDrop }: FlowCanvasProps) {
    // Using 'any' here due to React Flow v12 generic complexity with custom node types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reactFlowRef = useRef<ReactFlowInstance<any, any> | null>(null);

    const {
        nodes,
        edges,
        viewport,
        currentVersion,
        isDirty,
        onNodesChange,
        onEdgesChange,
        onConnect,
        onViewportChange,
        selectNode,
        selectEdge,
        addNode,
        saveFlow,
    } = useFlowEditorStore();

    // Auto-save when dirty (debounced 2 seconds)
    useDebounce(
        () => {
            if (isDirty && currentVersion?.status === 'DRAFT') {
                saveFlow();
            }
        },
        2000,
        [isDirty, currentVersion?.status]
    );

    // Handle node changes
    const handleNodesChange = useCallback(
        (changes: NodeChange[]) => {
            onNodesChange(changes as NodeChange<EditorNode>[]);
        },
        [onNodesChange]
    );

    // Handle edge changes
    const handleEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            onEdgesChange(changes);
        },
        [onEdgesChange]
    );

    // Handle connections
    const handleConnect = useCallback(
        (connection: Connection) => {
            onConnect(connection);
        },
        [onConnect]
    );

    // Handle node selection
    const handleNodeClick = useCallback(
        (_event: React.MouseEvent, node: Node<FlowNodeData>) => {
            selectNode(node.id);
        },
        [selectNode]
    );

    // Handle edge selection
    const handleEdgeClick = useCallback(
        (_event: React.MouseEvent, edge: { id: string }) => {
            selectEdge(edge.id);
        },
        [selectEdge]
    );

    // Handle canvas click (deselect)
    const handlePaneClick = useCallback(() => {
        selectNode(null);
        selectEdge(null);
    }, [selectNode, selectEdge]);

    // Handle drop from palette
    const handleDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const nodeType = event.dataTransfer.getData('application/reactflow') as FlowNodeType;
            if (!nodeType) return;

            // Get drop position in flow coordinates
            if (!reactFlowRef.current) return;
            const position = reactFlowRef.current.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            // Check if dropping inside a swimlane
            const swimlanes = nodes.filter((n) => n.type === 'group');
            let parentId: string | undefined;

            for (const swimlane of swimlanes) {
                const swimlaneWidth = (swimlane.style?.width as number) || 400;
                const swimlaneHeight = (swimlane.style?.height as number) || 300;

                if (
                    position.x >= swimlane.position.x &&
                    position.x <= swimlane.position.x + swimlaneWidth &&
                    position.y >= swimlane.position.y &&
                    position.y <= swimlane.position.y + swimlaneHeight
                ) {
                    parentId = swimlane.id;
                    // Adjust position relative to parent
                    position.x -= swimlane.position.x;
                    position.y -= swimlane.position.y;
                    break;
                }
            }

            // Don't allow swimlane inside swimlane
            if (nodeType === 'group' && parentId) {
                return;
            }

            addNode(nodeType, position, parentId);
            onDrop(event);
        },
        [nodes, addNode, onDrop]
    );

    // Handle move/zoom
    const handleMoveEnd = useCallback(
        (_event: unknown, newViewport: { x: number; y: number; zoom: number }) => {
            onViewportChange(newViewport);
        },
        [onViewportChange]
    );

    // Handle React Flow instance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleInit = useCallback((instance: ReactFlowInstance<any, any>) => {
        reactFlowRef.current = instance;
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Delete key to remove selected node
            if (event.key === 'Delete' || event.key === 'Backspace') {
                const { selectedNodeId, deleteNode } = useFlowEditorStore.getState();
                if (selectedNodeId) {
                    deleteNode(selectedNodeId);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const isReadOnly = currentVersion?.status !== 'DRAFT';

    return (
        <div className="flex-1 h-full">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
                onNodeClick={handleNodeClick}
                onEdgeClick={handleEdgeClick}
                onPaneClick={handlePaneClick}
                onDragOver={onDragOver}
                onDrop={handleDrop}
                onMoveEnd={handleMoveEnd}
                onInit={handleInit}
                defaultViewport={viewport}
                fitView
                snapToGrid
                snapGrid={[15, 15]}
                nodesDraggable={!isReadOnly}
                nodesConnectable={!isReadOnly}
                elementsSelectable={true}
                deleteKeyCode={null} // We handle delete manually
                className="bg-[#0a0e1a]"
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1}
                    color="#1a1f3a"
                />
                <Controls
                    showZoom={true}
                    showFitView={true}
                    showInteractive={false}
                    className="!bg-[rgba(26,31,58,0.95)] !border-white/10 !rounded-lg"
                />
                <MiniMap
                    nodeColor={(node) => {
                        const nodeType = node.type as FlowNodeType | undefined;
                        if (!nodeType) return '#6b7280';
                        const colors: Record<string, string> = {
                            start: '#22c55e',
                            end: '#ef4444',
                            process: '#3b82f6',
                            qc_gate: '#f59e0b',
                            buffer: '#8b5cf6',
                            group: '#6b7280',
                        };
                        return colors[nodeType] || '#6b7280';
                    }}
                    className="!bg-[rgba(26,31,58,0.95)] !border-white/10 !rounded-lg"
                    maskColor="rgba(0, 0, 0, 0.5)"
                />
            </ReactFlow>
        </div>
    );
}

export const FlowCanvas = memo(FlowCanvasComponent);
