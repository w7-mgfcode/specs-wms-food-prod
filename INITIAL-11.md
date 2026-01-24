# INITIAL-11.md — DÖNER KFT Production Suite Unified Specification

**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-01-24
**Authors:** System Architecture Team

---

## A. Executive Summary

The DÖNER KFT Production Suite currently suffers from **concept drift** across multiple overlapping UIs: Flow Editor, Production Run, First Flow, and Quality Validator. Terminology is inconsistent (Flow vs First Flow vs Run), state machines are implicit, and there is no canonical version pinning between flow definitions and production runs. Buffer inventory appears as a separate "First Flow" screen rather than a contextual view within an active run.

This specification establishes a **Single Source of Truth** architecture where:
1. **FlowVersion** is the canonical definition of process steps, edges, and QC gates.
2. **ProductionRun** is pinned to a Published FlowVersion and remains immutable during execution.
3. **Lot/Batch lifecycle** is derived from RunStepExecution events, not duplicated across UIs.
4. **Quality Validator** consolidates genealogy, compliance checks, and audit logs into one coherent section.

The migration path preserves what works (11-step stepper, buffer board UI, draft/publish workflow) while eliminating ambiguity through strict state machines, idempotent APIs, and hard anti-chaos rules.

---

## B. Core Concepts

| Term | Definition |
|------|------------|
| **Flow** | An abstract workflow definition representing a production process; has multiple versions over time. |
| **FlowVersion** | An immutable snapshot of a Flow at a point in time; contains nodes, edges, and QC configurations. |
| **Publish** | The action that transitions a FlowVersion from DRAFT to PUBLISHED, making it available for production runs. |
| **Step** | A discrete stage in the production process (0–10); represented as a node in a FlowVersion. |
| **Edge** | A directed connection between two Steps defining valid process flow transitions. |
| **Swimlane/Stream** | A logical grouping of Steps by functional area (e.g., Receiving, Processing, Packaging). |
| **Buffer** | A temporary storage location for intermediate lots between Steps; has capacity, temperature, and purity constraints. |
| **QC Gate** | A checkpoint requiring quality inspection before proceeding; may be a Critical Control Point (CCP) for HACCP. |
| **Production Run** | A single execution instance of a Published FlowVersion; tracks progress through Steps from Start to Shipment. |
| **Lot** | A discrete unit of material with full traceability; has a type (RAW, BULK, MIX, SKW, FRZ, FG, PAL). |
| **Batch** | A grouping of Lots processed together in a single Step execution (e.g., a mixing batch). |
| **Genealogy** | The parent-child relationship graph between Lots (1-back = inputs, 1-forward = outputs). |
| **Compliance Check** | A QC inspection record with decision (PASS/HOLD/FAIL), measurements, and operator signature. |
| **Audit Log** | An append-only event stream recording all state changes for regulatory traceability. |

---

## C. Information Architecture (IA)

### C.1 Navigation Structure

| Menu Item | Purpose | Primary Users |
|-----------|---------|---------------|
| **Live Dashboard** | Real-time KPIs, active runs overview, alert summary | All roles |
| **Command Center** | Operator runtime: start runs, advance steps, register lots, buffer moves | Operator, Manager |
| **Quality Validator** | Genealogy queries, compliance inspections, temperature logs, audit trail | Auditor, QC, Manager |
| **Flow Editor** | Design and version flow definitions; draft → review → publish lifecycle | Admin, Engineer |
| **Production Run** | Deep-dive into a specific run: step execution, buffers, QC decisions | Operator, Manager |
| **Presentation** | Read-only display mode for factory floor monitors (no controls) | Viewer |

### C.2 Canonical Route Structure

```
/                           → Redirect to /dashboard
/login                      → Authentication
/dashboard                  → Live Dashboard (V1)

/command                    → Command Center (V2)
/command/run/:runId         → Active Run Controls
/command/run/:runId/buffers → Run Buffers (formerly "First Flow")

/validator                  → Quality Validator (V3)
/validator/genealogy        → Genealogy Query (1-back/1-forward)
/validator/inspections      → Compliance Inspection Log
/validator/audit            → Audit Event Stream

/flow-editor                → Flow Catalog
/flow-editor/:flowId        → Flow Editor (latest draft)
/flow-editor/:flowId/v/:versionNum → Specific Version View
/flow-editor/:flowId/versions → Version History

/run/:runId                 → Production Run Detail (read-only summary)
/run/:runId/steps           → Step Execution Timeline
/run/:runId/lots            → Lot Registry for Run
/run/:runId/qc              → QC Decisions for Run

/presentation               → Factory Floor Display
/presentation/:runId        → Single Run Presentation
```

### C.3 "First Flow" → Run Buffers Migration

The existing "First Flow" screen showing buffer inventory boards (LK Buffer, MIX Buffer, SKW15 Buffer, SKW30 Buffer) becomes a **contextual tab** within an active Production Run:

- **Route:** `/command/run/:runId/buffers`
- **Behavior:** Shows only buffers relevant to the current run's FlowVersion
- **Data Source:** Derived from `InventoryItem` table filtered by `run_id` and `buffer_id`
- **No standalone access:** Buffer board requires an active run context

---

## D. Canonical State Machines

### D.1 Flow Lifecycle

