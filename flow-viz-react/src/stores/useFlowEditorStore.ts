/**
 * Flow Editor Store
 *
 * Zustand store for managing the flow editor state.
 * Uses external state management for 60fps canvas performance.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
    Connection,
    EdgeChange,
    NodeChange,
    Viewport,
} from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import type {
    EditorNode,
    EditorEdge,
    FlowDefinition,
    FlowVersion,
    FlowNodeType,
    FlowNodeData,
} from '../types/flowEditor';
import { NODE_TEMPLATES } from '../types/flowEditor';
import * as flowsApi from '../lib/api/flows';

interface FlowEditorState {
    // --- Flow Metadata ---
    flowDefinition: FlowDefinition | null;
    currentVersion: FlowVersion | null;

    // --- Canvas State (React Flow controlled) ---
    nodes: EditorNode[];
    edges: EditorEdge[];
    viewport: Viewport;

    // --- UI State ---
    selectedNodeId: string | null;
    selectedEdgeId: string | null;
    isDirty: boolean;
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;

    // --- Actions: Flow Management ---
    loadFlow: (flowId: string, versionNum?: number) => Promise<void>;
    createFlow: (name: { hu: string; en: string }, description?: string) => Promise<string>;
    saveFlow: () => Promise<void>;
    publishFlow: () => Promise<void>;

    // --- Actions: Canvas Manipulation ---
    onNodesChange: (changes: NodeChange<EditorNode>[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection) => void;
    onViewportChange: (viewport: Viewport) => void;

    // --- Actions: Node Operations ---
    addNode: (type: FlowNodeType, position: { x: number; y: number }, parentId?: string) => void;
    updateNodeData: (nodeId: string, data: Partial<FlowNodeData>) => void;
    deleteNode: (nodeId: string) => void;

    // --- Actions: Selection ---
    selectNode: (nodeId: string | null) => void;
    selectEdge: (edgeId: string | null) => void;

    // --- Actions: Reset ---
    resetEditor: () => void;
}

const initialState = {
    flowDefinition: null,
    currentVersion: null,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedNodeId: null,
    selectedEdgeId: null,
    isDirty: false,
    isLoading: false,
    isSaving: false,
    error: null,
};

export const useFlowEditorStore = create<FlowEditorState>()(
    devtools(
        (set, get) => ({
            ...initialState,

            // --- Flow Management ---

            loadFlow: async (flowId: string, versionNum?: number) => {
                set({ isLoading: true, error: null });

                try {
                    // Get flow definition
                    const flowDef = await flowsApi.getFlowDefinition(flowId);

                    // Get the specified version or latest draft
                    const version = versionNum
                        ? await flowsApi.getFlowVersion(flowId, versionNum)
                        : await flowsApi.getLatestDraft(flowId);

                    set({
                        flowDefinition: flowDef,
                        currentVersion: version,
                        nodes: version.graph_schema.nodes || [],
                        edges: version.graph_schema.edges || [],
                        viewport: version.graph_schema.viewport || { x: 0, y: 0, zoom: 1 },
                        isDirty: false,
                        isLoading: false,
                    });
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to load flow',
                        isLoading: false,
                    });
                }
            },

            createFlow: async (name, description) => {
                set({ isLoading: true, error: null });

                try {
                    const flowDef = await flowsApi.createFlowDefinition({
                        name,
                        description: description || null,
                    });

                    // Load the newly created flow (which has v1 draft)
                    await get().loadFlow(flowDef.id);

                    return flowDef.id;
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to create flow',
                        isLoading: false,
                    });
                    throw error;
                }
            },

            saveFlow: async () => {
                const { flowDefinition, currentVersion, nodes, edges, viewport, isDirty } = get();

                if (!flowDefinition || !currentVersion || !isDirty) return;

                // Can only save drafts
                if (currentVersion.status !== 'DRAFT') {
                    set({ error: 'Cannot save published version' });
                    return;
                }

                set({ isSaving: true, error: null });

                try {
                    const updated = await flowsApi.updateFlowVersion(
                        flowDefinition.id,
                        currentVersion.version_num,
                        {
                            graph_schema: { nodes, edges, viewport },
                        }
                    );

                    set({
                        currentVersion: updated,
                        isDirty: false,
                        isSaving: false,
                    });
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to save flow',
                        isSaving: false,
                    });
                }
            },

            publishFlow: async () => {
                const { flowDefinition, currentVersion } = get();

                if (!flowDefinition || !currentVersion) return;

                set({ isLoading: true, error: null });

                try {
                    const result = await flowsApi.publishFlowVersion(
                        flowDefinition.id,
                        currentVersion.version_num
                    );

                    // Switch to the new draft
                    if (result.new_draft) {
                        set({
                            currentVersion: result.new_draft,
                            nodes: result.new_draft.graph_schema.nodes || [],
                            edges: result.new_draft.graph_schema.edges || [],
                            viewport: result.new_draft.graph_schema.viewport || { x: 0, y: 0, zoom: 1 },
                            isDirty: false,
                            isLoading: false,
                        });
                    } else {
                        set({ isLoading: false });
                    }
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Failed to publish flow',
                        isLoading: false,
                    });
                }
            },

            // --- Canvas Manipulation ---

            onNodesChange: (changes) => {
                set((state) => ({
                    nodes: applyNodeChanges(changes, state.nodes) as EditorNode[],
                    isDirty: true,
                }));
            },

            onEdgesChange: (changes) => {
                set((state) => ({
                    edges: applyEdgeChanges(changes, state.edges),
                    isDirty: true,
                }));
            },

            onConnect: (connection) => {
                set((state) => ({
                    edges: addEdge(
                        {
                            ...connection,
                            id: `e-${connection.source}-${connection.target}-${Date.now()}`,
                        },
                        state.edges
                    ),
                    isDirty: true,
                }));
            },

            onViewportChange: (viewport) => {
                set({ viewport, isDirty: true });
            },

            // --- Node Operations ---

            addNode: (type, position, parentId) => {
                const template = NODE_TEMPLATES.find((t) => t.type === type);
                if (!template) return;

                const id = `${type}-${Date.now()}`;
                const newNode: EditorNode = {
                    id,
                    type,
                    position,
                    data: {
                        label: { ...template.label },
                        nodeType: type,
                        config: { ...template.defaultConfig },
                    },
                    ...(parentId && { parentId, extent: 'parent' as const }),
                    ...(type === 'group' && {
                        style: { width: 400, height: 300 },
                    }),
                };

                set((state) => ({
                    nodes: [...state.nodes, newNode],
                    isDirty: true,
                    selectedNodeId: id,
                }));
            },

            updateNodeData: (nodeId, data) => {
                set((state) => ({
                    nodes: state.nodes.map((node) =>
                        node.id === nodeId
                            ? { ...node, data: { ...node.data, ...data } }
                            : node
                    ),
                    isDirty: true,
                }));
            },

            deleteNode: (nodeId) => {
                set((state) => ({
                    nodes: state.nodes.filter((n) => n.id !== nodeId && n.parentId !== nodeId),
                    edges: state.edges.filter(
                        (e) => e.source !== nodeId && e.target !== nodeId
                    ),
                    isDirty: true,
                    selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
                }));
            },

            // --- Selection ---

            selectNode: (nodeId) => {
                set({ selectedNodeId: nodeId, selectedEdgeId: null });
            },

            selectEdge: (edgeId) => {
                set({ selectedEdgeId: edgeId, selectedNodeId: null });
            },

            // --- Reset ---

            resetEditor: () => {
                set(initialState);
            },
        }),
        { name: 'FlowEditorStore' }
    )
);
