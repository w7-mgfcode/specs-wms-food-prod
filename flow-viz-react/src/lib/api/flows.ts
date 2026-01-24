/**
 * Flow Definition and Version API Client
 */

import { apiFetch } from './client';
import type {
    FlowDefinition,
    FlowDefinitionCreate,
    FlowDefinitionListItem,
    FlowVersion,
    FlowVersionListItem,
    FlowVersionUpdate,
    PublishFlowResponse,
} from '../../types/flowEditor';

// Re-export types for consumers
export type {
    FlowDefinition,
    FlowDefinitionCreate,
    FlowDefinitionListItem,
    FlowVersion,
    FlowVersionListItem,
    FlowVersionUpdate,
    PublishFlowResponse,
};

// --- Flow Definitions ---

/**
 * List all flow definitions with version summary
 */
export async function listFlowDefinitions(): Promise<FlowDefinitionListItem[]> {
    return apiFetch<FlowDefinitionListItem[]>('/api/flows');
}

/**
 * Get a flow definition by ID
 */
export async function getFlowDefinition(flowId: string): Promise<FlowDefinition> {
    return apiFetch<FlowDefinition>(`/api/flows/${flowId}`);
}

/**
 * Create a new flow definition (with initial draft version)
 */
export async function createFlowDefinition(data: FlowDefinitionCreate): Promise<FlowDefinition> {
    return apiFetch<FlowDefinition>('/api/flows', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * Delete a flow definition
 */
export async function deleteFlowDefinition(flowId: string): Promise<void> {
    await apiFetch<void>(`/api/flows/${flowId}`, {
        method: 'DELETE',
    });
}

// --- Flow Versions ---

/**
 * List all versions of a flow definition
 */
export async function listFlowVersions(flowId: string): Promise<FlowVersionListItem[]> {
    return apiFetch<FlowVersionListItem[]>(`/api/flows/${flowId}/versions`);
}

/**
 * Get a specific version with full graph schema
 */
export async function getFlowVersion(flowId: string, versionNum: number): Promise<FlowVersion> {
    return apiFetch<FlowVersion>(`/api/flows/${flowId}/versions/${versionNum}`);
}

/**
 * Get the latest draft version for editing
 */
export async function getLatestDraft(flowId: string): Promise<FlowVersion> {
    return apiFetch<FlowVersion>(`/api/flows/${flowId}/versions/latest/draft`);
}

/**
 * Update a draft version's graph schema
 */
export async function updateFlowVersion(
    flowId: string,
    versionNum: number,
    data: FlowVersionUpdate
): Promise<FlowVersion> {
    return apiFetch<FlowVersion>(`/api/flows/${flowId}/versions/${versionNum}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

/**
 * Publish a draft version (locks it and creates new draft)
 */
export async function publishFlowVersion(
    flowId: string,
    versionNum: number
): Promise<PublishFlowResponse> {
    return apiFetch<PublishFlowResponse>(`/api/flows/${flowId}/versions/${versionNum}/publish`, {
        method: 'POST',
    });
}

/**
 * Fork an existing version to create a new draft
 */
export async function forkFlowVersion(flowId: string, versionNum: number): Promise<FlowVersion> {
    return apiFetch<FlowVersion>(`/api/flows/${flowId}/versions/${versionNum}/fork`, {
        method: 'POST',
    });
}