```
┌─────────┐    save     ┌─────────┐   submit   ┌──────────┐   approve   ┌───────────┐
│  DRAFT  │ ──────────► │  DRAFT  │ ─────────► │  REVIEW  │ ──────────► │ PUBLISHED │
└─────────┘             └─────────┘            └──────────┘             └───────────┘
     │                       │                      │                         │
     │ discard               │ discard              │ reject                  │ deprecate
     ▼                       ▼                      ▼                         ▼
┌─────────┐             ┌─────────┐            ┌─────────┐             ┌────────────┐
│ DELETED │             │ DELETED │            │  DRAFT  │             │ DEPRECATED │
└─────────┘             └─────────┘            └─────────┘             └────────────┘
```

**Transitions:**
| From | To | Trigger | Guard |
|------|-----|---------|-------|
| DRAFT | REVIEW | `submitForReview()` | All required nodes present; at least one Start and one End |
| REVIEW | PUBLISHED | `approve()` | Reviewer role; no validation errors |
| REVIEW | DRAFT | `reject(reason)` | Reviewer role |
| PUBLISHED | DEPRECATED | `deprecate()` | Admin role; no active runs using this version |
| DRAFT | DELETED | `discard()` | Owner or Admin role |

**Invariants:**
- PUBLISHED versions are **immutable** — no edits allowed.
- Only **one PUBLISHED version** per Flow at a time (previous becomes DEPRECATED on new publish).
- DEPRECATED versions remain queryable for historical runs.

### D.2 Production Run Lifecycle

```
┌────────┐   start    ┌─────────┐   advance   ┌─────────┐   complete   ┌───────────┐
│  IDLE  │ ─────────► │ RUNNING │ ◄─────────► │ RUNNING │ ───────────► │ COMPLETED │
└────────┘            └─────────┘             └─────────┘              └───────────┘
                           │                       │
                           │ hold                  │ hold
                           ▼                       ▼
                      ┌─────────┐            ┌─────────┐
                      │  HOLD   │ ◄─────────►│  HOLD   │
                      └─────────┘   resume   └─────────┘
                           │
                           │ abort
                           ▼
                      ┌─────────┐   archive   ┌──────────┐
                      │ ABORTED │ ──────────► │ ARCHIVED │
                      └─────────┘             └──────────┘
```

**Transitions:**
| From | To | Trigger | Guard |
|------|-----|---------|-------|
| IDLE | RUNNING | `startRun(flowVersionId)` | FlowVersion is PUBLISHED |
| RUNNING | RUNNING | `advanceStep(toStepIndex)` | Current step QC passed; valid edge exists |
| RUNNING | HOLD | `holdRun(reason)` | Operator or QC role |
| HOLD | RUNNING | `resumeRun()` | Hold issue resolved; Manager approval |
| RUNNING | COMPLETED | `completeRun()` | Current step = 10 (Shipment); all QC passed |
| HOLD | ABORTED | `abortRun(reason)` | Manager or Admin role |
| COMPLETED/ABORTED | ARCHIVED | `archiveRun()` | 30-day retention period passed |

**Invariants:**
- A Run is **pinned** to its FlowVersion at start and never changes.
- Step advancement is sequential (0 → 1 → ... → 10) unless rollback is explicitly invoked.
- COMPLETED runs are **read-only** — no further modifications.

### D.3 Lot/Batch Lifecycle

```
┌─────────┐  register   ┌────────────┐   qc_pass    ┌──────────┐
│ CREATED │ ──────────► │ QUARANTINE │ ───────────► │ RELEASED │
└─────────┘             └────────────┘              └──────────┘
                              │                          │
                              │ qc_hold                  │ consume
                              ▼                          ▼
                         ┌────────┐                ┌──────────┐
                         │  HOLD  │                │ CONSUMED │
                         └────────┘                └──────────┘
                              │                          │
                              │ qc_fail                  │ (output lot)
                              ▼                          ▼
                         ┌──────────┐             ┌──────────┐
                         │ REJECTED │             │ FINISHED │
                         └──────────┘             └──────────┘
```

**Transitions:**
| From | To | Trigger | Guard |
|------|-----|---------|-------|
| CREATED | QUARANTINE | `registerLot()` | Lot code valid; run is RUNNING |
| QUARANTINE | RELEASED | `passQC(inspectionId)` | QC decision = PASS |
| QUARANTINE | HOLD | `holdQC(inspectionId, reason)` | QC decision = HOLD; reason ≥ 10 chars |
| QUARANTINE | REJECTED | `failQC(inspectionId, reason)` | QC decision = FAIL; reason ≥ 10 chars |
| HOLD | RELEASED | `resolveHold(resolution)` | Manager approval |
| HOLD | REJECTED | `confirmReject()` | Manager approval |
| RELEASED | CONSUMED | `consumeLot(outputLotId)` | Valid genealogy link created |
| CONSUMED | FINISHED | `finishLot()` | All child lots completed |

**Invariants:**
- RAW lots enter at Step 1 (Receipt), FG lots exit at Step 10 (Shipment).
- REJECTED lots are quarantined physically and flagged for disposal/rework.
- Lot status changes emit AuditEvents with full before/after state.

---

## E. Step-by-Step User Journeys

### E.1 Operator Journey: Start Run → Finished Goods

