import { Slide } from '../types/presentation'

export const slides: Slide[] = [
    // --- SLIDE 0: Áttekintés ---
    {
        id: 0,
        navTitle: '📋 Áttekintés',
        title: '🎯 Rendszer Áttekintés',
        sections: [
            {
                type: 'feature-grid',
                featureGrid: {
                    title: '🎯 Kritikus Követelmények',
                    badge: 'EU Compliant',
                    features: [
                        { icon: '✅', title: 'Teljes traceability', desc: '1 vissza / 1 előre nyomon követés' },
                        { icon: '🐔', title: 'Species szeparáció', desc: 'CHICKEN ≠ TURKEY' },
                        { icon: '🌡️', title: 'CCP kontrollok', desc: 'Kritikus hőmérséklet pontok' },
                        { icon: '📋', title: 'QC Gate rendszer', desc: 'Minden lépésben minőségi kapu' }
                    ]
                }
            },
            {
                type: 'table',
                title: '📦 Termékportfólió',
                columns: ['SKU', 'Termék', 'Súly', 'Species'],
                rows: [
                    ['<span class="bg-[#1e3a8a] text-blue-200 px-2 py-1 rounded text-xs font-bold border border-blue-500/30">CHK15</span>', 'Chicken Döner', '15 kg rúd', '<span class="bg-[#f59e0b] text-black px-2 py-1 rounded-full text-xs font-bold shadow-sm">CHICKEN</span>'],
                    ['<span class="bg-[#1e3a8a] text-blue-200 px-2 py-1 rounded text-xs font-bold border border-blue-500/30">CHK30</span>', 'Chicken Döner', '30 kg rúd', '<span class="bg-[#f59e0b] text-black px-2 py-1 rounded-full text-xs font-bold shadow-sm">CHICKEN</span>'],
                    ['<span class="bg-[#1e3a8a] text-blue-200 px-2 py-1 rounded text-xs font-bold border border-blue-500/30">TUR15</span>', 'Turkey Döner', '15 kg rúd', '<span class="bg-[#2563eb] text-white px-2 py-1 rounded-full text-xs font-bold shadow-sm">TURKEY</span>'],
                    ['<span class="bg-[#1e3a8a] text-blue-200 px-2 py-1 rounded text-xs font-bold border border-blue-500/30">TUR30</span>', 'Turkey Döner', '30 kg rúd', '<span class="bg-[#2563eb] text-white px-2 py-1 rounded-full text-xs font-bold shadow-sm">TURKEY</span>'],
                ],
            },
            {
                type: 'flow-phases',
            },
        ],
    },

    // --- SLIDE 1: Beszerzés ---
    {
        id: 1,
        navTitle: '📦 Fázis 1-2: Beszerzés',
        title: '📦 Fázis 1-2: Beszerzés és Tárolás',
        sections: [
            {
                type: 'group',
                title: 'R1: ÁTVÉTEL (Receipt) <span class="bg-blue-600 text-white text-xs px-2 py-1 rounded ml-2">oPRP</span>',
                sections: [
                    {
                        type: 'kv-pairs',
                        kvPairs: [
                            { key: 'Input dokumentáció', value: 'Szállítólevél, CoA, T° igazolás' },
                            { key: 'Hőmérséklet követelmény', value: 'Friss: 0-4°C / Fagyasztott: < -18°C' },
                            { key: 'Kezdő státusz', value: 'QUARANTINE' },
                        ],
                    },
                    {
                        type: 'code',
                        codeTitle: 'RAW LOT RECORD példa',
                        content: `{
  "lot_id": "RAW-CHK-20260115-DUNA-0101",
  "status": "QUARANTINE",
  "supplier_id": "SUP-A",
  "material_type": "csirkemellfilé",
  "gross_weight_kg": 120,
  "temperature_on_arrival": 2.4,
  "grn_id": "GRN-2026-0042",
  "timestamp": "2026-01-15T07:30:00Z",
  "operator_id": "OP-023",
  "device_id": "THERMO-R1-001"
}`,
                    },
                    {
                        type: 'qc-gate',
                        qcGate: {
                            id: 'QC-R2',
                            title: 'RECEIPT RELEASE',
                            badge: 'CRITICAL',
                            goal: 'Célja: Döntési pont - QUARANTINE → RELEASED / HOLD / REJECT',
                            checklist: [
                                { icon: '🌡️', text: 'Hőmérséklet compliance (0-4°C)' },
                                { icon: '📄', text: 'Dokumentáció egyezés (CoA + szállítólevél)' },
                                { icon: '👁️', text: 'Vizuális állapot (friss, nincs elszíneződés)' },
                                { icon: '📦', text: 'Csomagolás integritás (sértetlen)' }
                            ],
                            table: {
                                headers: ['Előző státusz', 'QC Eredmény', 'Új státusz', 'Művelet'],
                                rows: [
                                    { prev: 'QUARANTINE', result: 'PASS', next: 'RELEASED', action: '→ Raktár S1/S2', resultType: 'success' },
                                    { prev: 'QUARANTINE', result: 'MINOR ISSUE', next: 'HOLD', action: '→ Beszállító kontakt', resultType: 'warning' },
                                    { prev: 'QUARANTINE', result: 'FAIL', next: 'REJECTED', action: '→ Visszaküldés', resultType: 'danger' }
                                ]
                            }
                        }
                    },
                ]
            },
            {
                type: 'group',
                title: 'S1-S2: HŰTÖTT RAKTÁR - Species Szeparáció',
                sections: [
                    {
                        type: 'species-zones',
                    },
                    {
                        type: 'alert',
                        variant: 'warning-box',
                        title: '⚠️ KRITIKUS SZABÁLY',
                        content: 'CHICKEN és TURKEY <strong>SOHA</strong> nem használhatja ugyanazt a konténert, eszközt vagy WIP területet. Teljes fizikai szeparáció kötelező.',
                    },
                ]
            }
        ],
    },

    // --- SLIDE 2: Előkészítés ---
    {
        id: 2,
        navTitle: '🔪 Fázis 3-4: Előkészítés',
        title: '🔪 Fázis 3-4: Előkészítés és BULK Képzés',
        sections: [
            {
                type: 'group',
                title: 'C3/T3: CSONTOZÁS (Deboning) <span class="bg-blue-600 text-white text-xs px-2 py-1 rounded ml-2">oPRP</span>',
                sections: [
                    {
                        type: 'paragraph',
                        content: '**Célja:** Csontos alapanyag → tiszta hús/filé, csonteltávolítás',
                    },
                    {
                        type: 'code',
                        codeTitle: 'DEBONING EVENT példa (CHICKEN)',
                        content: `{
  "event_id": "DEBONE-CHK-20260115-0001",
  "step_code": "C3_DEBONE_CHK",
  "input_lots": [
    "RAW-CHK-20260113-DUNA-1003",  // 300 kg csontos szárny
    "RAW-CHK-20260114-DUNA-1005"   // 420 kg csontos comb
  ],
  "output_lot": "BULK-CHK-20260115-DUNA-5006",
  "yield_percentage": 68,  // 480 kg / 720 kg
  "waste_log": {
    "bone_waste": 210,
    "trim_waste": 30,
    "waste_disposal_id": "WASTE-2026-0115-001"
  },
  "operator_team": ["OP-012", "OP-023", "OP-034"],
  "equipment_id": "DEBONE-TABLE-CHK-01",
  "temperature_during_process": "0-4°C"
}`,
                    },
                    {
                        type: 'grid',
                        title: '✅ QC Ellenőrzés C3-nál:',
                        gridItems: [
                            { title: '🦴', items: [{ key: 'Csontmaradvány', value: 'ellenőrzés' }] },
                            { title: '🔍', items: [{ key: 'Idegen anyag', value: 'detektálás' }] },
                            { title: '⏱️', items: [{ key: 'WIP idő', value: 'limit (max 2 óra 0-7°C)' }] },
                            { title: '⚖️', items: [{ key: 'Tömegkihozatal', value: 'validáció' }] },
                        ],
                    },
                ]
            },
            {
                type: 'group',
                title: 'C4/T4: BULK PUFFER - Mérlegelés és Címkézés <span class="bg-blue-600 text-white text-xs px-2 py-1 rounded ml-2">oPRP</span>',
                sections: [
                    {
                        type: 'paragraph',
                        content: '**Célja:** Standardizált WIP konténer + pontos tömegadat',
                    },
                    {
                        type: 'code',
                        codeTitle: 'BULK CONTAINER RECORD',
                        content: `{
  "container_id": "CONT-CHK-B-0042",
  "bulk_lot_id": "BULK-CHK-20260115-DUNA-5006",
  "material_type": "csirke combfilé mix",
  "tare_weight": 5.2,        // üres konténer
  "gross_weight": 485.2,     // teljes
  "net_weight": 480.0,       // ⭐ Ez megy tovább a receptbe
  "scale_id": "SCALE-BULK-01",
  "calibration_valid_until": "2026-02-28",
  "operator_id": "OP-023",
  "timestamp": "2026-01-15T09:45:00Z",
  "temperature": 2.1,
  "species_lock": "CHICKEN"
}`,
                    },
                    {
                        type: 'alert',
                        variant: 'info-box',
                        title: '🔒 SPECIES LOCK',
                        content: 'Egy konténer <strong>CSAK</strong> egy fajhoz használható. Ha egyszer CHICKEN-t tartalmazott, TURKEY-hez már nem használható (adatbázis trigger ellenőrzi).',
                    },
                    {
                        type: 'code',
                        codeTitle: 'SQL - Species Lock Validáció',
                        content: `-- Konténer használati log ellenőrzés
INSERT INTO container_usage_log
  (container_id, species, timestamp)
VALUES 
  ('CONT-CHK-B-0042', 'CHICKEN', NOW());

-- Validáció BEFORE INSERT trigger-ben:
IF EXISTS (
  SELECT 1 FROM container_usage_log 
  WHERE container_id = 'CONT-CHK-B-0042' 
    AND species != 'CHICKEN'
) THEN 
  RAISE EXCEPTION 'Species contamination risk!';
END IF;`,
                    },
                ]
            }
        ],
    },

    // --- SLIDE 3: Gyártás ---
    {
        id: 3,
        navTitle: '🥘 Fázis 5-6: Gyártás',
        title: '🥘 Fázis 5-6: Keverés és Nyársra húzás',
        sections: [
            {
                type: 'group',
                title: 'C5/T5: KEVERÉS (MIXLOT) <span class="bg-blue-600 text-white text-xs px-2 py-1 rounded ml-2">oPRP - Recipe Control</span>',
                sections: [
                    {
                        type: 'paragraph',
                        content: '**Célja:** Recept szerinti homogenizálás, pontos adalékanyag-hozzáadás',
                    },
                    {
                        type: 'code',
                        codeTitle: 'MIXING EVENT példa',
                        content: `{
  "event_id": "MIX-CHK-20260115-0001",
  "mixlot_id": "MIX-CHK-20260115-DUNA-0001",
  "recipe_version": "RCP-CHK-v3.1",  // ⭐ Verziózott recept
  "recipe_components": {
    "base_meat": [
      {"lot_id": "BULK-CHK-...-5006", "weight": 480},
      {"lot_id": "BULK-CHK-...-5001", "weight": 200},
      {"lot_id": "BULK-CHK-...-5005", "weight": 60},
      {"lot_id": "BULK-CHK-...-5002", "weight": 30}
    ],
    "total_meat": 770,
    "ingredients": [
      {"lot_id": "ING-SALT-...-001", "weight": 15},
      {"lot_id": "ING-SPICE-MIX-A-...-002", "weight": 12},
      {"lot_id": "ING-STABILIZER-...-003", "weight": 8}
    ],
    "total_ingredients": 35,
    "calculated_total": 805
  },
  "actual_output_weight": 802,  // Loss: 3 kg (0.37%)
  "temperature_during_mix": 3.2
}`,
                    },
                    {
                        title: '✅ Recept Validáció (SQL)',
                        type: 'code',
                        codeTitle: 'Recipe Compliance Check',
                        content: `SELECT 
  rc.component_name,
  rc.target_weight_kg,
  COALESCE(SUM(ei.actual_weight_kg), 0) AS actual_weight,
  rc.tolerance_percent,
  CASE 
    WHEN ABS(COALESCE(SUM(ei.actual_weight_kg), 0) - rc.target_weight_kg) 
         > (rc.target_weight_kg * rc.tolerance_percent / 100)
    THEN 'OUT_OF_SPEC'
    ELSE 'OK'
  END AS compliance_status
FROM recipe_components rc
LEFT JOIN event_inputs ei ON ei.component_type = rc.component_name
WHERE rc.recipe_version = 'RCP-CHK-v3.1'
  AND ei.event_id = 'MIX-CHK-20260115-0001'
GROUP BY rc.component_name, rc.target_weight_kg, rc.tolerance_percent;`,
                    },
                    {
                        type: 'alert',
                        variant: 'warning-box',
                        title: '⚠️ QC RULE',
                        content: 'Ha bármelyik komponens <strong>OUT_OF_SPEC</strong> → <strong>AUTOMATIKUS QC HOLD</strong> (nem léphet tovább nyársalásra).',
                    },
                    {
                        type: 'qc-gate',
                        qcGate: {
                            id: 'QC-C5',
                            title: 'RECIPE CHECK',
                            badge: 'oPRP',
                            goal: 'Célja: Receptúra és Technológia (idő/vákuum) validálása',
                            checklist: [
                                { icon: '⚖️', text: 'Mérés pontosság (Hús vs Fűszer arány)' },
                                { icon: '🧾', text: 'Recept verzió egyezés (Barcode Scan)' },
                                { icon: '🧊', text: 'Hőmérséklet (Max 4°C)' },
                                { icon: '⏱️', text: 'Program időtartam (min. 40 perc)' }
                            ],
                            table: {
                                headers: ['Batch Status', 'QC Validáció', 'Output', 'Action'],
                                rows: [
                                    { prev: 'MIXING', result: 'MATCH', next: 'READY', action: '→ Nyársaló', resultType: 'success' },
                                    { prev: 'MIXING', result: 'TEMP HIGH', next: 'HOLD', action: '→ Hűtőalagút', resultType: 'warning' },
                                    { prev: 'MIXING', result: 'WRONG RECIPE', next: 'REJECT', action: '→ Selejtezés', resultType: 'danger' }
                                ]
                            }
                        }
                    },
                ]
            },
            {
                type: 'group',
                title: 'C6/T6: NYÁRSRA HÚZÁS (SKW) <span class="bg-red-600 text-white text-xs px-2 py-1 rounded ml-2">CRITICAL</span>',
                sections: [
                    {
                        type: 'paragraph',
                        content: '**Célja:** 15 kg vagy 30 kg rúd képzése, szigorú toleranciával.<br/>**Weight Control:** Minden egyes nyársat mérlegyezni kell. (Tolerance: ±0.25 kg)',
                    },
                    {
                        type: 'alert',
                        variant: 'warning-box',
                        title: '❌ "TEGNAPI BACKLOG" SZABÁLY',
                        content: '• <strong>TILOS:</strong> Tegnapi MIXLOT vagy SKW felhasználása C5/C6-ban<br/>• <strong>✅ ENGEDETT:</strong> Tegnapi SKW csak F7-ben (fagyasztásban) szerepelhet',
                    },
                    {
                        type: 'code',
                        codeTitle: 'SKEWER FORMATION EVENT',
                        content: `{
  "event_id": "SKW-CHK15-20260115-0001",
  "input_mixlot": "MIX-CHK-20260115-DUNA-0001",
  "target_sku": "CHK15",
  "target_weight_per_skewer": 15.0,
  "tolerance": 0.25,  // ±0.25 kg (14.75 - 15.25 kg)
  "skewers_produced": [
    {"id": "SKW-CHK15-...-0001", "weight": 15.12},  // ✅ OK
    {"id": "SKW-CHK15-...-0002", "weight": 14.89},  // ✅ OK
    {"id": "SKW-CHK15-...-0003", "weight": 15.21},  // ✅ OK
    {"id": "SKW-CHK15-...-0004", "weight": 15.03},  // ✅ OK
    // ... összesen 40 db
  ],
  "total_skewers": 40,
  "total_weight": 602.4
}`,
                    },
                    {
                        type: 'table',
                        title: '⚖️ Tömeg Korrekciós Log',
                        columns: ['Skewer ID', 'Target', '1st Attempt', 'Correction', '2nd Attempt', 'Status'],
                        rows: [
                            ['SKW-CHK15-...-0005', '15.0 kg', '<span class="text-red-400">14.62 kg</span>', '<span class="text-[#f59e0b]">+0.42 kg mix</span>', '<span class="text-[#10b981] font-bold">15.04 kg</span>', '<span class="bg-[#10b981] text-black px-2 py-1 rounded text-xs font-bold">ACCEPTED</span>'],
                        ],
                    },
                ]
            },
        ],
    },

    // --- SLIDE 4: Fagyasztás (CCP) ---
    {
        id: 4,
        navTitle: '❄️ Fázis 7: Fagyasztás',
        title: '❄️ Fázis 7: Fagyasztás (CCP - Kritikus Pont)',
        sections: [
            {
                type: 'freezing-widget',
            },
        ],
    },

    // --- SLIDE 5: Csomagolás és Kiszállítás ---
    {
        id: 5,
        navTitle: '📦 Fázis 8-10: Csomagolás',
        title: '📦 Fázis 8-10: Csomagolás és Kiszállítás',
        sections: [
            {
                type: 'packaging-widget',
            },
        ],
    },

    // --- SLIDE 6: QC ---
    {
        id: 6,
        navTitle: '🛡️ QC Rendszer',
        title: '🛡️ QC (Quality Control) Kapu Rendszer',
        sections: [
            {
                type: 'group',
                title: '✅ QC Gate Koncepció',
                sections: [
                    {
                        type: 'alert',
                        variant: 'success-box',
                        title: 'Mi az a QC Gate?',
                        content: 'A QC Gate (Quality Control Gate) egy döntési pont a termelésben:<br/><br/><strong>STOP:</strong> A termék/lot megáll, nem mehet tovább<br/><strong>CHECK:</strong> Ellenőrzés (T°, tömeg, vizuál, dokumentáció)<br/><strong>DECISION:</strong> QC inspector dönt: PASS / HOLD / REJECT<br/><strong>GO/NO-GO:</strong> Csak PASS esetén folytatódik',
                    },
                    {
                        type: 'table',
                        title: '🛡️ 7 QC Gate a Rendszerben',
                        columns: ['Gate ID', 'Fázis', 'Célja', 'Kritikus Check', 'Típus'],
                        rows: [
                            ['<span class="bg-blue-900 text-blue-200 px-3 py-1 rounded-full text-xs font-mono shadow-sm border border-blue-700">QC-R2</span>', 'Receipt', 'Karantén → Released', 'T°, dokumentáció, érzékszervi', '<span class="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">oPRP</span>'],
                            ['<span class="bg-blue-900 text-blue-200 px-3 py-1 rounded-full text-xs font-mono shadow-sm border border-blue-700">QC-C3</span>', 'Debone', 'Tisztaság, yield', 'Csontmaradvány, idegen anyag', '<span class="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">oPRP</span>'],
                            ['<span class="bg-blue-900 text-blue-200 px-3 py-1 rounded-full text-xs font-mono shadow-sm border border-blue-700">QC-C5</span>', 'Mix', 'Recept compliance', 'Tömeg, T°, verzió', '<span class="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">oPRP</span>'],
                            ['<span class="bg-blue-900 text-blue-200 px-3 py-1 rounded-full text-xs font-mono shadow-sm border border-blue-700">QC-C6</span>', 'Skewer', 'Tömeg pontosság', 'Target vs actual, backlog', '<span class="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">oPRP</span>'],
                            ['<span class="bg-red-900 text-red-200 px-3 py-1 rounded-full text-xs font-mono shadow-sm border border-red-700">CCP-F7</span>', 'Freeze', 'HACCP CCP', 'Maghő ≤ -18°C, görbe', '<span class="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">CCP</span>'],
                            ['<span class="bg-purple-900 text-purple-200 px-3 py-1 rounded-full text-xs font-mono shadow-sm border border-purple-700">QC-P8</span>', 'Pack', 'Jelölés, integritás', 'Label, seal, metal detect', '<span class="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">CCP/oPRP</span>'],
                            ['<span class="bg-blue-900 text-blue-200 px-3 py-1 rounded-full text-xs font-mono shadow-sm border border-blue-700">QC-L9</span>', 'Pallet', 'Szállítói compliance', 'FG-lot mapping, T° chain', '<span class="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">PRP</span>'],
                        ],
                    },
                ]
            },
            {
                type: 'group',
                title: '📋 Adatstruktúra és Workflow',
                sections: [
                    {
                        type: 'code',
                        codeTitle: 'QC_INSPECTIONS Tábla',
                        content: `QC_INSPECTIONS:
├─ inspection_id          PK (QC-C5-20260115-0001)
├─ gate_type              R2 / C3 / C5 / C6 / F7 / P8 / L9
├─ lot_id                 FK → LOTS
├─ event_id               FK → EVENTS
├─ inspector_id           QC személy azonosító
├─ timestamp_start        Ellenőrzés kezdete
├─ timestamp_end          Ellenőrzés vége
├─ checklist_results      JSON (kérdés + válasz)
├─ decision               PASS / HOLD / REJECT
├─ digital_signature      Hash (audit trail)
└─ evidence_urls          JSON (fotók)`,
                    },
                    {
                        title: '🔄 QC Workflow - Példa (C5 Mix)',
                        type: 'qc-workflow',
                        qcSteps: [
                            {
                                title: '1. Termelési esemény elindul',
                                desc: '<strong>Event:</strong> MIX-CHK-20260115-0001<br/><strong>Status:</strong> IN_PROGRESS',
                                status: 'normal'
                            },
                            {
                                title: '2. Esemény befejeződik',
                                desc: '<strong>Event status:</strong> → COMPLETED_AWAITING_QC<br/><strong>Output lot:</strong> MIX-CHK-20260115-DUNA-0001<br/><strong>Lot status:</strong> QC_HOLD (automatikusan)',
                                status: 'warning'
                            },
                            {
                                title: '3. QC inspector megkezdi',
                                desc: '<strong>Inspector:</strong> QC-Peter-12<br/><strong>Opens:</strong> QC-MIX-20260115-0001<br/><strong>Template:</strong> CHKLST-C5-v1.8',
                                status: 'normal'
                            },
                            {
                                title: '4. Checklist kitöltése',
                                desc: '✅ <strong>Recept verzió egyezik?</strong> → YES (RCP-CHK-v3.1)<br/>✅ <strong>Komponens tömegek OK?</strong> → YES<br/>✅ <strong>Hőmérséklet 0-4°C?</strong> → YES (3.2°C)<br/>✅ <strong>Homogenitás vizuál?</strong> → PASS<br/>✅ <strong>Allergén zóna rend?</strong> → YES',
                                status: 'normal'
                            },
                            {
                                title: '5. Döntés',
                                desc: '<strong>Decision:</strong> PASS<br/><strong>Digital signature:</strong> QC-Peter-12-SIGN-0x3a4f9b2c...<br/><strong>Timestamp:</strong> 2026-01-15 10:35:42',
                                status: 'success'
                            },
                            {
                                title: '6. Lot státusz frissül',
                                desc: '<strong>Lot:</strong> MIX-CHK-20260115-DUNA-0001<br/><strong>Old:</strong> QC_HOLD → <strong>New:</strong> RELEASED<br/><strong>Next step:</strong> C6_SKEWER engedélyezve',
                                status: 'success'
                            },
                        ],
                    },
                ]
            },
            {
                type: 'table',
                title: '⚠️ <span class="text-green-500">QC Döntési Mátrix</span>',
                columns: ['Decision', 'Lot Status', 'Következő Lépés', 'Dokumentáció'],
                rows: [
                    ['<span class="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">PASS</span>', 'RELEASED', '→ Folytatódik termelés', 'Inspection record + signature'],
                    ['<span class="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">HOLD</span>', 'ON_HOLD', '→ Várakozás, vizsgálat', 'Inspection + reason + CA plan'],
                    ['<span class="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">REJECT</span>', 'REJECTED', '→ Scrap / Rework / Return', 'Inspection + NCR + rejection report'],
                ],
            },
        ],
    },

    // --- SLIDE 7: Adatmodell ---
    {
        id: 7,
        navTitle: '🗄️ Adatmodell & Trace',
        title: '🗄️ Adatmodell és Traceability',
        sections: [
            {
                type: 'group',
                title: '🏗️ Központi Táblák és Összefüggések',
                sections: [
                    {
                        type: 'code',
                        codeTitle: 'Relációs Adatmodell',
                        content: `┌─────────────────────────────────────────────────┐
│ LOTS (minden tétel: RAW, BULK, MIX, SKW, FRZ, FG) │
├─────────────────────────────────────────────────┤
│ lot_id (PK)          │ Egyedi azonosító          │
│ lot_type             │ RAW/BULK/MIX/SKW/FRZ/FG  │
│ species              │ CHICKEN / TURKEY          │
│ sku                  │ CHK15/CHK30/TUR15/TUR30  │
│ production_date      │ Létrehozás dátuma         │
│ status               │ QUAR/REL/HOLD/REJECT      │
│ supplier_id          │ Beszállító (RAW esetén)   │
│ gross_weight_kg      │ Bruttó tömeg              │
│ net_weight_kg        │ Nettó tömeg               │
│ temperature_log_id   │ → TEMPERATURE_LOGS FK     │
│ location_id          │ Aktuális fizikai hely     │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ LOT_GENEALOGY (szülő-gyerek kapcsolatok)        │
├─────────────────────────────────────────────────┤
│ parent_lot_id (FK)   │ → LOTS (input)           │
│ child_lot_id (FK)    │ → LOTS (output)          │
│ event_id (FK)        │ → EVENTS (melyik lépés)  │
│ quantity_used_kg     │ Mennyi ment be           │
│ timestamp            │ Mikor történt            │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ EVENTS (minden termelési esemény)               │
├─────────────────────────────────────────────────┤
│ event_id (PK)        │ MIX-CHK-20260115-0001    │
│ step_code            │ C5_MIX / F7_FREEZE       │
│ event_date           │ 2026-01-15               │
│ operator_id (FK)     │ → OPERATORS              │
│ equipment_id (FK)    │ → EQUIPMENT              │
│ qc_inspection_id     │ → QC_INSPECTIONS         │
│ status               │ COMPLETED / HOLD         │
└─────────────────────────────────────────────────┘`,
                    },
                ]
            },
            {
                type: 'group',
                title: '🔙 RECALL SQL - 1 VISSZA (FG → Beszállítók)',
                sections: [
                    {
                        type: 'alert',
                        variant: 'audit-critical',
                        title: 'Audit Critical',
                        content: '<strong>Mit csinál:</strong> Egy kész termék lot-ból visszaköveti az ÖSSZES beszállítói tételt'
                    },
                    {
                        type: 'code',
                        codeTitle: 'Adatfolyam példa',
                        content: `FG-CHK15-20260115-DUNA-0002 ↓
→ FRZ-CHK15-20260115-DUNA-0001 ↓
→ SKW-CHK15-20260115-DUNA-0001..0040 ↓
→ MIX-CHK-20260115-DUNA-0001 ↓
→ BULK-CHK (5006, 5001, 5002, 5005) ↓
→ RAW-CHK (1003, 1004, 1005) ↓
→ SUPPLIERS: SUP-A, SUP-B, SUP-C ✅`,
                    },
                    {
                        type: 'code',
                        codeTitle: 'SQL - Recursive CTE (1-back)',
                        content: `WITH RECURSIVE upstream AS (
  -- Első lépés: FG lot közvetlen szülői
  SELECT
    g.child_lot_id AS lot_id,
    g.parent_lot_id,
    1 AS depth
  FROM lot_genealogy g
  WHERE g.child_lot_id = 'FG-CHK15-20260115-DUNA-0002'

  UNION ALL

  -- Rekurzív lépés: feljebb a fában
  SELECT
    u.parent_lot_id AS lot_id,
    g.parent_lot_id,
    u.depth + 1
  FROM upstream u
  JOIN lot_genealogy g ON g.child_lot_id = u.parent_lot_id
)
SELECT
  l.lot_id,
  l.lot_type,
  l.species,
  l.supplier_id,
  l.source_doc_no AS "Szállítólevél",
  l.gross_weight_kg AS "Eredeti tömeg"
FROM upstream u
JOIN lots l ON l.lot_id = u.parent_lot_id
WHERE l.lot_type = 'RAW'  -- Csak beszállítói tételek
ORDER BY l.supplier_id, l.lot_id;`,
                    },
                    {
                        type: 'table',
                        title: '📊 Példa Kimenet',
                        columns: ['lot_id', 'species', 'supplier_id', 'Szállítólevél', 'Tömeg'],
                        rows: [
                            ['RAW-CHK-20260113-DUNA-1003', 'CHICKEN', 'SUP-B', 'DN-2026-0234', '300 kg'],
                            ['RAW-CHK-20260114-DUNA-1005', 'CHICKEN', 'SUP-C', 'DN-2026-0289', '420 kg'],
                            ['RAW-CHK-20260112-DUNA-1001', 'CHICKEN', 'SUP-A', 'DN-2026-0201', '600 kg'],
                        ],
                    },
                    {
                        type: 'alert',
                        variant: 'success',
                        content: '✅ Audit Válasz: "Ez a kész termék tétel <strong>3 beszállítói tételből</strong> készült. Beszállítók: SUP-A, SUP-B, SUP-C. Ha SUP-B-nél probléma → ez a tétel érintett."',
                    },
                ],
            },
            {
                type: 'group',
                title: '🔜 RECALL SQL - 1 ELŐRE (RAW → Vevők)',
                sections: [
                    {
                        type: 'alert',
                        variant: 'audit-critical',
                        title: 'Audit Critical',
                        content: '<strong>Mit csinál:</strong> Egy beszállítói tétel esetén megmutatja, MELY vevőkhöz ment ki'
                    },
                    {
                        type: 'code',
                        codeTitle: 'SQL - Recursive CTE (1-forward)',
                        content: `WITH RECURSIVE downstream AS (
  -- Első lépés: RAW lot közvetlen gyerekei
  SELECT
    g.parent_lot_id,
    g.child_lot_id,
    1 AS depth
  FROM lot_genealogy g
  WHERE g.parent_lot_id = 'RAW-CHK-20260113-DUNA-1003'

  UNION ALL

  -- Rekurzív lépés: lejjebb a fában
  SELECT
    d.child_lot_id AS parent_lot_id,
    g.child_lot_id,
    d.depth + 1
  FROM downstream d
  JOIN lot_genealogy g ON g.parent_lot_id = d.child_lot_id
)
SELECT DISTINCT
  lfg.lot_id AS "FG Lot",
  lfg.sku AS "Termék",
  p.sscc AS "Raklap SSCC",
  s.shipment_id AS "Szállítás ID",
  s.customer_id AS "Vevő",
  s.dispatch_ts AS "Kiszállítás"
FROM downstream d
JOIN lots lfg ON lfg.lot_id = d.child_lot_id AND lfg.lot_type = 'FG'
LEFT JOIN pallet_items pi ON pi.fg_lot_id = lfg.lot_id
LEFT JOIN pallets p ON p.pallet_id = pi.pallet_id
LEFT JOIN shipment_items si ON si.sscc = p.sscc
LEFT JOIN shipments s ON s.shipment_id = si.shipment_id
ORDER BY s.dispatch_ts NULLS LAST;`,
                    },
                    {
                        type: 'table',
                        title: '📊 Példa Kimenet',
                        columns: ['FG Lot', 'Termék', 'SSCC', 'Vevő', 'Kiszállítás'],
                        rows: [
                            ['FG-CHK15-...-0002', 'CHK15', '00123456789012345678', 'CUST-A', '2026-01-16 08:30'],
                            ['FG-CHK15-...-0004', 'CHK15', '00123456789012345679', 'CUST-A', '2026-01-16 08:30'],
                        ],
                    },
                    {
                        type: 'alert',
                        variant: 'success',
                        content: '✅ Audit Válasz: "Ez a beszállítói tétel <strong>2 kész termék lot-ba</strong> került. Mindkettő a CUST-A vevőhöz ment ki. Visszahívás szükséges: 2 raklap, SSCC kód alapján azonosítva."',
                    },
                ],
            },
        ],
    },


    // --- SLIDE 8: Compliance ---
    {
        id: 8,
        navTitle: '⚖️ Compliance',
        title: '⚖️ Compliance Szabályok - Database Level',
        sections: [
            {
                type: 'compliance-rules',
                complianceRules: [
                    {
                        id: 'sku-lock',
                        title: 'SKU LOCK (Freeze Batch)',
                        type: 'MANDATORY',
                        shortDesc: 'Egy fagyasztó batch-ben CSAK egy SKU lehet (CHK15 VAGY CHK30, NEM mindkettő)',
                        whyList: ['Eltérő fagyasztási idő', 'SSCC/raklap logisztika', 'Audit tisztaság'],
                        triggerCode: `CREATE OR REPLACE FUNCTION validate_freeze_batch_sku_lock()
RETURNS TRIGGER AS $$
DECLARE
  sku_count INTEGER;
  sku_list TEXT;
BEGIN
  SELECT COUNT(DISTINCT sku), STRING_AGG(DISTINCT sku, ', ')
  INTO sku_count, sku_list
  FROM freeze_batch_items
  WHERE freeze_batch_id = NEW.freeze_batch_id;
  
  IF sku_count > 1 THEN
    RAISE EXCEPTION 'SKU LOCK VIOLATION: Batch % contains multiple SKUs: %', 
      NEW.freeze_batch_id, sku_list
    USING HINT = 'Only one SKU allowed per freeze batch';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_sku_lock
  AFTER INSERT OR UPDATE ON freeze_batch_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_freeze_batch_sku_lock();`,
                        complianceQuery: `-- Audit Check: Van-e megsértett batch?
SELECT 
  freeze_batch_id,
  COUNT(DISTINCT sku) AS sku_count,
  STRING_AGG(DISTINCT sku, ', ') AS sku_list,
  COUNT(*) AS total_skewers
FROM freeze_batch_items
GROUP BY freeze_batch_id
HAVING COUNT(DISTINCT sku) > 1;

-- ⚠️ Ha van eredmény → KRITIKUS HIBA!`,
                    },
                    {
                        id: 'backlog-rule',
                        title: 'BACKLOG RULE (Tegnapi tiltás C5/C6)',
                        type: 'MANDATORY',
                        shortDesc: 'C5/C6 fázisban TILOS tegnapi MIXLOT/SKW, F7-ben ENGEDETT',
                        whyList: ['Élelmiszerbiztonsági időablak', 'QC kontroll', 'Audit követelés'],
                        triggerCode: `CREATE OR REPLACE FUNCTION enforce_no_yesterday_backlog_in_c5_c6()
RETURNS TRIGGER AS $$
DECLARE
  violation_count INTEGER;
  violation_lots TEXT;
BEGIN
  SELECT COUNT(*), STRING_AGG(l.lot_id, ', ')
  INTO violation_count, violation_lots
  FROM event_inputs ei
  JOIN lots l ON l.lot_id = ei.lot_id
  WHERE ei.event_id = NEW.event_id
    AND l.lot_type IN ('MIXLOT', 'SKW')
    AND l.production_date < NEW.event_date
    AND NEW.step_code IN ('C5_MIX', 'C6_SKEWER', 'T5_MIX', 'T6_SKEWER');
  
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'BACKLOG VIOLATION: Yesterday MIXLOT/SKW not allowed: %', 
      violation_lots
    USING HINT = 'Yesterday backlog only allowed in F7 (freeze)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_backlog_rule
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_no_yesterday_backlog_in_c5_c6();`,
                    },
                    {
                        id: 'species-segregation',
                        title: 'SPECIES SEGREGATION',
                        type: 'MANDATORY',
                        shortDesc: 'Egy eseményben/batch-ben NEM keverhető csirke és pulyka',
                        whyList: ['Allergén kontroll', 'Audithivatal követelmény', 'Vevői elvárás'],
                        triggerCode: `CREATE OR REPLACE FUNCTION check_species_segregation()
RETURNS TRIGGER AS $$
DECLARE
  species_count INTEGER;
  species_list TEXT;
BEGIN
  SELECT COUNT(DISTINCT l.species), STRING_AGG(DISTINCT l.species, ', ')
  INTO species_count, species_list
  FROM event_inputs ei
  JOIN lots l ON l.lot_id = ei.lot_id
  WHERE ei.event_id = NEW.event_id;
  
  IF species_count > 1 THEN
    RAISE EXCEPTION 'SPECIES MIXING VIOLATION: Event % has: %', 
      NEW.event_id, species_list
    USING HINT = 'CHICKEN and TURKEY must be processed separately';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_species_segregation
  AFTER INSERT ON event_inputs
  FOR EACH ROW
  EXECUTE FUNCTION check_species_segregation();`,
                        complianceQuery: `-- Audit: Van-e species mixing?
SELECT 
  e.event_id,
  e.step_code,
  COUNT(DISTINCT l.species) AS species_count,
  STRING_AGG(DISTINCT l.species, ', ') AS species_list
FROM events e
JOIN event_inputs ei ON ei.event_id = e.event_id
JOIN lots l ON l.lot_id = ei.lot_id
GROUP BY e.event_id, e.step_code
HAVING COUNT(DISTINCT l.species) > 1;

-- ⚠️ Ha van eredmény → KRITIKUS HIBA!`,
                    },
                    {
                        id: 'ccp-temperature',
                        title: 'CCP TEMPERATURE (Freeze)',
                        type: 'CCP',
                        shortDesc: 'Fagyasztás után maghő ≤ -18°C kötelező',
                        whyList: ['CCP kritikus pont', 'Élelmiszer-biztonság', 'EU követelmény'],
                        viewCode: `CREATE OR REPLACE VIEW freeze_batch_ccp_compliance AS
SELECT 
  fb.freeze_batch_id,
  fb.start_timestamp,
  fb.end_timestamp,
  tp.min_core_temp_celsius,
  tp.timestamp_when_target_reached,
  CASE 
    WHEN tp.min_core_temp_celsius <= -18.0 THEN 'PASS'
    ELSE 'FAIL'
  END AS ccp_compliance,
  qc.decision AS qc_gate_decision,
  qc.corrective_action_id
FROM freeze_batches fb
LEFT JOIN (
  SELECT 
    freeze_batch_id,
    MIN(temperature_celsius) AS min_core_temp_celsius,
    MIN(timestamp) FILTER (WHERE temperature_celsius <= -18.0) 
      AS timestamp_when_target_reached
  FROM temperature_probe_logs
  WHERE probe_type = 'CORE'
  GROUP BY freeze_batch_id
) tp ON tp.freeze_batch_id = fb.freeze_batch_id
LEFT JOIN qc_inspections qc 
  ON qc.event_id = fb.event_id AND qc.gate_type = 'F7';

-- Audit Check: Van-e CCP violation?
SELECT * 
FROM freeze_batch_ccp_compliance
WHERE ccp_compliance = 'FAIL' 
  AND qc_gate_decision != 'REJECTED';

-- ⚠️ Ha van eredmény → azonnali kezelés!`,
                    },
                ],
            },
        ],
    },

    // --- SLIDE 9: API Integráció ---
    {
        id: 9,
        navTitle: '🔌 API Integráció',
        title: '🔌 API Integráció',
        sections: [
            {
                type: 'alert',
                variant: 'warning-box',
                title: '⚠️ API STATUS: OFFLINE',
                content: 'Target Endpoint: http://10.0.0.121:8000/docs<br/>Jelenlegi állapot: <strong>OFFLINE / NOT ACCESSIBLE</strong><br/>Következő lépés: API elérhetőség tesztelés + integráció',
            },
            {
                title: '🎯 Szükséges API Endpointok (Priority)',
                type: 'api-endpoints',
                apiEndpoints: [
                    { method: 'GET', url: '/api/v1/lots', desc: 'List all lots (filters available)', status: 'high' },
                    { method: 'GET', url: '/api/v1/lots/{lot_id}', desc: 'Get specific lot details', status: 'high' },
                    { method: 'GET', url: '/api/v1/traceability/backward/{fg_lot_id}', desc: '1-back upstream trace', status: 'high' },
                    { method: 'GET', url: '/api/v1/traceability/forward/{raw_lot_id}', desc: '1-forward downstream trace', status: 'high' },
                    { method: 'GET', url: '/api/v1/compliance/sku-lock', desc: 'Check SKU lock violations', status: 'high' },
                    { method: 'POST', url: '/api/v1/lots', desc: 'Create new lot (simulation)', status: 'medium' },
                    { method: 'POST', url: '/api/v1/qc-inspections', desc: 'Create QC inspection entry', status: 'medium' },
                ],
            },
            {
                type: 'code',
                codeTitle: 'API Service Class (JavaScript)',
                content: `class DONERAPIService {
    constructor(baseURL = 'http://10.0.0.121:8000') {
        this.baseURL = baseURL;
    }

    async fetchWithAuth(endpoint, options = {}) {
        const response = await fetch(\`\${this.baseURL}\${endpoint}\`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      throw new Error(\`API Error: \${response.status}\`);
    }
    
    return response.json();
  }
  
  // === TRACEABILITY ===
  async getBackwardTrace(fgLotId) {
    return this.fetchWithAuth(\`/api/v1/traceability/backward/\${fgLotId}\`);
  }
  
  async getForwardTrace(rawLotId) {
    return this.fetchWithAuth(\`/api/v1/traceability/forward/\${rawLotId}\`);
  }
  
  // === LOTS ===
  async getLots(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.fetchWithAuth(\`/api/v1/lots?\${params}\`);
  }
  
  async getLotById(lotId) {
    return this.fetchWithAuth(\`/api/v1/lots/\${lotId}\`);
  }
}`,
            },
            {
                title: '🚀 Következő Lépések',
                type: 'list',
                items: [
                    '1. API Elérhetőség Teszt: curl http://10.0.0.121:8000/docs',
                    '2. Ha elérhető: Integráld az API service layer-t',
                    '3. Ha NEM elérhető: Használd a mock data fallback-et',
                    '4. Frontend update: Add hozzá az API hívásokat a prezentációhoz',
                    '5. Testing: Teszteld a traceability és compliance query-ket',
                ],
            },
        ],
    },
]
