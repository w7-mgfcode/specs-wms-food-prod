import { SlideSection } from '../types/presentation'
import { CodeBlock } from './widgets/CodeBlock'
import { AlertBox } from './widgets/AlertBox'
import { QCGateCard } from './widgets/QCGateCard'
import { FeatureGrid } from './widgets/FeatureGrid'
import { ApiEndpointList } from './widgets/ApiEndpointList'
import { Table } from './widgets/Table'
import { SimpleList } from './widgets/SimpleList'
import { KVPairs } from './widgets/KVPairs'
import { Grid } from './widgets/Grid'
import { StatusGrid } from './widgets/StatusGrid'
import { FlowPhases } from './widgets/FlowPhases'
import { SpeciesZones } from './widgets/SpeciesZones'
import { QCWorkflow } from './widgets/QCWorkflow'
import { RelationalSchema, TraceabilityFlow } from './widgets/VisualTrace'
import { Paragraph } from './widgets/Paragraph'
import { ComplianceWidget } from './widgets/ComplianceWidget'
import { PackagingWidget } from './widgets/PackagingWidget'
import { FreezingWidget } from './widgets/FreezingWidget'

interface Props {
    section: SlideSection
    idx: number
}

export function SectionRenderer({ section, idx: _idx }: Props) {
    // Render Title unless it's a specific component that handles its own title
    const shouldRenderTitle = section.title &&
        !['list', 'kv-pairs', 'alert', 'feature-grid', 'qc-gate', 'api-endpoints', 'status-grid', 'grid', 'code', 'qc-workflow', 'relational-schema', 'traceability-flow'].includes(section.type)

    return (
        <div className="mb-6">
            {shouldRenderTitle && (
                <h3 className="text-xl font-semibold text-[var(--status-pass)] mb-3 mt-6" dangerouslySetInnerHTML={{ __html: section.title || '' }} />
            )}
            <ContentSwitch section={section} />
        </div>
    )
}

function ContentSwitch({ section }: { section: SlideSection }) {
    switch (section.type) {
        case 'paragraph': return <Paragraph section={section} />
        case 'code': return <CodeBlock section={section} />
        case 'table': return <Table section={section} />
        case 'list': return <SimpleList section={section} />
        case 'kv-pairs': return <KVPairs section={section} />
        case 'grid': return <Grid section={section} />
        case 'status-grid': return <StatusGrid section={section} />
        case 'species-zones': return <SpeciesZones />
        case 'flow-phases': return <FlowPhases />
        case 'qc-workflow': return <QCWorkflow section={section} />
        case 'qc-gate': return <QCGateCard section={section} />
        case 'feature-grid': return <FeatureGrid section={section} />
        case 'api-endpoints': return <ApiEndpointList section={section} />
        case 'alert': return <AlertBox section={section} />
        case 'relational-schema': return <RelationalSchema section={section} />
        case 'traceability-flow': return <TraceabilityFlow section={section} />
        case 'compliance-rules': return <ComplianceWidget rules={section.complianceRules || []} />
        case 'packaging-widget': return <PackagingWidget />
        case 'freezing-widget': return <FreezingWidget />
        case 'group':
            return (
                <div className="border-2 border-[var(--shell-border)] rounded-xl p-6 bg-[rgba(15,23,42,0.3)] my-6">
                    {section.title && (
                        <h4 className="text-xl font-bold text-[var(--color-accent-cyan)] mb-4 pb-2 border-b border-[var(--shell-border)]" dangerouslySetInnerHTML={{ __html: section.title }} />
                    )}
                    <div className="space-y-6">
                        {section.sections.map((subSection, i) => (
                            <SectionRenderer key={i} section={subSection} idx={i} />
                        ))}
                    </div>
                </div>
            )
        default: return null
    }
}