1. **Login** → Authenticate with badge scan or credentials.
2. **Command Center** → View available Published FlowVersions.
3. **Start Run** → Select FlowVersion, confirm → Run created in IDLE → transitions to RUNNING at Step 0.
4. **Receipt (Step 1)** → Scan incoming RAW lots, register with supplier/weight/temperature.
5. **QC Gate** → Pass receipt inspection (temperature ≤ 4°C) → lot RELEASED.
6. **Deboning (Step 2)** → Register DEB lots with genealogy (RAW → DEB).
7. **Buffer Move** → Move DEB lots to LK Buffer via `/command/run/:runId/buffers`.
8. **Bulk Buffer (Step 3)** → Aggregate lots into BULK lots.
9. **Mixing (Step 4)** → Create MIX lots from BULK inputs; record batch recipe.
10. **Skewering (Step 5)** → Split MIX into SKW15/SKW30 lots.
11. **SKU Split (Step 6)** → Allocate to type-specific buffers (SKW15 Buffer, SKW30 Buffer).
12. **Freezing (Step 7)** → Create FRZ lots; pass CCP temperature check (≤ -18°C core).
13. **Packaging (Step 8)** → Create FG lots with label/barcode.
14. **Palletizing (Step 9)** → Aggregate FG lots into PAL lots.
15. **Shipment (Step 10)** → Assign to SHIP lot; complete run → COMPLETED.

### E.2 QC/Auditor Journey: Validation → Genealogy → Sign-off

1. **Login** → Authenticate with QC role.
2. **Quality Validator** → View pending inspections queue.
3. **Inspection** → Select lot → record temperature, visual check, weight → decision: PASS/HOLD/FAIL.
4. **Hold Investigation** → If HOLD, record investigation notes → escalate to Manager.
5. **Genealogy Query** → Navigate to `/validator/genealogy`.
6. **1-Back Trace** → Enter lot code → view all parent lots (inputs).
7. **1-Forward Trace** → View all child lots (outputs).
8. **Audit Log** → Review all events for a specific lot or run.
9. **Sign-off** → Digitally sign inspection record with timestamp.

### E.3 Admin/Engineer Journey: Edit Flow → Version → Publish

1. **Login** → Authenticate with Admin/Engineer role.
2. **Flow Editor** → Navigate to `/flow-editor`.
3. **Create/Edit Flow** → Open existing Flow or create new.
4. **Add Nodes** → Drag Start, Process, QC Gate, Buffer, End nodes.
5. **Configure Nodes** → Set labels (HU/EN), step index, CCP flags, buffer constraints.
6. **Add Edges** → Connect nodes to define valid transitions.
7. **Save Draft** → Auto-save or manual save → FlowVersion remains DRAFT.
8. **Submit for Review** → Click "Submit" → FlowVersion transitions to REVIEW.
9. **Review** → Manager reviews in read-only mode → Approve or Reject.
10. **Publish** → On approval, FlowVersion transitions to PUBLISHED.
11. **Verify** → Confirm new version appears in Command Center for run creation.
12. **Deprecate Old** → Previous PUBLISHED version auto-transitions to DEPRECATED.

---

## F. Data Model

### F.1 Logical Tables

#### Core Flow Tables

