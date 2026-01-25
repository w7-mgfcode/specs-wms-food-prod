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
    Trash2,
    X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { listFlowDefinitions, deleteFlowDefinition, type FlowDefinitionListItem } from '../../lib/api/flows';

export function FlowCatalogPage() {
    const navigate = useNavigate();
    const { language } = useUIStore();
    const { role } = useAuthStore();

    const [flows, setFlows] = useState<FlowDefinitionListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<FlowDefinitionListItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Can create flows: ADMIN, MANAGER, or OPERATOR
    const canCreate = role === 'ADMIN' || role === 'MANAGER' || role === 'OPERATOR';
    // Can delete flows: ADMIN or MANAGER only
    const canDelete = role === 'ADMIN' || role === 'MANAGER';

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

    // Handle delete click (show confirmation)
    const handleDeleteClick = useCallback(
        (e: React.MouseEvent, flow: FlowDefinitionListItem) => {
            e.stopPropagation(); // Prevent card click
            setDeleteTarget(flow);
        },
        []
    );

    // Handle delete confirmation
    const handleDeleteConfirm = useCallback(async () => {
        if (!deleteTarget) return;

        setIsDeleting(true);
        try {
            await deleteFlowDefinition(deleteTarget.id);
            setFlows((prev) => prev.filter((f) => f.id !== deleteTarget.id));
            setDeleteTarget(null);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : language === 'hu'
                        ? 'Hiba történt a törlés során'
                        : 'An error occurred while deleting'
            );
        } finally {
            setIsDeleting(false);
        }
    }, [deleteTarget, language]);

    // Handle delete cancel
    const handleDeleteCancel = useCallback(() => {
        setDeleteTarget(null);
    }, []);

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
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="text-sm font-semibold text-white truncate flex-1">
                                        {flow.name[language]}
                                    </h3>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {canDelete && (
                                            <button
                                                onClick={(e) => handleDeleteClick(e, flow)}
                                                className={cn(
                                                    'p-1 rounded hover:bg-red-500/20',
                                                    'text-gray-500 hover:text-red-400',
                                                    'transition-colors'
                                                )}
                                                title={language === 'hu' ? 'Törlés' : 'Delete'}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        <ChevronRight className="w-4 h-4 text-gray-500" />
                                    </div>
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

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60"
                        onClick={handleDeleteCancel}
                    />

                    {/* Modal */}
                    <div className="relative bg-[#1a1f3a] border border-white/10 rounded-lg shadow-xl max-w-md w-full mx-4">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <h3 className="text-lg font-semibold text-white">
                                {language === 'hu' ? 'Folyamat törlése' : 'Delete Flow'}
                            </h3>
                            <button
                                onClick={handleDeleteCancel}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4">
                            <p className="text-gray-300">
                                {language === 'hu'
                                    ? 'Biztosan törölni szeretnéd ezt a folyamatot? Ez a művelet nem vonható vissza.'
                                    : 'Are you sure you want to delete this flow? This action cannot be undone.'}
                            </p>
                            <div className="mt-3 p-3 bg-white/5 rounded-lg">
                                <div className="text-sm font-medium text-white">
                                    {deleteTarget.name[language]}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                    {deleteTarget.version_count}{' '}
                                    {language === 'hu' ? 'verzió' : 'version(s)'}
                                    {deleteTarget.published_version_num && (
                                        <span className="text-yellow-400 ml-2">
                                            {language === 'hu'
                                                ? '• Publikált verzió is törlődik!'
                                                : '• Published version will be deleted!'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
                            <button
                                onClick={handleDeleteCancel}
                                disabled={isDeleting}
                                className={cn(
                                    'px-4 py-2 rounded-lg text-sm',
                                    'bg-white/10 hover:bg-white/15 text-white',
                                    'transition-colors',
                                    'disabled:opacity-50'
                                )}
                            >
                                {language === 'hu' ? 'Mégse' : 'Cancel'}
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={isDeleting}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
                                    'bg-red-600 hover:bg-red-700 text-white',
                                    'transition-colors',
                                    'disabled:opacity-50'
                                )}
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {language === 'hu' ? 'Törlés...' : 'Deleting...'}
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        {language === 'hu' ? 'Törlés' : 'Delete'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
