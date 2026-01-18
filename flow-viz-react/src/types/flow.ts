// ==================== FIRST FLOW TYPES ====================
// Configuration-driven flow model for Phase 3 lane-based UI

import type { LocalizedString, NodeStatus } from './scenario';

// ==================== BUFFER CONFIG ====================

/** Lot type enum matching database schema */
export type FlowLotType = 'RAW' | 'DEB' | 'BULK' | 'MIX' | 'SKW' | 'FRZ' | 'FG';

/** Buffer configuration for lane rendering */
export interface BufferConfig {
    id: string;
    name: LocalizedString;
    tempRange: string;
    lotType: FlowLotType;
    color: string;
}

// ==================== LOT DATA ====================

/** Lot card data for rendering */
export interface FlowLot {
    id: string;
    code: string;
    description: LocalizedString;
    weight_kg?: number;
    quantity?: number;
    temperature_c?: number;
    qcStatus: NodeStatus;
    bufferId: string;
}

// ==================== QC GATE ====================

/** QC Gate for stepper */
export interface FlowGate {
    id: number | string;
    name: LocalizedString;
    isActive: boolean;
    isCompleted: boolean;
}

// ==================== CONFIG AGGREGATE ====================

/** First Flow configuration (loaded from JSON) */
export interface FirstFlowConfig {
    buffers: Record<string, BufferConfig>;
    lots: FlowLot[];
    gates: FlowGate[];
}

// ==================== TEMPERATURE STATUS ====================

/** Temperature status for badge coloring */
export type TempStatus = 'ok' | 'warning' | 'critical';

/**
 * Determine temperature status based on buffer type.
 * - Frozen (FRZ): -25°C to -18°C = ok, > -18°C to -10°C = warning, else critical
 * - Chilled: 0°C to 4°C = ok, > 4°C to 7°C = warning, else critical
 */
export function getTempStatus(temp: number, bufferType: string): TempStatus {
    if (bufferType === 'FRZ') {
        // Frozen: -25°C to -18°C
        if (temp >= -25 && temp <= -18) return 'ok';
        if (temp > -18 && temp <= -10) return 'warning';
        return 'critical';
    }
    // Chilled: 0°C to 4°C
    if (temp >= 0 && temp <= 4) return 'ok';
    if (temp > 4 && temp <= 7) return 'warning';
    return 'critical';
}