```
┌─────────────────────────────────────────────────────────────────┐
│ flow_definitions                                                │
├─────────────────────────────────────────────────────────────────┤
│ PK  id              UUID           DEFAULT gen_random_uuid()    │
│     name            JSONB          NOT NULL (LocalizedString)   │
│     description     TEXT           NULL                         │
│     created_by      UUID           FK → users.id                │
│     created_at      TIMESTAMPTZ    DEFAULT NOW()                │
│     updated_at      TIMESTAMPTZ    DEFAULT NOW()                │
├─────────────────────────────────────────────────────────────────┤
│ INDEX idx_flow_definitions_created_by (created_by)              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ flow_versions                                                   │
├─────────────────────────────────────────────────────────────────┤
│ PK  id                  UUID         DEFAULT gen_random_uuid()  │
│     flow_definition_id  UUID         FK → flow_definitions.id   │
│     version_num         INTEGER      NOT NULL                   │
│     status              VARCHAR(20)  NOT NULL (enum below)      │
│     graph_schema        JSONB        NOT NULL                   │
│     created_by          UUID         FK → users.id              │
│     reviewed_by         UUID         FK → users.id NULL         │
│     published_at        TIMESTAMPTZ  NULL                       │
│     published_by        UUID         FK → users.id NULL         │
│     created_at          TIMESTAMPTZ  DEFAULT NOW()              │
├─────────────────────────────────────────────────────────────────┤
│ UNIQUE (flow_definition_id, version_num)                        │
│ INDEX idx_flow_versions_status (status)                         │
│ CHECK status IN ('DRAFT','REVIEW','PUBLISHED','DEPRECATED')     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ graph_schema (JSONB structure within flow_versions)             │
├─────────────────────────────────────────────────────────────────┤
│ {                                                               │
│   "nodes": [                                                    │
│     {                                                           │
│       "id": "node-1",                                           │
│       "type": "start|process|qc_gate|buffer|group|end",         │
│       "position": {"x": 100, "y": 200},                         │
│       "data": {                                                 │
│         "label": {"hu": "...", "en": "..."},                    │
│         "nodeType": "start",                                    │
│         "stepIndex": 0,                                         │
│         "config": {"isCCP": false, "bufferType": null}          │
│       }                                                         │
│     }                                                           │
│   ],                                                            │
│   "edges": [                                                    │
│     {"id": "e1", "source": "node-1", "target": "node-2"}        │
│   ],                                                            │
│   "viewport": {"x": 0, "y": 0, "zoom": 1}                       │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

#### Production Run Tables

```
┌─────────────────────────────────────────────────────────────────┐
│ production_runs                                                 │
├─────────────────────────────────────────────────────────────────┤
│ PK  id                  UUID          DEFAULT gen_random_uuid() │
│     run_code            VARCHAR(30)   NOT NULL UNIQUE           │
│     flow_version_id     UUID          FK → flow_versions.id     │
│     status              VARCHAR(20)   NOT NULL (enum below)     │
│     current_step_index  INTEGER       NOT NULL DEFAULT 0        │
│     started_by          UUID          FK → users.id             │
│     started_at          TIMESTAMPTZ   NULL                      │
│     completed_at        TIMESTAMPTZ   NULL                      │
│     created_at          TIMESTAMPTZ   DEFAULT NOW()             │
├─────────────────────────────────────────────────────────────────┤
│ INDEX idx_production_runs_status (status)                       │
│ INDEX idx_production_runs_flow_version (flow_version_id)        │
│ CHECK status IN ('IDLE','RUNNING','HOLD','COMPLETED','ABORTED', │
│                  'ARCHIVED')                                    │
│ CHECK run_code ~ '^RUN-\d{8}-[A-Z]{4}-\d{4}$'                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ run_step_executions                                             │
├─────────────────────────────────────────────────────────────────┤
│ PK  id                UUID          DEFAULT gen_random_uuid()   │
│     run_id            UUID          FK → production_runs.id     │
│     step_index        INTEGER       NOT NULL (0-10)             │
│     node_id           VARCHAR(50)   NOT NULL (from graph_schema)│
│     status            VARCHAR(20)   NOT NULL                    │
│     started_at        TIMESTAMPTZ   NULL                        │
│     completed_at      TIMESTAMPTZ   NULL                        │
│     operator_id       UUID          FK → users.id               │
│     created_at        TIMESTAMPTZ   DEFAULT NOW()               │
├─────────────────────────────────────────────────────────────────┤
│ UNIQUE (run_id, step_index)                                     │
│ INDEX idx_run_step_executions_run (run_id)                      │
│ CHECK status IN ('PENDING','IN_PROGRESS','COMPLETED','SKIPPED') │
│ CHECK step_index BETWEEN 0 AND 10                               │
└─────────────────────────────────────────────────────────────────┘
```

#### Lot & Inventory Tables

```
┌─────────────────────────────────────────────────────────────────┐
│ lots                                                            │
├─────────────────────────────────────────────────────────────────┤
│ PK  id                UUID          DEFAULT gen_random_uuid()   │
│     lot_code          VARCHAR(30)   NOT NULL UNIQUE             │
│     lot_type          VARCHAR(10)   NOT NULL (enum below)       │
│     run_id            UUID          FK → production_runs.id     │
│     step_index        INTEGER       NOT NULL                    │
│     status            VARCHAR(20)   NOT NULL                    │
│     weight_kg         DECIMAL(10,2) NOT NULL                    │
│     sku_type          VARCHAR(10)   NULL (15 or 30 for SKW/FRZ) │
│     supplier_id       UUID          FK → suppliers.id NULL      │
│     created_by        UUID          FK → users.id               │
│     created_at        TIMESTAMPTZ   DEFAULT NOW()               │
├─────────────────────────────────────────────────────────────────┤
│ INDEX idx_lots_run (run_id)                                     │
│ INDEX idx_lots_type_status (lot_type, status)                   │
│ INDEX idx_lots_code (lot_code)                                  │
│ CHECK lot_type IN ('RAW','DEB','BULK','MIX','SKW15','SKW30',    │
│                    'FRZ15','FRZ30','FG15','FG30','PAL','SHIP')  │
│ CHECK status IN ('CREATED','QUARANTINE','RELEASED','HOLD',      │
│                  'REJECTED','CONSUMED','FINISHED')              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ buffers                                                         │
├─────────────────────────────────────────────────────────────────┤
│ PK  id                UUID          DEFAULT gen_random_uuid()   │
│     buffer_code       VARCHAR(20)   NOT NULL UNIQUE             │
│     buffer_type       VARCHAR(20)   NOT NULL                    │
│     allowed_lot_types VARCHAR(10)[] NOT NULL                    │
│     capacity_kg       DECIMAL(10,2) NOT NULL                    │
│     temp_min_c        DECIMAL(5,1)  NOT NULL                    │
│     temp_max_c        DECIMAL(5,1)  NOT NULL                    │
│     is_active         BOOLEAN       DEFAULT TRUE                │
├─────────────────────────────────────────────────────────────────┤
│ CHECK buffer_type IN ('LK','MIX','SKW15','SKW30','FRZ','PAL')   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ inventory_items (stock in buffers)                              │
├─────────────────────────────────────────────────────────────────┤
│ PK  id                UUID          DEFAULT gen_random_uuid()   │
│     lot_id            UUID          FK → lots.id                │
│     buffer_id         UUID          FK → buffers.id             │
│     run_id            UUID          FK → production_runs.id     │
│     quantity_kg       DECIMAL(10,2) NOT NULL                    │
│     entered_at        TIMESTAMPTZ   DEFAULT NOW()               │
│     exited_at         TIMESTAMPTZ   NULL                        │
├─────────────────────────────────────────────────────────────────┤
│ INDEX idx_inventory_buffer (buffer_id) WHERE exited_at IS NULL  │
│ INDEX idx_inventory_lot (lot_id)                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ stock_moves                                                     │
├─────────────────────────────────────────────────────────────────┤
│ PK  id                UUID          DEFAULT gen_random_uuid()   │
│     lot_id            UUID          FK → lots.id                │
│     from_buffer_id    UUID          FK → buffers.id NULL        │
│     to_buffer_id      UUID          FK → buffers.id NULL        │
│     quantity_kg       DECIMAL(10,2) NOT NULL                    │
│     move_type         VARCHAR(20)   NOT NULL                    │
│     operator_id       UUID          FK → users.id               │
│     idempotency_key   UUID          NOT NULL UNIQUE             │
│     created_at        TIMESTAMPTZ   DEFAULT NOW()               │
├─────────────────────────────────────────────────────────────────┤
│ CHECK move_type IN ('RECEIVE','TRANSFER','CONSUME','SHIP')      │
│ CHECK (from_buffer_id IS NOT NULL OR to_buffer_id IS NOT NULL)  │
└─────────────────────────────────────────────────────────────────┘
```

#### Genealogy & QC Tables

```
┌─────────────────────────────────────────────────────────────────┐
│ genealogy_links                                                 │
├─────────────────────────────────────────────────────────────────┤
│ PK  id                UUID          DEFAULT gen_random_uuid()   │
│     parent_lot_id     UUID          FK → lots.id                │
│     child_lot_id      UUID          FK → lots.id                │
│     quantity_used_kg  DECIMAL(10,2) NOT NULL                    │
│     created_at        TIMESTAMPTZ   DEFAULT NOW()               │
├─────────────────────────────────────────────────────────────────┤
│ UNIQUE (parent_lot_id, child_lot_id)                            │
│ INDEX idx_genealogy_parent (parent_lot_id)                      │
│ INDEX idx_genealogy_child (child_lot_id)                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ qc_inspections                                                  │
├─────────────────────────────────────────────────────────────────┤
│ PK  id                UUID          DEFAULT gen_random_uuid()   │
│     lot_id            UUID          FK → lots.id                │
│     run_id            UUID          FK → production_runs.id     │
│     step_index        INTEGER       NOT NULL                    │
│     inspection_type   VARCHAR(30)   NOT NULL                    │
│     is_ccp            BOOLEAN       NOT NULL DEFAULT FALSE      │
│     decision          VARCHAR(10)   NOT NULL                    │
│     notes             TEXT          NULL                        │
│     inspector_id      UUID          FK → users.id               │
│     inspected_at      TIMESTAMPTZ   DEFAULT NOW()               │
│     idempotency_key   UUID          NOT NULL UNIQUE             │
├─────────────────────────────────────────────────────────────────┤
│ INDEX idx_qc_inspections_lot (lot_id)                           │
│ INDEX idx_qc_inspections_run (run_id)                           │
│ CHECK decision IN ('PASS','HOLD','FAIL')                        │
│ CHECK (decision = 'PASS') OR (notes IS NOT NULL AND             │
│        LENGTH(notes) >= 10)                                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ temperature_logs                                                │
├─────────────────────────────────────────────────────────────────┤
│ PK  id                UUID          DEFAULT gen_random_uuid()   │
│     lot_id            UUID          FK → lots.id NULL           │
│     buffer_id         UUID          FK → buffers.id NULL        │
│     inspection_id     UUID          FK → qc_inspections.id NULL │
│     temperature_c     DECIMAL(5,1)  NOT NULL                    │
│     measurement_type  VARCHAR(20)   NOT NULL                    │
│     is_violation      BOOLEAN       NOT NULL DEFAULT FALSE      │
│     recorded_by       UUID          FK → users.id               │
│     recorded_at       TIMESTAMPTZ   DEFAULT NOW()               │
├─────────────────────────────────────────────────────────────────┤
│ INDEX idx_temp_logs_lot (lot_id)                                │
│ INDEX idx_temp_logs_buffer (buffer_id)                          │
│ CHECK measurement_type IN ('SURFACE','CORE','AMBIENT')          │
└─────────────────────────────────────────────────────────────────┘
```

#### Audit Log Table

```
┌─────────────────────────────────────────────────────────────────┐
│ audit_events (APPEND-ONLY)                                      │
├─────────────────────────────────────────────────────────────────┤
│ PK  id                BIGSERIAL     PRIMARY KEY                 │
│     event_type        VARCHAR(50)   NOT NULL                    │
│     entity_type       VARCHAR(30)   NOT NULL                    │
│     entity_id         UUID          NOT NULL                    │
│     user_id           UUID          FK → users.id               │
│     old_state         JSONB         NULL                        │
│     new_state         JSONB         NULL                        │
│     metadata          JSONB         DEFAULT '{}'                │
│     ip_address        INET          NULL                        │
│     created_at        TIMESTAMPTZ   DEFAULT NOW()               │
├─────────────────────────────────────────────────────────────────┤
│ INDEX idx_audit_entity (entity_type, entity_id)                 │
│ INDEX idx_audit_created (created_at)                            │
│ INDEX idx_audit_user (user_id)                                  │
│ -- NO UPDATE OR DELETE triggers; append-only enforced           │
└─────────────────────────────────────────────────────────────────┘
```

### F.2 Key Enums

```sql
-- Lot Types (12 values)
CREATE TYPE lot_type_enum AS ENUM (
    'RAW',      -- Raw material receipt
    'DEB',      -- Deboned meat
    'BULK',     -- Bulk buffer aggregate
    'MIX',      -- Mixed batch
    'SKW15',    -- 15g skewer rod
    'SKW30',    -- 30g skewer rod
    'FRZ15',    -- Frozen 15g
    'FRZ30',    -- Frozen 30g
    'FG15',     -- Finished goods 15g
    'FG30',     -- Finished goods 30g
    'PAL',      -- Pallet
    'SHIP'      -- Shipment
);

