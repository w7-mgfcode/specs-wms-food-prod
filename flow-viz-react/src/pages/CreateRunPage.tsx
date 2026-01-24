/**
 * Create Run Page
 *
 * Page for creating a new production run from a published flow version.
 * Phase 8.5: Route Consolidation & UI Migration
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../stores/useUIStore';
import { listFlowDefinitions, getFlowVersion, FlowDefinitionListItem } from '../lib/api/flows';
import { createRun } from '../lib/api/runs';

interface FlowOption {
    flowId: string;
    name: string;
    description: string | null;
    publishedVersionNum: number;
}

export function CreateRunPage() {
    const navigate = useNavigate();
    const { language } = useUIStore();

    const [flows, setFlows] = useState<FlowOption[]>([]);
    const [selectedFlowId, setSelectedFlowId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchFlows = async () => {
            try {
                const data = await listFlowDefinitions();
                // Filter to only flows with published versions and map to simpler structure
                const publishedFlows: FlowOption[] = data
                    .filter((f): f is FlowDefinitionListItem & { published_version_num: number } =>
                        f.published_version_num !== null
                    )
                    .map((f) => {
                        let name = '';
                        if (typeof f.name === 'object' && f.name !== null) {
                            const nameObj = f.name as { hu?: string; en?: string };
                            name = nameObj[language] || nameObj.en || nameObj.hu || '';
                        } else {
                            name = String(f.name);
                        }
                        return {
                            flowId: f.id,
                            name,
                            description: f.description,
                            publishedVersionNum: f.published_version_num,
                        };
                    });
                setFlows(publishedFlows);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load flows');
            } finally {
                setIsLoading(false);
            }
        };
        fetchFlows();
    }, [language]);

    const handleCreate = async () => {
        const selectedFlow = flows.find((f) => f.flowId === selectedFlowId);
        if (!selectedFlow) return;

        setIsCreating(true);
        setError(null);
        try {
            // Get the published version to get its ID
            const version = await getFlowVersion(selectedFlow.flowId, selectedFlow.publishedVersionNum);
            const run = await createRun({ flow_version_id: version.id });
            navigate(`/command/run/${run.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create run');
            setIsCreating(false);
        }
    };

    const handleBack = () => {
        navigate('/command');
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 bg-[rgba(26,31,58,0.95)] border-b border-white/10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleBack}
                        className="p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                    >
                        <span className="text-xl">&larr;</span>
                    </button>
                    <div>
                        <h1 className="text-xl font-semibold text-white">
                            {language === 'hu' ? 'Új futtatás' : 'New Run'}
                        </h1>
                        <p className="text-sm text-gray-400 mt-1">
                            {language === 'hu'
                                ? 'Válasszon egy közzétett folyamatot'
                                : 'Select a published flow'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : error ? (
                    <div className="text-red-400 text-center">{error}</div>
                ) : flows.length === 0 ? (
                    <div className="text-center">
                        <p className="text-gray-400">
                            {language === 'hu'
                                ? 'Nincsenek közzétett folyamatok'
                                : 'No published flows available'}
                        </p>
                        <button
                            onClick={() => navigate('/flow-editor')}
                            className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                        >
                            {language === 'hu' ? 'Folyamat szerkesztő' : 'Go to Flow Editor'}
                        </button>
                    </div>
                ) : (
                    <div className="max-w-2xl mx-auto">
                        <div className="space-y-4">
                            {flows.map((flow) => {
                                const isSelected = selectedFlowId === flow.flowId;
                                return (
                                    <div
                                        key={flow.flowId}
                                        onClick={() => setSelectedFlowId(flow.flowId)}
                                        className={`p-4 rounded-lg cursor-pointer border transition-all ${
                                            isSelected
                                                ? 'bg-blue-500/20 border-blue-500'
                                                : 'bg-[rgba(26,31,58,0.95)] border-white/10 hover:border-white/20'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-white font-medium">
                                                    {flow.name}
                                                </h3>
                                                {flow.description && (
                                                    <p className="text-sm text-gray-400 mt-1">
                                                        {flow.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs text-gray-400">
                                                    v{flow.publishedVersionNum}
                                                </span>
                                                {isSelected && (
                                                    <span className="ml-2 text-blue-400">
                                                        &#10003;
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Create Button */}
                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={handleCreate}
                                disabled={!selectedFlowId || isCreating}
                                className="px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isCreating
                                    ? language === 'hu'
                                        ? 'Létrehozás...'
                                        : 'Creating...'
                                    : language === 'hu'
                                      ? 'Futtatás létrehozása'
                                      : 'Create Run'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
