/**
 * Flow Editor TanStack Query Hooks
 *
 * Query and mutation hooks for flow definitions and versions.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import {
    listFlowDefinitions,
    getFlowDefinition,
    createFlowDefinition,
    getFlowVersion,
    updateFlowVersion,
    publishFlowVersion,
    forkFlowVersion,
    type FlowDefinitionListItem,
    type FlowDefinition,
    type FlowDefinitionCreate,
    type FlowVersion,
    type FlowVersionUpdate,
} from '../lib/api/flows';

/**
 * Query hook for listing all flow definitions
 */
export function useFlowDefinitions() {
    return useQuery({
        queryKey: queryKeys.flows.lists(),
        queryFn: listFlowDefinitions,
    });
}

/**
 * Query hook for getting a single flow definition with its versions
 */
export function useFlowDefinition(flowId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.flows.detail(flowId ?? ''),
        queryFn: () => getFlowDefinition(flowId!),
        enabled: !!flowId,
    });
}

/**
 * Query hook for getting a specific flow version
 */
export function useFlowVersion(flowId: string | undefined, versionNum: number | undefined) {
    return useQuery({
        queryKey: queryKeys.flows.version(flowId ?? '', versionNum ?? 0),
        queryFn: () => getFlowVersion(flowId!, versionNum!),
        enabled: !!flowId && versionNum !== undefined,
    });
}

/**
 * Mutation hook for creating a new flow definition
 */
export function useCreateFlowDefinition() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: FlowDefinitionCreate) => createFlowDefinition(data),
        onSuccess: () => {
            // Invalidate flow lists to trigger refetch
            queryClient.invalidateQueries({ queryKey: queryKeys.flows.lists() });
        },
    });
}

/**
 * Mutation hook for updating a flow version
 */
export function useUpdateFlowVersion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            flowId,
            versionNum,
            data,
        }: {
            flowId: string;
            versionNum: number;
            data: FlowVersionUpdate;
        }) => updateFlowVersion(flowId, versionNum, data),
        onSuccess: (_, variables) => {
            // Invalidate the specific version
            queryClient.invalidateQueries({
                queryKey: queryKeys.flows.version(variables.flowId, variables.versionNum),
            });
            // Invalidate the flow detail
            queryClient.invalidateQueries({
                queryKey: queryKeys.flows.detail(variables.flowId),
            });
        },
    });
}

/**
 * Mutation hook for publishing a flow version
 */
export function usePublishFlowVersion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ flowId, versionNum }: { flowId: string; versionNum: number }) =>
            publishFlowVersion(flowId, versionNum),
        onSuccess: () => {
            // Invalidate all flow queries
            queryClient.invalidateQueries({ queryKey: queryKeys.flows.all });
        },
    });
}

/**
 * Mutation hook for forking a flow version (create new draft from existing)
 */
export function useForkFlowVersion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ flowId, versionNum }: { flowId: string; versionNum: number }) =>
            forkFlowVersion(flowId, versionNum),
        onSuccess: (_, variables) => {
            // Invalidate the flow detail to show new version
            queryClient.invalidateQueries({
                queryKey: queryKeys.flows.detail(variables.flowId),
            });
            // Invalidate lists
            queryClient.invalidateQueries({ queryKey: queryKeys.flows.lists() });
        },
    });
}

// Type exports for consumers
export type {
    FlowDefinitionListItem,
    FlowDefinition,
    FlowDefinitionCreate,
    FlowVersion,
    FlowVersionUpdate,
};