-- Flow Version Status
CREATE TYPE flow_version_status AS ENUM (
    'DRAFT', 'REVIEW', 'PUBLISHED', 'DEPRECATED'
);

-- Production Run Status
CREATE TYPE run_status AS ENUM (
    'IDLE', 'RUNNING', 'HOLD', 'COMPLETED', 'ABORTED', 'ARCHIVED'
);

-- Lot Status
CREATE TYPE lot_status AS ENUM (
    'CREATED', 'QUARANTINE', 'RELEASED', 'HOLD', 'REJECTED', 'CONSUMED', 'FINISHED'
);

-- QC Decision
CREATE TYPE qc_decision AS ENUM (
    'PASS', 'HOLD', 'FAIL'
);
```

### F.3 Naming Conventions

| Entity | Pattern | Example |
|--------|---------|---------|
| Production Run | `RUN-YYYYMMDD-SITE-####` | `RUN-20260124-DUNA-0001` |
| RAW Lot | `RAW-YYYYMMDD-SITE-####` | `RAW-20260124-DUNA-0042` |
| DEB Lot | `DEB-YYYYMMDD-SITE-####` | `DEB-20260124-DUNA-0108` |
| BULK Lot | `BULK-YYYYMMDD-SITE-####` | `BULK-20260124-DUNA-0015` |
| MIX Lot | `MIXLOT-YYYYMMDD-SITE-####` | `MIXLOT-20260124-DUNA-0003` |
| SKW15 Lot | `SKW15-YYYYMMDD-SITE-####` | `SKW15-20260124-DUNA-0201` |
| SKW30 Lot | `SKW30-YYYYMMDD-SITE-####` | `SKW30-20260124-DUNA-0089` |
| FRZ15 Lot | `FRZ15-YYYYMMDD-SITE-####` | `FRZ15-20260124-DUNA-0201` |
| FRZ30 Lot | `FRZ30-YYYYMMDD-SITE-####` | `FRZ30-20260124-DUNA-0089` |
| FG15 Lot | `FG15-YYYYMMDD-SITE-####` | `FG15-20260124-DUNA-0201` |
| FG30 Lot | `FG30-YYYYMMDD-SITE-####` | `FG30-20260124-DUNA-0089` |
| Pallet | `PAL-YYYYMMDD-SITE-####` | `PAL-20260124-DUNA-0012` |
| Shipment | `SHIP-YYYYMMDD-SITE-####` | `SHIP-20260124-DUNA-0001` |

