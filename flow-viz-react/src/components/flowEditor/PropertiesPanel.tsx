/**
 * Properties Panel Component
 *
 * Right sidebar for editing selected node/edge properties.
 */

import { memo, useCallback } from 'react';
import { X, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/useUIStore';
import { useFlowEditorStore } from '../../stores/useFlowEditorStore';
import type { FlowNodeType } from '../../types/flowEditor';
import { NODE_COLORS } from '../../types/flowEditor';

function PropertiesPanelComponent() {
    const { language } = useUIStore();
    const {
        nodes,
        edges,
        selectedNodeId,
        selectedEdgeId,
        selectNode,
        selectEdge,
        updateNodeData,
        deleteNode,
    } = useFlowEditorStore();

    // Find selected item
    const selectedNode = selectedNodeId
        ? nodes.find((n) => n.id === selectedNodeId)
        : null;
    const selectedEdge = selectedEdgeId
        ? edges.find((e) => e.id === selectedEdgeId)
        : null;

    const handleClose = useCallback(() => {
        selectNode(null);
        selectEdge(null);
    }, [selectNode, selectEdge]);

    const handleLabelChange = useCallback(
        (lang: 'hu' | 'en', value: string) => {
            if (!selectedNode) return;
            updateNodeData(selectedNode.id, {
                label: { ...selectedNode.data.label, [lang]: value },
            });
        },
        [selectedNode, updateNodeData]
    );

    const handleConfigChange = useCallback(
        (key: string, value: unknown) => {
            if (!selectedNode) return;
            updateNodeData(selectedNode.id, {
                config: { ...selectedNode.data.config, [key]: value },
            });
        },
        [selectedNode, updateNodeData]
    );

    const handleDelete = useCallback(() => {
        if (selectedNode) {
            deleteNode(selectedNode.id);
        }
    }, [selectedNode, deleteNode]);

    // Nothing selected
    if (!selectedNode && !selectedEdge) {
        return (
            <div className="w-64 bg-[rgba(26,31,58,0.95)] border-l border-white/10 p-4">
                <div className="text-sm text-gray-400 text-center">
                    {language === 'hu'
                        ? 'Válassz egy csomópontot vagy élt a szerkesztéshez'
                        : 'Select a node or edge to edit'}
                </div>
            </div>
        );
    }

    // Edge selected
    if (selectedEdge) {
        return (
            <div className="w-64 bg-[rgba(26,31,58,0.95)] border-l border-white/10">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">
                        {language === 'hu' ? 'Él tulajdonságai' : 'Edge Properties'}
                    </h3>
                    <button
                        onClick={handleClose}
                        className="p-1 hover:bg-white/10 rounded"
                    >
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                </div>
                <div className="p-4">
                    <div className="text-xs text-gray-400">
                        <div>
                            {language === 'hu' ? 'Forrás' : 'Source'}: {selectedEdge.source}
                        </div>
                        <div className="mt-1">
                            {language === 'hu' ? 'Cél' : 'Target'}: {selectedEdge.target}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Node selected
    const nodeType = selectedNode!.data.nodeType as FlowNodeType;
    const color = NODE_COLORS[nodeType] || '#6b7280';

    return (
        <div className="w-64 bg-[rgba(26,31,58,0.95)] border-l border-white/10">
            {/* Header */}
            <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: color }}
                        />
                        <h3 className="text-sm font-semibold text-white">
                            {language === 'hu' ? 'Tulajdonságok' : 'Properties'}
                        </h3>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1 hover:bg-white/10 rounded"
                    >
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                </div>
                <div className="text-[10px] text-gray-400 uppercase mt-1">
                    {nodeType.replace('_', ' ')}
                </div>
            </div>

            {/* Form */}
            <div className="p-4 space-y-4">
                {/* Hungarian Label */}
                <div>
                    <label className="block text-xs text-gray-400 mb-1">
                        {language === 'hu' ? 'Címke (magyar)' : 'Label (Hungarian)'}
                    </label>
                    <input
                        type="text"
                        value={selectedNode!.data.label.hu}
                        onChange={(e) => handleLabelChange('hu', e.target.value)}
                        className={cn(
                            'w-full px-3 py-2 rounded-lg text-sm',
                            'bg-[rgba(255,255,255,0.05)] border border-white/10',
                            'text-white placeholder-gray-500',
                            'focus:outline-none focus:border-white/30'
                        )}
                    />
                </div>

                {/* English Label */}
                <div>
                    <label className="block text-xs text-gray-400 mb-1">
                        {language === 'hu' ? 'Címke (angol)' : 'Label (English)'}
                    </label>
                    <input
                        type="text"
                        value={selectedNode!.data.label.en}
                        onChange={(e) => handleLabelChange('en', e.target.value)}
                        className={cn(
                            'w-full px-3 py-2 rounded-lg text-sm',
                            'bg-[rgba(255,255,255,0.05)] border border-white/10',
                            'text-white placeholder-gray-500',
                            'focus:outline-none focus:border-white/30'
                        )}
                    />
                </div>

                {/* QC Gate specific: CCP toggle */}
                {nodeType === 'qc_gate' && (
                    <div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedNode!.data.config?.isCCP === true}
                                onChange={(e) =>
                                    handleConfigChange('isCCP', e.target.checked)
                                }
                                className="w-4 h-4 rounded"
                            />
                            <span className="text-sm text-white">
                                {language === 'hu'
                                    ? 'Kritikus Ellenőrzési Pont (CCP)'
                                    : 'Critical Control Point (CCP)'}
                            </span>
                        </label>
                        <p className="text-[10px] text-gray-400 mt-1 ml-6">
                            {language === 'hu'
                                ? 'HACCP követelmény: hőmérséklet naplózás'
                                : 'HACCP requirement: temperature logging'}
                        </p>
                    </div>
                )}

                {/* Node ID (read-only) */}
                <div>
                    <label className="block text-xs text-gray-400 mb-1">
                        {language === 'hu' ? 'Azonosító' : 'ID'}
                    </label>
                    <div className="text-xs text-gray-500 font-mono">
                        {selectedNode!.id}
                    </div>
                </div>
            </div>

            {/* Delete Button */}
            <div className="p-4 border-t border-white/10">
                <button
                    onClick={handleDelete}
                    className={cn(
                        'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg',
                        'bg-red-500/10 hover:bg-red-500/20 text-red-400',
                        'transition-colors'
                    )}
                >
                    <Trash2 className="w-4 h-4" />
                    {language === 'hu' ? 'Törlés' : 'Delete'}
                </button>
            </div>
        </div>
    );
}

export const PropertiesPanel = memo(PropertiesPanelComponent);
