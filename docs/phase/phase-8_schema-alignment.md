# Phase 8.1: Schema Alignment — Production Flow Execution Tracking

**Status**: 🔄 In Progress
**Date**: 2026-01-24
**Scope**: Backend schema enhancements for canonical step tracking, lot lifecycle status, and flow version governance

---

## Overview

Phase 8.1 aligns the database schema with the canonical 11-step production flow model. This phase introduces:

1. **Step Index Tracking**: Both production runs and lots track their position in the 0-10 canonical flow
2. **Lot Status Lifecycle**: A 7-state status enum replacing ad-hoc phase tracking
3. **RunStepExecution Model**: Granular execution records for audit and performance tracking
4. **Flow Version Governance**: REVIEW status + immutability enforcement for published versions
5. **Production Run Audit Trail**: Enhanced metadata (started_by, completed_at, idempotency_key)

**Key Principle**: Phase 8.1 focuses on *data structure alignment*, not API changes. Existing endpoints remain compatible; internal schema is enhanced for better traceability and operational support.

---

## Schema Changes

### 1. Lots Table Extensions (Migration 20260124_ph81_01)

**Added Columns**:

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `step_index` | INTEGER | CHECK (0-10 OR NULL) | Canonical flow position when lot was created |
| `status` | VARCHAR(20) | CHECK (valid status) | Lot lifecycle state (CREATED, QUARANTINE, RELEASED, HOLD, REJECTED, CONSUMED, FINISHED) |

**New Indexes**:
- `idx_lots_step_index` — Query lots by step
- `idx_lots_status` — Query lots by status

**Migration Path**:
- Existing lots: `step_index` and `status` initially NULL
- Gradual population as lots are created/updated in Phase 8.1+

### 2. Flow Versions Table Extensions (Migration 20260124_ph81_02)

**Added Columns**:

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `reviewed_by` | UUID | FK to users.id | Who approved this version (REVIEW → PUBLISHED transition) |

**Updated CHECK Constraint**:
- Old: `status IN ('DRAFT','PUBLISHED','ARCHIVED')`
- New: `status IN ('DRAFT','REVIEW','PUBLISHED','DEPRECATED')`

**Status Additions**:
- `REVIEW`: Pending approval (new in Phase 8.1)
- `DEPRECATED`: Replaced by newer version (new in Phase 8.1)

**New Indexes**:
- `idx_flow_versions_status` — Query versions by status

### 3. Production Runs Table Extensions (Migration 20260124_ph81_03)

**Added Columns**:

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `current_step_index` | INTEGER | CHECK (0-10) | Current step in canonical flow (default: 0) |
| `idempotency_key` | UUID | UNIQUE | Duplicate prevention key for run creation |
| `started_by` | UUID | FK to users.id | Who initiated the run (distinct from operator_id) |
| `completed_at` | TIMESTAMPTZ | NULL | When run completed (distinct from ended_at) |

**Migrated Values**:
- `status = 'ACTIVE'` → `status = 'RUNNING'`
- `status = 'CANCELLED'` → `status = 'ABORTED'`

**Updated CHECK Constraint**:
- Old: `status IN ('ACTIVE','COMPLETED','CANCELLED')`
- New: `status IN ('IDLE','RUNNING','HOLD','COMPLETED','ABORTED','ARCHIVED')`

**New Status Values**:
- `IDLE`: Created but not started (replaces missing initial state)
- `HOLD`: Paused due to blocking issue (new in Phase 8.1)
- `ARCHIVED`: Historical record (new in Phase 8.1)

**New Indexes**:
- `idx_production_runs_status` — Query runs by status
- `idx_production_runs_step_index` — Query runs by current step

### 4. RunStepExecution Table (Migration 20260124_ph81_04)

**New Table**: `public.run_step_executions`

**Schema**:

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PRIMARY KEY | Record ID |
| `run_id` | UUID | FK (CASCADE) | Parent production run |
| `step_index` | INTEGER | NOT NULL | Position (0-10) |
| `node_id` | VARCHAR(50) | NOT NULL | Flow node ID for visual correlation |
| `status` | VARCHAR(20) | DEFAULT 'PENDING' | PENDING, IN_PROGRESS, COMPLETED, SKIPPED |
| `started_at` | TIMESTAMPTZ | NULL | When operator began step |
| `completed_at` | TIMESTAMPTZ | NULL | When operator finished step |
| `operator_id` | UUID | FK to users.id | Which user executed this step |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |

**Composite Key**:
- Implicit: `(run_id, step_index)` — one execution per step per run

**Cascade Behavior**:
- ON DELETE CASCADE from production_runs — cleanup on run deletion

**Creation Pattern**:
- When production run is created → initialize 11 RunStepExecution records (step_index 0-10, all status='PENDING')

### 5. Flow Version Immutability Trigger (Migration 20260124_ph81_05)

**New Trigger**: `prevent_published_flow_update`

**Enforcement**:
- When `status = 'PUBLISHED'`, prevent UPDATE to `graph_schema` column
- Allow status change to DEPRECATED (non-data-modifying transition)
- Raise exception: "Published flow versions are immutable"