---

## G. API Surface

All write endpoints require an `Idempotency-Key` header (UUID v4).

### G.1 Flow Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/flows` | List all flow definitions |
| `POST` | `/api/flows` | Create new flow definition |
| `GET` | `/api/flows/{flowId}` | Get flow definition with latest version |
| `PUT` | `/api/flows/{flowId}` | Update flow metadata (name, description) |
| `DELETE` | `/api/flows/{flowId}` | Soft-delete flow (if no versions) |
| `GET` | `/api/flows/{flowId}/versions` | List all versions of a flow |
| `GET` | `/api/flows/{flowId}/versions/{versionNum}` | Get specific version |
| `POST` | `/api/flows/{flowId}/versions` | Create new draft version |
| `PUT` | `/api/flows/{flowId}/versions/{versionNum}` | Update draft version graph |
| `POST` | `/api/flows/{flowId}/versions/{versionNum}/submit` | Submit for review |
| `POST` | `/api/flows/{flowId}/versions/{versionNum}/approve` | Approve and publish |
| `POST` | `/api/flows/{flowId}/versions/{versionNum}/reject` | Reject back to draft |
| `POST` | `/api/flows/{flowId}/versions/{versionNum}/deprecate` | Deprecate published version |

### G.2 Production Run Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/runs` | List production runs (filterable by status) |
| `POST` | `/api/runs` | Start new run (requires `flow_version_id`) |
| `GET` | `/api/runs/{runId}` | Get run details with current step |
| `POST` | `/api/runs/{runId}/advance` | Advance to next step |
| `POST` | `/api/runs/{runId}/rollback` | Rollback to previous step (Manager only) |
| `POST` | `/api/runs/{runId}/hold` | Put run on hold |
| `POST` | `/api/runs/{runId}/resume` | Resume from hold |
| `POST` | `/api/runs/{runId}/complete` | Complete run (from step 10) |
| `POST` | `/api/runs/{runId}/abort` | Abort run |
| `GET` | `/api/runs/{runId}/steps` | Get step execution history |
| `GET` | `/api/runs/{runId}/buffers` | Get buffer inventory for run |

### G.3 Lot & Inventory Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/lots` | List lots (filterable) |
| `POST` | `/api/lots` | Register new lot |
| `GET` | `/api/lots/{lotId}` | Get lot details |
| `PUT` | `/api/lots/{lotId}/status` | Update lot status (QC decision) |
| `GET` | `/api/buffers` | List all buffers |
| `GET` | `/api/buffers/{bufferId}/inventory` | Get current buffer contents |
| `POST` | `/api/inventory/move` | Move lot between buffers |

### G.4 Genealogy & QC

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/genealogy/{lotCode}/parents` | 1-back trace (input lots) |
| `GET` | `/api/genealogy/{lotCode}/children` | 1-forward trace (output lots) |
| `GET` | `/api/genealogy/{lotCode}/tree` | Full genealogy tree |
| `POST` | `/api/qc/inspections` | Record QC inspection |
| `GET` | `/api/qc/inspections` | List inspections (filterable) |
| `GET` | `/api/qc/inspections/{inspectionId}` | Get inspection details |
| `POST` | `/api/temperature-logs` | Record temperature measurement |
| `GET` | `/api/temperature-logs` | List temperature logs |

### G.5 Audit & Compliance

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/audit/events` | Query audit events (filterable) |
| `GET` | `/api/audit/events/{entityType}/{entityId}` | Events for specific entity |
| `GET` | `/api/compliance/report/{runId}` | Generate compliance report for run |

---

## H. Validation & Anti-Chaos Rules

### H.1 Idempotency

**Rule:** All write endpoints MUST include `Idempotency-Key` header.

