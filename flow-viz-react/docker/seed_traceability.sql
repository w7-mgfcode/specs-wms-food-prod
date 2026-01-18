-- Seed Traceability Data
-- 3-Level Genealogy: Raw Material -> Work In Progress -> Finished Good

-- 1. Insert Raw Materials (Parents)
INSERT INTO lots (id, lot_code, lot_type, weight_kg, created_at) VALUES 
('11111111-1111-1111-1111-111111111101', 'RAW-BEEF-001', 'RAW', 500.0, NOW()),
('11111111-1111-1111-1111-111111111102', 'RAW-SPICE-001', 'RAW', 50.0, NOW());

-- 2. Insert WIP (Child of RAW, Parent of FG)
INSERT INTO lots (id, lot_code, lot_type, weight_kg, created_at) VALUES 
('22222222-2222-2222-2222-222222222201', 'MIX-BATCH-88', 'MIX', 540.0, NOW());

-- 3. Insert Final Good (Child of WIP)
INSERT INTO lots (id, lot_code, lot_type, weight_kg, created_at) VALUES 
('33333333-3333-3333-3333-333333333301', 'FG-DONER-X1', 'FG', 530.0, NOW());

-- 4. Create Links (Genealogy)

-- Link RAW -> MIX
INSERT INTO lot_genealogy (parent_lot_id, child_lot_id, quantity_used_kg) VALUES 
('11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222201', 500.0),
('11111111-1111-1111-1111-111111111102', '22222222-2222-2222-2222-222222222201', 40.0);

-- Link MIX -> FG
INSERT INTO lot_genealogy (parent_lot_id, child_lot_id, quantity_used_kg) VALUES 
('22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333301', 530.0);
