/**
 * Flow Catalog Page
 *
 * Grid view of all flow definitions with version info.
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Loader2,
    AlertCircle,
    FileText,
    Clock,
    User,
    ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { listFlowDefinitions, type FlowDefinitionListItem } from '../../lib/api/flows';

export function FlowCatalogPage() {
    const navigate = useNavigate();
    const { language } = useUIStore();
    const { role } = useAuthStore();

    const [flows, setFlows] = useState<FlowDefinitionListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Can create flows: ADMIN, MANAGER, or OPERATOR
    const canCreate = role === 'ADMIN' || role === 'MANAGER' || role === 'OPERATOR';

    // Load flows on mount
    useEffect(() => {
        async function loadFlows() {
            try {
                setIsLoading(true);
                setError(null);
                const data = await listFlowDefinitions();
                setFlows(data);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : language === 'hu'
                            ? 'Hiba történt a betöltés során'
                            : 'An error occurred while loading'
                );
            } finally {
                setIsLoading(false);
            }
        }

        loadFlows();
    }, [language]);

    // Handle create new flow
    const handleCreate = useCallback(() => {
        navigate('/flow-editor/new');
    }, [navigate]);

    // Handle open flow
    const handleOpen = useCallback(
        (flowId: string) => {
            navigate(`/flow-editor/${flowId}`);
        },
        [navigate]
    );

    // Format date
    const formatDate = useCallback(
        (dateString: string) => {
            const date = new Date(dateString);
            return date.toLocaleDateString(language === 'hu' ? 'hu-HU' : 'en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        },
        [language]
    );

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <div className="text-white text-center">
                    <div className="font-semibold">
                        {language === 'hu' ? 'Hiba történt' : 'An error occurred'}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[rgba(26,31,58,0.95)] border-b border-white/10">
                <div>
                    <h1 className="text-xl font-semibold text-white">
                        {language === 'hu' ? 'Folyamat definíciók' : 'Flow Definitions'}
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        {language === 'hu'
                            ? 'Gyártási folyamatok kezelése'
                            : 'Manage production workflows'}
                    </p>
                </div>

                {canCreate && (
                    <button
                        onClick={handleCreate}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg',
                            'bg-blue-600 hover:bg-blue-700 text-white',
                            'transition-colors'
                        )}
                    >
                        <Plus className="w-4 h-4" />
                        {language === 'hu' ? 'Új folyamat' : 'New Flow'}
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {flows.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <FileText className="w-16 h-16 text-gray-600" />
                        <div className="text-center">
                            <div className="text-lg font-medium text-white">
                                {language === 'hu'
                                    ? 'Nincsenek folyamatok'
                                    : 'No flows yet'}
                            </div>
                            <p className="text-sm text-gray-400 mt-1">
                                {language === 'hu'
                                    ? 'Hozd létre az első folyamatot a kezdéshez'
                                    : 'Create your first flow to get started'}
                            </p>
                        </div>
                        {canCreate && (
                            <button
                                onClick={handleCreate}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-lg mt-2',
                                    'bg-blue-600 hover:bg-blue-700 text-white',
                                    'transition-colors'
                                )}
                            >
                                <Plus className="w-4 h-4" />
                                {language === 'hu' ? 'Új folyamat létrehozása' : 'Create New Flow'}
                            </button>
                        )}
                    </div>
                ) : (
                    /* Flow grid */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {flows.map((flow) => (
                            <div
                                key={flow.id}
                                onClick={() => handleOpen(flow.id)}
                                className={cn(
                                    'p-4 rounded-lg cursor-pointer',
                                    'bg-[rgba(26,31,58,0.95)] border border-white/10',
                                    'hover:border-white/20 hover:bg-[rgba(26,31,58,1)]',
                                    'transition-all duration-150'
                                )}
                            >
                                {/* Flow name */}
                                <div className="flex items-start justify-between">
                                    <h3 className="text-sm font-semibold text-white truncate flex-1">
                                        {flow.name[language]}
                                    </h3>
                                    <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                </div>

                                {/* Version info */}
                                <div className="mt-3 space-y-2">
                                    {/* Latest version */}
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-gray-400">
                                            {language === 'hu' ? 'Legújabb:' : 'Latest:'}
                                        </span>
                                        <span className="text-white">
                                            v{flow.latest_version_num}
                                        </span>
                                        <span
                                            className={cn(
                                                'px-1.5 py-0.5 rounded text-[10px] font-medium',
                                                flow.latest_version_status === 'DRAFT'
                                                    ? 'bg-yellow-500/20 text-yellow-400'
                                                    : flow.latest_version_status === 'PUBLISHED'
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : 'bg-gray-500/20 text-gray-400'
                                            )}
                                        >
                                            {flow.latest_version_status}
                                        </span>
                                    </div>

                                    {/* Published version */}
                                    {flow.published_version_num && (
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-gray-400">
                                                {language === 'hu' ? 'Publikált:' : 'Published:'}
                                            </span>
                                            <span className="text-green-400">
                                                v{flow.published_version_num}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Metadata */}
                                <div className="mt-4 pt-3 border-t border-white/5 space-y-1">
                                    {/* Updated at */}
                                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                        <Clock className="w-3 h-3" />
                                        <span>{formatDate(flow.updated_at)}</span>
                                    </div>

                                    {/* Created by */}
                                    {flow.created_by_name && (
                                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                            <User className="w-3 h-3" />
                                            <span>{flow.created_by_name}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