**Rationale**: Ensures production runs always execute against approved flow definitions.

---

## Enum Changes

### LotStatus (New)

```python
class LotStatus(str, enum.Enum):
    """Lot lifecycle status per INITIAL-11."""
    CREATED = "CREATED"           # Initial state after registration
    QUARANTINE = "QUARANTINE"     # Awaiting QC approval
    RELEASED = "RELEASED"         # QC passed, ready for use
    HOLD = "HOLD"                 # Blocked pending investigation
    REJECTED = "REJECTED"         # Failed QC, not usable
    CONSUMED = "CONSUMED"         # Used in downstream processing
    FINISHED = "FINISHED"         # Production complete
```

**State Diagram**:
```
CREATED → QUARANTINE → RELEASED → CONSUMED → FINISHED
           ↓                ↓
           REJECTED      HOLD → (RELEASED or REJECTED)
```

### LotType (Extended)

Added SKU-specific variants and shipment tracking:

```python
class LotType(str, enum.Enum):
    RAW = "RAW"       # Raw material
    DEB = "DEB"       # Deboned meat
    BULK = "BULK"     # Bulk buffer
    MIX = "MIX"       # Mixed batch
    # New SKU-specific types (Phase 8.1)
    SKW15 = "SKW15"   # 15g skewer rod
    SKW30 = "SKW30"   # 30g skewer rod
    FRZ15 = "FRZ15"   # Frozen 15g
    FRZ30 = "FRZ30"   # Frozen 30g
    FG15 = "FG15"     # Finished goods 15g
    FG30 = "FG30"     # Finished goods 30g
    PAL = "PAL"       # Pallet
    SHIP = "SHIP"     # Shipment
    # Legacy (backward compatible)
    SKW = "SKW"       # Skewered (any size)
    FRZ = "FRZ"       # Frozen (any size)
    FG = "FG"         # Finished goods (any size)
```

### RunStatus (Updated)

Phase 8.1 replaces legacy ACTIVE/CANCELLED with expanded lifecycle:

```python
class RunStatus(str, enum.Enum):
    """Production run status per INITIAL-11."""
    IDLE = "IDLE"          # Created but not started
    RUNNING = "RUNNING"    # Active execution (was ACTIVE)
    HOLD = "HOLD"          # Paused due to blocking issue
    COMPLETED = "COMPLETED"  # Successfully finished
    ABORTED = "ABORTED"    # Terminated early (was CANCELLED)
    ARCHIVED = "ARCHIVED"  # Historical record
```

**Migration**:
- ACTIVE → RUNNING
- CANCELLED → ABORTED

### FlowVersionStatus (Enhanced)

Added REVIEW and DEPRECATED states:

```python
class FlowVersionStatus(str, enum.Enum):
    """Flow version lifecycle states."""
    DRAFT = "DRAFT"             # Work in progress
    REVIEW = "REVIEW"           # Pending approval (new Phase 8.1)
    PUBLISHED = "PUBLISHED"     # Active production version (immutable)
    DEPRECATED = "DEPRECATED"   # Replaced by newer version (new Phase 8.1)
```

### StepExecutionStatus (New)

```python
class StepExecutionStatus(str, enum.Enum):
    """Execution status per step within a run."""
    PENDING = "PENDING"          # Not yet started
    IN_PROGRESS = "IN_PROGRESS"  # Currently being executed
    COMPLETED = "COMPLETED"      # Finished successfully
    SKIPPED = "SKIPPED"          # Bypassed (e.g., run ended early)
```

---

## Model Relationships (Updated)

### ProductionRun Additions

New foreign keys:
- `flow_version_id` → `FlowVersion.id` (immutable after creation)
- `started_by` → `User.id` (distinct from operator_id for audit)

New fields:
- `current_step_index: int` (0-10)
- `completed_at: Optional[datetime]` (distinct from ended_at)
- `idempotency_key: Optional[UUID]` (unique, for duplicate prevention)

New relationships:
- `step_executions: List[RunStepExecution]` (cascade delete)
- `starter: Optional[User]` (via started_by FK)

### Lot Additions

New fields:
- `step_index: Optional[int]` (0-10)
- `status: str` (default='CREATED')

Constraints:
- `CHECK (step_index IS NULL OR (step_index >= 0 AND step_index <= 10))`
- `CHECK (status IN (...))`

### FlowVersion Additions

New fields:
- `reviewed_by: Optional[UUID]` (FK to User)

Relationships:
- `reviewer: Optional[User]` (via reviewed_by)
- `production_runs: List[ProductionRun]` (reverse relationship)

### User Additions

New relationships (Phase 8.1):
- `flow_versions_reviewed: List[FlowVersion]` (flows approved by this user)
- `production_runs_started: List[ProductionRun]` (runs initiated by this user)
- `step_executions: List[RunStepExecution]` (steps executed by this user)

---

## Migration Strategy

### Safe Refactor Approach

Phase 8.1 follows the proven safe refactor pattern:

1. **BASELINE** ✅
   - No breaking changes; existing APIs continue to work
   - New columns added with defaults/nullability