```
POST /api/lots
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

Response (first call): 201 Created
Response (duplicate): 200 OK (returns existing resource)
```

**Implementation:**
- Store `idempotency_key` in relevant tables with UNIQUE constraint.
- On conflict, return existing record instead of error.
- Keys expire after 24 hours.

### H.2 Version Pinning

**Rule:** A Production Run is pinned to its FlowVersion at creation and CANNOT change.

```sql
-- Enforced by FK + immutability
ALTER TABLE production_runs
ADD CONSTRAINT fk_run_flow_version
FOREIGN KEY (flow_version_id) REFERENCES flow_versions(id);

-- Application-level: Reject updates to flow_version_id after creation
```

**Validation:**
- `POST /api/runs` requires `flow_version_id` pointing to a PUBLISHED version.
- `flow_version_id` is read-only after run creation.

### H.3 Immutable Published Versions

**Rule:** A PUBLISHED FlowVersion cannot be modified.

```sql
CREATE OR REPLACE FUNCTION prevent_published_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'PUBLISHED' THEN
        RAISE EXCEPTION 'Cannot modify PUBLISHED flow version';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_flow_version_immutable
BEFORE UPDATE ON flow_versions
FOR EACH ROW EXECUTE FUNCTION prevent_published_modification();
```

### H.4 QC Required Fields

**Rule:** HOLD and FAIL decisions require `notes` with minimum 10 characters.

```sql
ALTER TABLE qc_inspections
ADD CONSTRAINT chk_qc_notes_required
CHECK (
    decision = 'PASS'
    OR (notes IS NOT NULL AND LENGTH(notes) >= 10)
);
```

### H.5 SKU Lock Rules

**Rule:** FRZ and PAL lots must contain a single SKU type (15 or 30, not mixed).

```sql
-- Enforced at application level during lot creation
-- FRZ15 lots can only have SKW15 parents
-- FRZ30 lots can only have SKW30 parents
-- PAL lots must have homogeneous FG children

CREATE OR REPLACE FUNCTION validate_sku_purity()
RETURNS TRIGGER AS $$
DECLARE
    parent_sku VARCHAR(10);
BEGIN
    IF NEW.lot_type IN ('FRZ15', 'FG15') THEN
        SELECT DISTINCT l.sku_type INTO parent_sku
        FROM genealogy_links gl
        JOIN lots l ON l.id = gl.parent_lot_id
        WHERE gl.child_lot_id = NEW.id;

        IF parent_sku != '15' THEN
            RAISE EXCEPTION 'FRZ15/FG15 lots require SKW15/FRZ15 parents only';
        END IF;
    ELSIF NEW.lot_type IN ('FRZ30', 'FG30') THEN
        -- Similar validation for 30g SKU
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### H.6 Buffer Purity Rules

**Rule:** Buffers only accept lots matching their `allowed_lot_types`.

```sql
CREATE OR REPLACE FUNCTION validate_buffer_lot_type()
RETURNS TRIGGER AS $$
DECLARE
    allowed VARCHAR(10)[];
BEGIN
    SELECT b.allowed_lot_types INTO allowed
    FROM buffers b WHERE b.id = NEW.buffer_id;

    IF NOT (
        SELECT l.lot_type = ANY(allowed)
        FROM lots l WHERE l.id = NEW.lot_id
    ) THEN
        RAISE EXCEPTION 'Lot type not allowed in this buffer';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inventory_buffer_purity
BEFORE INSERT ON inventory_items
FOR EACH ROW EXECUTE FUNCTION validate_buffer_lot_type();
```

**Buffer Configuration:**

| Buffer | Allowed Lot Types |
|--------|-------------------|
| LK Buffer | DEB, BULK |
| MIX Buffer | MIX |
| SKW15 Buffer | SKW15 |
| SKW30 Buffer | SKW30 |
| FRZ Buffer | FRZ15, FRZ30 |
| PAL Buffer | PAL |

### H.7 Temperature Violation → Hold Workflow

**Rule:** Temperature violations trigger automatic HOLD status.

```sql
CREATE OR REPLACE FUNCTION handle_temp_violation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_violation = TRUE AND NEW.lot_id IS NOT NULL THEN
        UPDATE lots SET status = 'HOLD'
        WHERE id = NEW.lot_id AND status = 'RELEASED';

        INSERT INTO audit_events (event_type, entity_type, entity_id, new_state, metadata)
        VALUES ('TEMP_VIOLATION_HOLD', 'lot', NEW.lot_id,
                jsonb_build_object('status', 'HOLD'),
                jsonb_build_object('temperature', NEW.temperature_c,
                                   'violation_type', NEW.measurement_type));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_temp_violation_hold
AFTER INSERT ON temperature_logs
FOR EACH ROW EXECUTE FUNCTION handle_temp_violation();
```

**CCP Temperature Thresholds:**

| Step | Check | Threshold | Action on Violation |
|------|-------|-----------|---------------------|
| Receipt (1) | Surface | ≤ 4°C | HOLD lot |
| Freezing (7) | Core | ≤ -18°C | HOLD lot |
| Storage | Ambient | ≤ -18°C | HOLD buffer |
| Shipment (10) | Ambient | ≤ -18°C | HOLD shipment |

### H.8 Audit Append-Only

**Rule:** Audit events cannot be updated or deleted.

```sql
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit events are append-only and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_no_update
BEFORE UPDATE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER trg_audit_no_delete
BEFORE DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
```

### H.9 Step Advancement Guards

**Rule:** Steps can only advance if current step QC is complete.

```python
# Application-level validation
async def advance_run_step(run_id: UUID, db: AsyncSession):
    run = await get_run(run_id, db)

    # Check current step has completed QC
    pending_qc = await db.execute(
        select(QCInspection)
        .where(QCInspection.run_id == run_id)
        .where(QCInspection.step_index == run.current_step_index)
        .where(QCInspection.decision.is_(None))
    )

    if pending_qc.scalar():
        raise HTTPException(400, "Pending QC inspections must be completed")

    # Check no HOLD lots at current step
    held_lots = await db.execute(
        select(Lot)
        .where(Lot.run_id == run_id)
        .where(Lot.step_index == run.current_step_index)
        .where(Lot.status == 'HOLD')
    )

    if held_lots.scalars().all():
        raise HTTPException(400, "Held lots must be resolved before advancing")

    # Advance
    run.current_step_index += 1
    await db.commit()
