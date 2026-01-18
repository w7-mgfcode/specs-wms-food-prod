// ==================== SCENARIO CONFIG ====================

export interface ScenarioConfig {
    meta: ScenarioMeta;
    i18n: I18nConfig;
    streams: Record<string, StreamConfig>;
    phases: PhaseConfig[];
    config: SystemConfig;
    stats?: StatConfig[];
    sqlQueries?: SQLQuery[];
    qc_gates?: any[]; // Added for database compatibility
}

// ==================== META ====================

export interface ScenarioMeta {
    id: string;
    version: string;
    title: LocalizedString;
    subtitle: LocalizedString;
    theme: ThemeConfig;
}

export interface ThemeConfig {
    streamColors: {
        A: string;
        B: string;
        C: string;
    };
    statusColors: {
        pass: string;
        hold: string;
        fail: string;
        processing: string;
        pending: string;
    };
}

// ==================== LOCALIZATION ====================

export type Language = 'hu' | 'en';

export interface LocalizedString {
    hu: string;
    en: string;
}

export interface I18nConfig {
    headerTitle: LocalizedString;
    headerSubtitle: LocalizedString;
    tabs: {
        flow: LocalizedString;
        config: LocalizedString;
        trace: LocalizedString;
        sql: LocalizedString;
    };
    buttons: {
        prev: LocalizedString;
        next: LocalizedString;
        auto: LocalizedString;
        reset: LocalizedString;
        copy: LocalizedString;
        copied: LocalizedString;
    };
    labels: {
        qcGate: LocalizedString;
        lots: LocalizedString;
    };
}

// ==================== STREAMS & PHASES ====================

export interface StreamConfig {
    name: LocalizedString;
    nodes: StreamNode[];
}

export interface StreamNode {
    phase: number;
    title: LocalizedString;
}

export interface PhaseConfig {
    id: any; // update to support string UUIDs from DB
    phase_number?: number; // DB alias
    name: LocalizedString;
    desc: LocalizedString;
    qcGate: number | null;
    qc_gate_id?: string; // DB alias
    lots: string[];
    stream: 'A' | 'B' | 'C' | null;
}

// ==================== SYSTEM CONFIG ====================

export interface SystemConfig {
    operational: OperationalConfig;
    hardRules: HardRule[];
    qcGates: QCGate[];
    temps: TempConfig;
}

export interface OperationalConfig {
    mode: LocalizedString;
    shift: LocalizedString;
    throughput: LocalizedString;
    product: LocalizedString;
    skus: LocalizedString;
    target: LocalizedString;
}

export interface HardRule {
    num: number;
    text: LocalizedString;
    id?: string;
}

export interface QCGate {
    id: number | string;
    gate_number?: number;
    name: LocalizedString;
    type: string;
}

export interface TempConfig {
    rawProcessing: LocalizedString;
    freezerCabin: LocalizedString;
    coreTemp: LocalizedString;
}

// ==================== STATS ====================

export interface StatConfig {
    icon: string;
    label: LocalizedString;
    value: string | number;
    unit?: string;
    color?: string;
}

// ==================== SQL QUERIES ====================

export interface SQLQuery {
    id: number;
    title: LocalizedString;
    desc: LocalizedString;
    query: string;
}

// ==================== NODE STATUS ====================

export type NodeStatus = 'pass' | 'processing' | 'pending' | 'hold' | 'fail';

