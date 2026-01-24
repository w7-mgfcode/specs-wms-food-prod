/**
 * Flow Editor Page
 *
 * The main editor page combining palette, canvas, and properties panel.
 */

import { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Save,
    Upload,
    ArrowLeft,
    Loader2,
    AlertCircle,
    Check,
    FileText,
} from 'lucide-react';
import { ReactFlowProvider } from '@xyflow/react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFlowEditorStore } from '../../stores/useFlowEditorStore';
import { NodePalette } from './NodePalette';
import { FlowCanvas } from './FlowCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import type { FlowNodeType } from '../../types/flowEditor';

export function FlowEditorPage() {
    const { flowId, versionNum } = useParams<{ flowId: string; versionNum?: string }>();
    const navigate = useNavigate();
    const { language } = useUIStore();
    const { role } = useAuthStore();
    const [_draggedType, setDraggedType] = useState<FlowNodeType | null>(null);

    const {
        flowDefinition,
        currentVersion,
        isDirty,
        isLoading,
        isSaving,
        error,
        loadFlow,
        createFlow,
        saveFlow,
        publishFlow,
        resetEditor,
    } = useFlowEditorStore();

    // Can publish: ADMIN or MANAGER
    const canPublish = role === 'ADMIN' || role === 'MANAGER';
    const isReadOnly = currentVersion?.status !== 'DRAFT';

    // Load flow on mount
    useEffect(() => {
        if (flowId === 'new') {
            // Create a new flow
            createFlow(
                { hu: 'Új folyamat', en: 'New Flow' },
                undefined
            ).then((newId) => {
                navigate(`/flow-editor/${newId}`, { replace: true });
            }).catch(() => {
                // Error handled by store
            });
        } else if (flowId) {
            loadFlow(flowId, versionNum ? parseInt(versionNum, 10) : undefined);
        }

        return () => {
            resetEditor();
        };
    }, [flowId, versionNum, loadFlow, createFlow, resetEditor, navigate]);

    // Handle drag start from palette
    const handleDragStart = useCallback((_event: React.DragEvent, nodeType: FlowNodeType) => {
        setDraggedType(nodeType);
    }, []);

    // Handle drag over canvas
    const handleDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    // Handle drop on canvas
    const handleDrop = useCallback(() => {
        setDraggedType(null);
    }, []);

    // Handle manual save
    const handleSave = useCallback(() => {
        saveFlow();
    }, [saveFlow]);

    // Handle publish
    const handlePublish = useCallback(() => {
        if (!canPublish) return;
        publishFlow();
    }, [canPublish, publishFlow]);

    // Handle back navigation
    const handleBack = useCallback(() => {
        if (isDirty) {
            const confirmLeave = window.confirm(
                language === 'hu'
                    ? 'Mentetlen változtatásaid vannak. Biztosan el akarod hagyni az oldalt?'
                    : 'You have unsaved changes. Are you sure you want to leave?'
            );
            if (!confirmLeave) return;
        }
        navigate('/flow-editor');
    }, [isDirty, language, navigate]);

    // Loading state
    if (isLoading && !flowDefinition) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    // Error state
    if (error && !flowDefinition) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <div className="text-white text-center">
                    <div className="font-semibold">
                        {language === 'hu' ? 'Hiba történt' : 'An error occurred'}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">{error}</div>
                </div>
                <button
                    onClick={handleBack}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                    {language === 'hu' ? 'Vissza' : 'Go Back'}
                </button>
            </div>
        );
    }

    return (
        <ReactFlowProvider>
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-[rgba(26,31,58,0.95)] border-b border-white/10">
                    {/* Left: Back + Title */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleBack}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            title={language === 'hu' ? 'Vissza' : 'Back'}
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-400" />
                        </button>
                        <div>
                            <h1 className="text-lg font-semibold text-white">
                                {flowDefinition?.name[language] || (language === 'hu' ? 'Folyamat szerkesztő' : 'Flow Editor')}
                            </h1>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                {currentVersion && (
                                    <>
                                        <span>v{currentVersion.version_num}</span>
                                        <span
                                            className={cn(
                                                'px-1.5 py-0.5 rounded text-[10px] font-medium',
                                                currentVersion.status === 'DRAFT'
                                                    ? 'bg-yellow-500/20 text-yellow-400'
                                                    : 'bg-green-500/20 text-green-400'
                                            )}
                                        >
                                            {currentVersion.status}
                                        </span>
                                    </>
                                )}
                                {isDirty && (
                                    <span className="text-yellow-400">
                                        {language === 'hu' ? '• Módosítva' : '• Modified'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                        {/* Save Status Indicator */}
                        {isSaving ? (
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {language === 'hu' ? 'Mentés...' : 'Saving...'}
                            </div>
                        ) : isDirty ? null : (
                            <div className="flex items-center gap-1 text-xs text-green-400">
                                <Check className="w-3 h-3" />
                                {language === 'hu' ? 'Mentve' : 'Saved'}
                            </div>
                        )}

                        {/* Save Button */}
                        {!isReadOnly && (
                            <button
                                onClick={handleSave}
                                disabled={!isDirty || isSaving}
                                className={cn(
                                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                                    'bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.15)]',
                                    'text-white transition-colors',
                                    'disabled:opacity-50 disabled:cursor-not-allowed'
                                )}
                            >
                                <Save className="w-4 h-4" />
                                {language === 'hu' ? 'Mentés' : 'Save'}
                            </button>
                        )}

                        {/* Publish Button */}
                        {canPublish && !isReadOnly && (
                            <button
                                onClick={handlePublish}
                                disabled={isDirty || isLoading}
                                className={cn(
                                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                                    'bg-green-600 hover:bg-green-700',
                                    'text-white transition-colors',
                                    'disabled:opacity-50 disabled:cursor-not-allowed'
                                )}
                                title={
                                    isDirty
                                        ? language === 'hu'
                                            ? 'Először mentsd el a változtatásokat'
                                            : 'Save changes first'
                                        : undefined
                                }
                            >
                                <Upload className="w-4 h-4" />
                                {language === 'hu' ? 'Publikálás' : 'Publish'}
                            </button>
                        )}

                        {/* Version Selector */}
                        {flowDefinition && (
                            <button
                                onClick={() => navigate(`/flow-editor/${flowDefinition.id}/versions`)}
                                className={cn(
                                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                                    'bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.15)]',
                                    'text-white transition-colors'
                                )}
                            >
                                <FileText className="w-4 h-4" />
                                {language === 'hu' ? 'Verziók' : 'Versions'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Read-only Banner */}
                {isReadOnly && (
                    <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
                        <div className="flex items-center gap-2 text-sm text-yellow-400">
                            <AlertCircle className="w-4 h-4" />
                            {language === 'hu'
                                ? 'Ez egy publikált verzió. A szerkesztéshez hozz létre egy új piszkozatot.'
                                : 'This is a published version. Create a new draft to edit.'}
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Node Palette */}
                    {!isReadOnly && (
                        <NodePalette onDragStart={handleDragStart} />
                    )}

                    {/* Center: Canvas */}
                    <FlowCanvas
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    />

                    {/* Right: Properties Panel */}
                    <PropertiesPanel />
                </div>

                {/* Error Toast */}
                {error && flowDefinition && (
                    <div className="fixed bottom-4 right-4 px-4 py-3 bg-red-500/90 text-white rounded-lg shadow-lg">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            <span>{error}</span>
                        </div>
                    </div>
                )}
            </div>
        </ReactFlowProvider>
    );
}
