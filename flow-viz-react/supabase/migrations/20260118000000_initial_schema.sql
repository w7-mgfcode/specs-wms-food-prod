-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users (Public Profile linked to Auth)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'VIEWER' CHECK (role IN ('ADMIN', 'MANAGER', 'AUDITOR', 'OPERATOR', 'VIEWER')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- 2. Scenarios
CREATE TABLE public.scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name JSONB NOT NULL, -- { hu: string, en: string }
    version TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    i18n JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Streams
CREATE TABLE public.streams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_id UUID REFERENCES public.scenarios(id) ON DELETE CASCADE,
    stream_key TEXT NOT NULL, -- 'A', 'B', 'C'
    name JSONB NOT NULL,
    color TEXT NOT NULL,
    sort_order INT NOT NULL
);

-- 4. QC Gates
CREATE TABLE public.qc_gates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_id UUID REFERENCES public.scenarios(id) ON DELETE CASCADE,
    gate_number INT NOT NULL,
    name JSONB NOT NULL,
    gate_type TEXT CHECK (gate_type IN ('CHECKPOINT', 'BLOCKING', 'INFO')),
    is_ccp BOOLEAN DEFAULT false,
    checklist JSONB NOT NULL DEFAULT '[]'
);

-- 5. Phases
CREATE TABLE public.phases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_id UUID REFERENCES public.scenarios(id) ON DELETE CASCADE,
    stream_id UUID REFERENCES public.streams(id),
    qc_gate_id UUID REFERENCES public.qc_gates(id),
    phase_number INT NOT NULL,
    name JSONB NOT NULL,
    description JSONB NOT NULL
);

-- 6. Production Runs
CREATE TABLE public.production_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_code TEXT UNIQUE NOT NULL, -- 'PRD-YYYYMMDD-...'
    scenario_id UUID REFERENCES public.scenarios(id),
    operator_id UUID REFERENCES public.users(id),
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    daily_target_kg DECIMAL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    summary JSONB
);

-- 7. Lots
CREATE TABLE public.lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lot_code TEXT UNIQUE NOT NULL,
    lot_type TEXT CHECK (lot_type IN ('RAW', 'DEB', 'BULK', 'MIX', 'SKW', 'FRZ', 'FG')),
    production_run_id UUID REFERENCES public.production_runs(id),
    phase_id UUID REFERENCES public.phases(id),
    operator_id UUID REFERENCES public.users(id),
    weight_kg DECIMAL,
    temperature_c DECIMAL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Lot Genealogy
CREATE TABLE public.lot_genealogy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_lot_id UUID REFERENCES public.lots(id),
    child_lot_id UUID REFERENCES public.lots(id),
    quantity_used_kg DECIMAL,
    linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. QC Decisions
CREATE TABLE public.qc_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lot_id UUID REFERENCES public.lots(id),
    qc_gate_id UUID REFERENCES public.qc_gates(id),
    operator_id UUID REFERENCES public.users(id),
    decision TEXT CHECK (decision IN ('PASS', 'HOLD', 'FAIL')),
    notes TEXT,
    temperature_c DECIMAL,
    digital_signature TEXT,
    decided_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies (Draft)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_decisions ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone for dashboards
CREATE POLICY "Allow public read" ON public.production_runs FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.lots FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.qc_decisions FOR SELECT USING (true);

-- Allow authenticated modification
CREATE POLICY "Allow auth insert runs" ON public.production_runs FOR INSERT WITH CHECK (auth.uid() = operator_id);
CREATE POLICY "Allow auth update runs" ON public.production_runs FOR UPDATE USING (auth.uid() = operator_id);