2. **CHARACTERIZATION** 🔄
   - Database tests validate schema constraints
   - Characterization tests ensure backward compatibility

3. **REFACTOR** 🔄 (Next phase)
   - API endpoints gradually adopt new fields
   - Business logic layer transitions to new status enums
   - Services layer implements status transition validation

4. **VALIDATE** 🔄 (Next phase)
   - Integration tests verify state transitions
   - Load testing ensures step tracking performance

5. **CLEANUP** 🔄 (Phase 8.2+)
   - Remove legacy ACTIVE/CANCELLED status handling from code
   - Deprecate legacy LotType values if not used

### Backward Compatibility

- **No API changes**: Existing endpoints continue returning same response shapes
- **New fields optional**: `step_index`, `status` nullable on legacy lots
- **Status migration automatic**: Database migration handles ACTIVE→RUNNING conversion
- **Legacy lot types supported**: Old SKW/FRZ/FG values still valid

---

## Deployment & Testing

### Pre-Deployment Checklist

- [ ] All 5 migrations pass in test environment
- [ ] Backward compatibility tests pass (existing APIs unchanged)
- [ ] Schema validation tests pass (constraints enforced)
- [ ] FlowVersion immutability trigger verified
- [ ] Database backups completed

### Post-Deployment Validation

1. Verify migrations applied in order:
   ```sql
   SELECT version FROM alembic_version;
   -- Should show: 20260124_ph81_05
   ```

2. Test immutability trigger:
   ```sql
   -- Try to update published flow
   UPDATE flow_versions SET graph_schema = '{}' WHERE status = 'PUBLISHED';
   -- Should raise: Published flow versions are immutable
   ```

3. Test RunStepExecution creation:
   ```sql
   -- Check that new runs have 11 step executions
   SELECT COUNT(*) FROM run_step_executions WHERE run_id = ?;
   -- Should return: 11
   ```

4. Validate status migration:
   ```sql
   SELECT COUNT(*) FROM production_runs WHERE status = 'ACTIVE';
   -- Should return: 0
   SELECT COUNT(*) FROM production_runs WHERE status = 'RUNNING';
   -- Should return: (count of formerly ACTIVE runs)
   ```

---

## Known Limitations & Future Work

### Phase 8.1 Scope (Current)

**IN SCOPE**:
- Schema alignment (columns, enums, constraints)
- Database migrations with backward compatibility
- Model definitions and relationships
- Flow version governance trigger

**OUT OF SCOPE** (Phase 8.2+):
- API endpoints for step advancement
- Business logic for status transitions
- Lot status history audit table
- RunStepExecution API and visualization
- Flow version approval workflow UI

### Future Enhancements

**Phase 8.2** (Planned):
- `PUT /api/v1/runs/{run_id}/steps/{step_index}` — Advance step execution
- `PATCH /api/v1/lots/{lot_id}/status` — Transition lot status
- Audit log for all status changes
- Performance indexes on step/status queries

**Phase 8.3** (Planned):
- Flow version review/approval UI
- Step execution timeline visualization
- Lot status history view
- Status transition validation rules

---

## Files Changed

### Database Migrations
- `backend/alembic/versions/20260124_phase81_01_add_lot_step_index_status.py`
- `backend/alembic/versions/20260124_phase81_02_enhance_flow_version_status.py`
- `backend/alembic/versions/20260124_phase81_03_enhance_production_runs.py`
- `backend/alembic/versions/20260124_phase81_04_add_run_step_executions.py`
- `backend/alembic/versions/20260124_phase81_05_add_flow_version_immutability_trigger.py`

### Backend Models
- `backend/app/models/lot.py` — LotType, LotStatus, Lot model
- `backend/app/models/production.py` — RunStatus, ProductionRun model
- `backend/app/models/run.py` — RunStepExecution model (new)
- `backend/app/models/flow.py` — FlowVersionStatus, FlowVersion model
- `backend/app/models/user.py` — New relationship fields
- `backend/app/models/__init__.py` — Export RunStepExecution

### Documentation
- `docs/architecture.md` — Updated with Phase 8.1 schema details
- `docs/phase/phase-8_schema-alignment.md` — This file (new)

---

## Testing & Validation

### Database Tests

```bash
# Run migrations in test environment
cd backend
uv run alembic upgrade head

# Validate schema constraints
uv run pytest tests/test_schema_constraints.py -v

# Test backward compatibility
uv run pytest tests/test_backward_compatibility.py -v
```

### Model Tests

```bash
# Test enum values
uv run pytest tests/test_enums.py -v

# Test model relationships
uv run pytest tests/test_model_relationships.py -v
```

---

## References

- **CLAUDE.md**: Section 6 — Python conventions, Pydantic models
- **CLAUDE.md**: Section 7 — Database standards, entity naming
- **architecture.md**: Phase 8.1 Schema Details section
- **INITIAL.md**: Canonical 11-step flow definition
- **HACCP Requirements**: Temperature logging at CCPs (unchanged)

---

**Last Updated**: 2026-01-24
**Prepared by**: Documentation System
**Status**: 🔄 In Progress — Awaiting Phase 8.2 API implementation
