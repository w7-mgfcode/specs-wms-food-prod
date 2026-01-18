import { supabase } from './supabase';
import type { Database } from '../types/database.types';

type Lot = Database['public']['Tables']['lots']['Row'];
type LotInsert = Database['public']['Tables']['lots']['Insert'];
type QCDecision = Database['public']['Tables']['qc_decisions']['Row'];
type QCDecisionInsert = Database['public']['Tables']['qc_decisions']['Insert'];

export interface DatabaseAdapter {
    registerLot: (lot: LotInsert) => Promise<Lot | null>;
    addQCDecision: (decision: QCDecisionInsert) => Promise<QCDecision | null>;
    // Add other methods as needed
}

class SupabaseAdapter implements DatabaseAdapter {
    async registerLot(lot: LotInsert) {
        if (!supabase) return null;
        // Cast to any to bypass strict type inference issues with generated types
        const { data, error } = await supabase.from('lots').insert(lot as any).select().single();
        if (error) {
            console.error('Supabase Error:', error);
            throw error;
        }
        return data;
    }

    async addQCDecision(decision: QCDecisionInsert) {
        if (!supabase) return null;
        const { data, error } = await supabase.from('qc_decisions').insert(decision as any).select().single();
        if (error) {
            console.error('Supabase Error:', error);
            throw error;
        }
        return data;
    }
}

class PostgresAdapter implements DatabaseAdapter {
    private baseUrl = '/api'; // Proxied by Nginx

    async registerLot(lot: LotInsert) {
        try {
            const response = await fetch(`${this.baseUrl}/lots`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lot)
            });
            if (!response.ok) throw new Error('Failed to register lot');
            return await response.json();
        } catch (e) {
            console.error('Postgres Adapter Error:', e);
            throw e;
        }
    }

    async addQCDecision(decision: QCDecisionInsert) {
        try {
            const response = await fetch(`${this.baseUrl}/qc-decisions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(decision)
            });
            if (!response.ok) throw new Error('Failed to record QC decision');
            return await response.json();
        } catch (e) {
            console.error('Postgres Adapter Error:', e);
            throw e;
        }
    }
}

class MockAdapter implements DatabaseAdapter {
    async registerLot(lot: LotInsert) {
        console.log('Mock DB: Registered Lot', lot);
        return { ...lot, id: crypto.randomUUID(), created_at: new Date().toISOString() } as unknown as Lot;
    }

    async addQCDecision(decision: QCDecisionInsert) {
        console.log('Mock DB: Recorded Decision', decision);
        return { ...decision, id: crypto.randomUUID(), decided_at: new Date().toISOString() } as unknown as QCDecision;
    }
}

const dbMode = import.meta.env.VITE_DB_MODE || 'mock';

export const db: DatabaseAdapter =
    dbMode === 'supabase' ? new SupabaseAdapter() :
        dbMode === 'postgres' ? new PostgresAdapter() :
            new MockAdapter();

console.log(`Database Adapter initialized in ${dbMode} mode.`);
