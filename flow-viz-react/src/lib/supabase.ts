/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const useMock = import.meta.env.VITE_USE_MOCK === 'true';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = (useMock || !supabaseUrl || !supabaseAnonKey)
    ? null // We will handle null client in stores via Simulation Mode
    : createClient<Database>(supabaseUrl, supabaseAnonKey);

export function isMockMode() {
    return useMock;
}
