/**
 * Flow Editor Types
 *
 * TypeScript definitions for the visual workflow builder.
 * These types match the backend Pydantic schemas for API compatibility.
 */

import type { Node, Edge, Viewport } from '@xyflow/react';
import type { LocalizedString } from './scenario';

// --- Node Types ---

export type FlowNodeType = 'start' | 'end' | 'process' | 'qc_gate' | 'buffer' | 'group';

export type FlowVersionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

// Node data payload matching backend schema
// Index signature required for React Flow v12 Node generic constraint
export interface FlowNodeData extends Record<string, unknown> {
    label: LocalizedString;
    nodeType: FlowNodeType;
    config: Record<string, unknown>;
}

// Extended React Flow node with our custom data
export type EditorNode = Node<FlowNodeData, FlowNodeType>;

// Extended React Flow edge
export type EditorEdge = Edge;

// --- API Types ---

// Flow Definition (the abstract concept of a workflow)
export interface FlowDefinition {
    id: string;
    name: LocalizedString;
    description: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

// Flow Definition with version summary (for list view)
export interface FlowDefinitionListItem {
    id: string;
    name: LocalizedString;
    description: string | null;
    created_at: string;
    updated_at: string;
    latest_version_num: number | null;
    latest_status: FlowVersionStatus | null;  // Matches backend field name
    version_count: number;
    published_version_num: number | null;
    created_by_name: string | null;
}

// Graph Schema (stored in flow_versions.graph_schema JSONB)
export interface GraphSchema {
    nodes: EditorNode[];
    edges: EditorEdge[];
    viewport: Viewport;
}

// Flow Version (immutable snapshot of a flow)
export interface FlowVersion {
    id: string;
    flow_definition_id: string;
    version_num: number;
    status: FlowVersionStatus;
    graph_schema: GraphSchema;
    created_by: string | null;
    published_at: string | null;
    published_by: string | null;
    created_at: string;
}

// Flow Version list item (without full graph)
export interface FlowVersionListItem {
    id: string;
    flow_definition_id: string;
    version_num: number;
    status: FlowVersionStatus;
    created_by: string | null;
    published_at: string | null;
    created_at: string;
}

// --- Request Types ---

export interface FlowDefinitionCreate {
    name: LocalizedString;
    description?: string | null;
}

export interface FlowVersionUpdate {
    graph_schema: GraphSchema;
}

// --- Response Types ---

export interface PublishFlowResponse {
    published_version: FlowVersion;
    new_draft: FlowVersion | null;
}

// --- Node Templates (for the palette) ---

export interface NodeTemplate {
    type: FlowNodeType;
    label: LocalizedString;
    description: LocalizedString;
    icon: string; // Lucide icon name
    defaultConfig: Record<string, unknown>;
}

// Default node templates for the palette
export const NODE_TEMPLATES: NodeTemplate[] = [
    {
        type: 'start',
        label: { hu: 'Kezdés', en: 'Start' },
        description: { hu: 'Folyamat kezdőpontja', en: 'Flow start point' },
        icon: 'Play',
        defaultConfig: {},
    },
    {
        type: 'process',
        label: { hu: 'Folyamat', en: 'Process' },
        description: { hu: 'Feldolgozási lépés', en: 'Processing step' },
        icon: 'Cog',
        defaultConfig: {},
    },
    {
        type: 'qc_gate',
        label: { hu: 'QC Kapu', en: 'QC Gate' },
        description: { hu: 'Minőségellenőrzési pont', en: 'Quality control checkpoint' },
        icon: 'ShieldCheck',
        defaultConfig: { isCCP: false },
    },
    {
        type: 'buffer',
        label: { hu: 'Puffer', en: 'Buffer' },
        description: { hu: 'Tárolási pont', en: 'Storage point' },
        icon: 'Package',
        defaultConfig: {},
    },
    {
        type: 'group',
        label: { hu: 'Úszósáv', en: 'Swimlane' },
        description: { hu: 'Funkcionális terület', en: 'Functional area' },
        icon: 'LayoutGrid',
        defaultConfig: {},
    },
    {
        type: 'end',
        label: { hu: 'Vége', en: 'End' },
        description: { hu: 'Folyamat végpontja', en: 'Flow end point' },
        icon: 'Flag',
        defaultConfig: {},
    },
];

// --- Node Colors ---

export const NODE_COLORS: Record<FlowNodeType, string> = {
    start: '#22c55e', // green-500
    end: '#ef4444', // red-500
    process: '#3b82f6', // blue-500
    qc_gate: '#f59e0b', // amber-500
    buffer: '#8b5cf6', // violet-500
    group: '#6b7280', // gray-500
};
