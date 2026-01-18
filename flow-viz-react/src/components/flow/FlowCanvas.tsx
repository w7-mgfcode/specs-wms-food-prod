import type { StreamConfig, PhaseConfig, ThemeConfig, Language, NodeStatus } from '../../types/scenario'
import { StreamNode } from './StreamNode'
import { Connector } from './Connector'
import { useUIStore } from '../../stores/useUIStore'
import { useProductionStore } from '../../stores/useProductionStore'

interface FlowCanvasProps {
    streams?: Record<string, StreamConfig>
    phases?: PhaseConfig[]
    currentPhase?: number
    theme?: ThemeConfig
    lang?: Language
}

export function FlowCanvas({
    streams: propsStreams,
    phases: propsPhases,
    currentPhase: propsCurrentPhase,
    theme: propsTheme,
    lang: propsLang,
}: FlowCanvasProps = {}) {
    const { scenario, currentPhase: storePhase } = useProductionStore();
    const { language: storeLang } = useUIStore();

    // Fallback to store values if not provided via props
    const streams = propsStreams || scenario?.streams || {};
    const phases = propsPhases || scenario?.phases || [];
    const currentPhase = propsCurrentPhase ?? storePhase ?? 0;
    const theme = propsTheme || scenario?.meta.theme || { streamColors: { A: '#fff', B: '#fff', C: '#fff' }, statusColors: {} as any };
    const lang = propsLang || storeLang || 'en';

    const getStreamColor = (streamId: string): string => {
        const colors = theme.streamColors as Record<string, string>
        return colors[streamId] || '#4a9eff'
    }

    const getNodeStatus = (phaseId: number): NodeStatus => {
        if (phaseId < currentPhase) return 'pass'
        if (phaseId === currentPhase) return 'processing'
        return 'pending'
    }

    return (
        <div className="glass-card p-8 overflow-x-auto h-full">
            <div className="min-w-[1000px] space-y-8">
                {Object.entries(streams).map(([streamId, stream]) => {
                    const color = getStreamColor(streamId)
                    const streamName = stream.name[lang]

                    return (
                        <div key={streamId} className="space-y-4">
                            {/* Stream Header */}
                            <div className="flex items-center gap-4">
                                <div
                                    className="text-sm font-semibold px-4 py-2 rounded-md min-w-[220px]"
                                    style={{
                                        background: `${color}20`,
                                        border: `1px solid ${color}`,
                                        color: color,
                                    }}
                                >
                                    {streamName}
                                </div>
                            </div>

                            {/* Stream Nodes */}
                            <div className="flex items-center gap-4 pl-[60px]">
                                {stream.nodes.map((node, idx) => {
                                    const phase = phases.find((p) => p.id == node.phase || p.phase_number == node.phase)
                                    if (!phase) return null

                                    const phaseNum = phase.phase_number || phase.id || node.phase;
                                    const isActive = currentPhase === phaseNum
                                    const isCompleted = currentPhase > phaseNum
                                    const status = getNodeStatus(phaseNum)
                                    const title = node.title[lang]
                                    const lotId = phase.lots[0]

                                    return (
                                        <div key={node.phase} className="flex items-center gap-4">
                                            {idx > 0 && (
                                                <Connector
                                                    isActive={isActive || isCompleted}
                                                    color={color}
                                                />
                                            )}
                                            <StreamNode
                                                title={title}
                                                lotId={lotId}
                                                qcGate={phase.qcGate}
                                                status={status}
                                                isActive={isActive}
                                                isCompleted={isCompleted}
                                                streamColor={color}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
