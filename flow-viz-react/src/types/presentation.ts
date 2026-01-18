export type SectionType =
    | 'paragraph'
    | 'code'
    | 'table'
    | 'list'
    | 'kv-pairs'
    | 'grid'
    | 'species-zones'
    | 'flow-phases'
    | 'qc-workflow'
    | 'status-grid'
    | 'qc-gate'
    | 'feature-grid'
    | 'api-endpoints'
    | 'alert'
    | 'group'
    | 'relational-schema'
    | 'traceability-flow'
    | 'compliance-rules'
    | 'packaging-widget'
    | 'freezing-widget'

export interface BaseSection {
    type: SectionType
    title?: string
    badge?: string
}

// ... (existing interfaces) ...

export interface RelationalSchemaSection extends BaseSection {
    type: 'relational-schema'
    content?: string
    tables: {
        title: string
        columns: string[]
        rows?: string[][]
    }[]
}

export interface TraceabilityFlowSection extends BaseSection {
    type: 'traceability-flow'
    content?: string
    variant: 'backward' | 'forward'
    nodes: {
        id: string
        label: string
        subLabel?: string
        status?: 'active' | 'passive' | 'highlight'
        icon?: 'box' | 'factory' | 'truck' | 'users'
    }[]
}

export interface GroupSection extends BaseSection {
    type: 'group'
    sections: SlideSection[]
}

export type SlideSection =
    | ParagraphSection
    | CodeSection
    | TableSection
    | ListSection
    | KVPairsSection
    | GridSection
    | SpeciesZonesSection
    | FlowPhasesSection
    | QCWorkflowSection
    | StatusGridSection
    | QCGateSection
    | FeatureGridSection
    | ApiEndpointSection
    | AlertSection
    | GroupSection
    | RelationalSchemaSection
    | TraceabilityFlowSection
    | ComplianceRulesSection
    | PackagingWidgetSection
    | FreezingWidgetSection

export interface ParagraphSection extends BaseSection {
    type: 'paragraph'
    content: string
}

export interface CodeSection extends BaseSection {
    type: 'code'
    content: string
    codeTitle?: string
}

export interface TableSection extends BaseSection {
    type: 'table'
    content?: string // Legacy fallback
    columns: string[]
    rows: string[][]
}

export interface ListSection extends BaseSection {
    type: 'list'
    content?: string
    items: string[]
}

export interface KVPairsSection extends BaseSection {
    type: 'kv-pairs'
    content?: string
    kvPairs: { key: string; value: string }[]
}

export interface GridSection extends BaseSection {
    type: 'grid'
    content?: string
    gridItems: { title: string; items: { key: string; value: string }[] }[]
}

export interface SpeciesZonesSection extends BaseSection {
    type: 'species-zones'
    content?: string
}

export interface FlowPhasesSection extends BaseSection {
    type: 'flow-phases'
    content?: string
}

export interface QCWorkflowSection extends BaseSection {
    type: 'qc-workflow'
    content?: string
    qcSteps: { title: string; desc: string; status: string }[]
}

export interface StatusGridSection extends BaseSection {
    type: 'status-grid'
    content?: string
    gridItems: { title: string; items: { key: string; value: string }[] }[]
}

export interface QCGateSection extends BaseSection {
    type: 'qc-gate'
    content?: string
    qcGate: {
        id: string
        title: string
        badge: string
        goal: string
        checklist: { icon: string; text: string }[]
        table: {
            headers: string[]
            rows: { prev: string; result: string; next: string; action: string; resultType: 'success' | 'warning' | 'danger' }[]
        }
    }
}

export interface FeatureGridSection extends BaseSection {
    type: 'feature-grid'
    content?: string
    featureGrid: {
        title: string
        badge: string
        features: { icon: string; title: string; desc: string }[]
    }
}

export interface ApiEndpointSection extends BaseSection {
    type: 'api-endpoints'
    content?: string
    apiEndpoints: {
        method: 'GET' | 'POST'
        url: string
        desc: string
        status?: 'high' | 'medium' | 'low'
        badge?: string
        badgeColor?: string
    }[]
}

export interface AlertSection extends BaseSection {
    type: 'alert'
    variant: 'warning' | 'info' | 'success' | 'warning-box' | 'success-box' | 'info-box' | 'audit-critical'
    content: string
}

export interface ComplianceRulesSection extends BaseSection {
    type: 'compliance-rules'
    complianceRules: {
        id: string
        title: string
        type: 'MANDATORY' | 'CCP' | 'AUDIT'
        shortDesc: string
        whyList?: string[]
        triggerCode?: string
        complianceQuery?: string
        viewCode?: string
    }[]
}

export interface PackagingWidgetSection extends BaseSection {
    type: 'packaging-widget'
}

export interface FreezingWidgetSection extends BaseSection {
    type: 'freezing-widget'
}



export interface Slide {
    id: number
    navTitle: string
    title: string
    badge?: { text: string; color: string }
    sections: SlideSection[]
}