```

---

## I. Migration Plan

### Phase 1: Schema Alignment (Week 1)

1. **Add `step_index` to all relevant tables**
   - Add `step_index INTEGER CHECK (step_index BETWEEN 0 AND 10)` to:
     - `lots`
     - `qc_inspections`
     - `run_step_executions`
   - Migrate existing data using node position mapping.

2. **Ensure FlowVersion pinning**
   - Add FK constraint `production_runs.flow_version_id → flow_versions.id`.
   - Backfill existing runs with their original flow version (or latest published).

### Phase 2: Route Consolidation (Week 2)

3. **Rename routes**
   - `/first-flow` → `/command/run/:runId/buffers`
   - `/flow-v1` → `/dashboard`
   - `/flow-v2` → `/command`
   - `/flow-v3` → `/validator`

4. **Move buffer board into run context**
   - Modify `FirstFlowPage` to require `runId` parameter.
   - Update navigation to show "Buffers" as tab within active run.

### Phase 3: State Machine Enforcement (Week 3)

5. **Add flow lifecycle states**
   - Add `REVIEW` and `DEPRECATED` to flow version status enum.
   - Implement `submitForReview()` and `approve()` API endpoints.
   - Add DB trigger to prevent PUBLISHED version modification.

6. **Add lot lifecycle enforcement**
   - Add `QUARANTINE` state between `CREATED` and `RELEASED`.
   - Require QC inspection before status can transition to `RELEASED`.

### Phase 4: QC Unification (Week 4)

7. **Consolidate QC and genealogy views**
   - Merge genealogy query UI into `/validator/genealogy`.
   - Add 1-back and 1-forward buttons to lot detail views.
   - Ensure all QC decisions emit audit events.

### Phase 5: Terminology Cleanup (Week 5)

8. **Update all UI labels and code comments**
   - Replace "First Flow" with "Run Buffers" everywhere.
   - Replace "Flow" (when meaning run) with "Production Run".
   - Update CLAUDE.md and documentation.

---

## J. Open Questions / Assumptions

### Open Questions

1. **Role granularity:** Current RBAC has 5 roles (ADMIN, MANAGER, AUDITOR, OPERATOR, VIEWER). Is finer-grained permission needed (e.g., separate "can approve flow" from "can start run")?

2. **Multi-site support:** Is `SITE` code (e.g., `DUNA`) sufficient, or do we need full multi-tenancy with isolated data?

3. **GS1/SSCC compliance:** Do pallet/shipment lots need GS1-128 barcodes with SSCC? What is the company prefix?

4. **Rework routing:** How should REJECTED lots be handled? Disposal only, or rework path back to earlier step?

5. **Partial lot consumption:** Can a lot be partially consumed across multiple child lots, or is it always fully consumed?

6. **Concurrent runs:** Can multiple runs of the same FlowVersion be active simultaneously?

7. **Temperature logging frequency:** Is manual logging sufficient, or do we need IoT sensor integration for continuous monitoring?

8. **Offline mode:** Do operators need offline capability when network is unavailable?

### Assumptions Made

1. **Single active published version:** Each Flow has at most one PUBLISHED version at a time (previous becomes DEPRECATED).

2. **Sequential step advancement:** Steps progress 0 → 1 → 2 → ... → 10 without skipping (except explicit rollback).

3. **Lot immutability:** Once a lot transitions to CONSUMED or FINISHED, its core attributes cannot change.

4. **Hungarian primary language:** HU is the primary UI language; EN is secondary. All labels support both.

5. **UTC timestamps:** All timestamps are stored in UTC; displayed in local timezone (Europe/Budapest).

6. **No lot splitting:** A lot cannot be split; to divide material, create new child lots with genealogy links.

7. **Buffer capacity soft limit:** Exceeding buffer capacity shows a warning but doesn't block operations (Manager override available).

8. **30-day audit retention online:** Audit events older than 30 days are archived to cold storage but remain queryable.

---

## Appendix: Canonical 11-Step Reference

| Index | Step Name | Lot Types Created | QC Gate | CCP |
|-------|-----------|-------------------|---------|-----|
| 0 | Start | — | No | No |
| 1 | Receipt | RAW | Yes | Yes (temp) |
| 2 | Deboning | DEB | Yes | No |
| 3 | Bulk Buffer | BULK | No | No |
| 4 | Mixing | MIX | Yes | No |
| 5 | Skewering | SKW15, SKW30 | Yes | No |
| 6 | SKU Split | — | No | No |
| 7 | Freezing | FRZ15, FRZ30 | Yes | Yes (temp) |
| 8 | Packaging | FG15, FG30 | Yes | No |
| 9 | Palletizing | PAL | Yes | No |
| 10 | Shipment | SHIP | Yes | Yes (temp) |

---

*End of INITIAL-11.md*
