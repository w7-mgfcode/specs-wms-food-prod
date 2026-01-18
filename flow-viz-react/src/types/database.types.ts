export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string
                    email: string
                    full_name: string | null
                    role: 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'OPERATOR' | 'VIEWER'
                    created_at: string
                    last_login: string | null
                }
                Insert: {
                    id: string
                    email: string
                    full_name?: string | null
                    role?: 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'OPERATOR' | 'VIEWER'
                    created_at?: string
                    last_login?: string | null
                }
                Update: {
                    id?: string
                    email?: string
                    full_name?: string | null
                    role?: 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'OPERATOR' | 'VIEWER'
                    created_at?: string
                    last_login?: string | null
                }
            }
            scenarios: {
                Row: {
                    id: string
                    name: Json
                    version: string
                    config: Json
                    i18n: Json
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: Json
                    version: string
                    config?: Json
                    i18n?: Json
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: Json
                    version?: string
                    config?: Json
                    i18n?: Json
                    is_active?: boolean
                    created_at?: string
                }
            }
            streams: {
                Row: {
                    id: string
                    scenario_id: string | null
                    stream_key: string
                    name: Json
                    color: string
                    sort_order: number
                }
                Insert: {
                    id?: string
                    scenario_id?: string | null
                    stream_key: string
                    name: Json
                    color: string
                    sort_order: number
                }
                Update: {
                    id?: string
                    scenario_id?: string | null
                    stream_key?: string
                    name?: Json
                    color?: string
                    sort_order?: number
                }
            }
            phases: {
                Row: {
                    id: string
                    scenario_id: string | null
                    stream_id: string | null
                    qc_gate_id: string | null
                    phase_number: number
                    name: Json
                    description: Json
                }
                Insert: {
                    id?: string
                    scenario_id?: string | null
                    stream_id?: string | null
                    qc_gate_id?: string | null
                    phase_number: number
                    name: Json
                    description: Json
                }
                Update: {
                    id?: string
                    scenario_id?: string | null
                    stream_id?: string | null
                    qc_gate_id?: string | null
                    phase_number?: number
                    name?: Json
                    description?: Json
                }
            }
            qc_gates: {
                Row: {
                    id: string
                    scenario_id: string | null
                    gate_number: number
                    name: Json
                    gate_type: 'CHECKPOINT' | 'BLOCKING' | 'INFO' | null
                    is_ccp: boolean
                    checklist: Json
                }
                Insert: {
                    id?: string
                    scenario_id?: string | null
                    gate_number: number
                    name: Json
                    gate_type?: 'CHECKPOINT' | 'BLOCKING' | 'INFO' | null
                    is_ccp?: boolean
                    checklist?: Json
                }
                Update: {
                    id?: string
                    scenario_id?: string | null
                    gate_number?: number
                    name?: Json
                    gate_type?: 'CHECKPOINT' | 'BLOCKING' | 'INFO' | null
                    is_ccp?: boolean
                    checklist?: Json
                }
            }
            production_runs: {
                Row: {
                    id: string
                    run_code: string
                    scenario_id: string | null
                    operator_id: string | null
                    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
                    daily_target_kg: number | null
                    started_at: string
                    ended_at: string | null
                    summary: Json | null
                }
                Insert: {
                    id?: string
                    run_code: string
                    scenario_id?: string | null
                    operator_id?: string | null
                    status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
                    daily_target_kg?: number | null
                    started_at?: string
                    ended_at?: string | null
                    summary?: Json | null
                }
                Update: {
                    id?: string
                    run_code?: string
                    scenario_id?: string | null
                    operator_id?: string | null
                    status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
                    daily_target_kg?: number | null
                    started_at?: string
                    ended_at?: string | null
                    summary?: Json | null
                }
            }
            lots: {
                Row: {
                    id: string
                    lot_code: string
                    lot_type: 'RAW' | 'DEB' | 'BULK' | 'MIX' | 'SKW' | 'FRZ' | 'FG'
                    production_run_id: string | null
                    phase_id: string | null
                    operator_id: string | null
                    weight_kg: number | null
                    temperature_c: number | null
                    metadata: Json
                    created_at: string
                }
                Insert: {
                    id?: string
                    lot_code: string
                    lot_type: 'RAW' | 'DEB' | 'BULK' | 'MIX' | 'SKW' | 'FRZ' | 'FG'
                    production_run_id?: string | null
                    phase_id?: string | null
                    operator_id?: string | null
                    weight_kg?: number | null
                    temperature_c?: number | null
                    metadata?: Json
                    created_at?: string
                }
                Update: {
                    id?: string
                    lot_code?: string
                    lot_type?: 'RAW' | 'DEB' | 'BULK' | 'MIX' | 'SKW' | 'FRZ' | 'FG'
                    production_run_id?: string | null
                    phase_id?: string | null
                    operator_id?: string | null
                    weight_kg?: number | null
                    temperature_c?: number | null
                    metadata?: Json
                    created_at?: string
                }
            }
            lot_genealogy: {
                Row: {
                    id: string
                    parent_lot_id: string | null
                    child_lot_id: string | null
                    quantity_used_kg: number | null
                    linked_at: string
                }
                Insert: {
                    id?: string
                    parent_lot_id?: string | null
                    child_lot_id?: string | null
                    quantity_used_kg?: number | null
                    linked_at?: string
                }
                Update: {
                    id?: string
                    parent_lot_id?: string | null
                    child_lot_id?: string | null
                    quantity_used_kg?: number | null
                    linked_at?: string
                }
            }
            qc_decisions: {
                Row: {
                    id: string
                    lot_id: string | null
                    qc_gate_id: string | null
                    operator_id: string | null
                    decision: 'PASS' | 'HOLD' | 'FAIL' | null
                    notes: string | null
                    temperature_c: number | null
                    digital_signature: string | null
                    decided_at: string
                }
                Insert: {
                    id?: string
                    lot_id?: string | null
                    qc_gate_id?: string | null
                    operator_id?: string | null
                    decision?: 'PASS' | 'HOLD' | 'FAIL' | null
                    notes?: string | null
                    temperature_c?: number | null
                    digital_signature?: string | null
                    decided_at?: string
                }
                Update: {
                    id?: string
                    lot_id?: string | null
                    qc_gate_id?: string | null
                    operator_id?: string | null
                    decision?: 'PASS' | 'HOLD' | 'FAIL' | null
                    notes?: string | null
                    temperature_c?: number | null
                    digital_signature?: string | null
                    decided_at?: string
                }
            }
        }
    }
}
