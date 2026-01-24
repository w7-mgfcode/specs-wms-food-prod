# PRP: DÖNER KFT Production Suite Unified Implementation (INITIAL-11)

> **Phase**: 8 - Reconcept / Unified Production Suite
> **Date**: 2026-01-24
> **Status**: READY FOR IMPLEMENTATION
> **Confidence Score**: 7/10

---

## Purpose

Implement the INITIAL-11 specification to unify the DÖNER KFT Production Suite by establishing:
1. **Single Source of Truth** architecture across all UIs
2. **Canonical 11-step model** (indices 0-10) enforced everywhere
3. **State machine enforcement** for Flow, Run, and Lot lifecycles
4. **Version pinning** ensuring runs are immutable once started
5. **Route consolidation** eliminating concept drift

This is a **large-scale refactoring effort** spanning 5 phases over ~5 weeks. Each phase builds on the previous and can be validated independently.

---

## Specification Reference

**Primary Document**: `INITIAL-11.md`

Key sections to reference during implementation:
- **Section D**: Canonical State Machines (Flow, Run, Lot lifecycles)
- **Section F**: Data Model (12 logical tables)
- **Section G**: API Surface (35 REST endpoints)
- **Section H**: Validation & Anti-Chaos Rules (9 hard rules)
- **Section I**: Migration Plan (5 phases)

---

## Implementation Phases Overview

### Phase 8.1: Schema Alignment (Backend Focus)

**Goal**: Add `step_index` to relevant tables, establish FlowVersion pinning, add new lifecycle states.

**Deliverables**:
- Migration: Add `step_index` to `lots`, add new columns to `production_runs`
- Migration: Add `REVIEW` and `DEPRECATED` to flow version status
- Migration: Add `QUARANTINE` to lot status enum
- Update SQLAlchemy models with new enums and columns
- Add DB triggers for immutability enforcement

**Validation**:
```bash
cd backend && alembic upgrade head
uv run pytest tests/characterization/ -v
```

### Phase 8.2: Production Run System (Backend)

**Goal**: Implement full Production Run management with version pinning.

**Deliverables**:
- New models: `RunStepExecution`, enhanced `ProductionRun`
- New API endpoints: `/api/runs/*` (start, advance, hold, resume, complete, abort)
- State machine enforcement for Run lifecycle (IDLE → RUNNING → HOLD/COMPLETED/ABORTED)
- Version pinning validation (only PUBLISHED versions can start runs)

**Validation**:
```bash
uv run pytest tests/test_production_runs.py -v
```

### Phase 8.3: Inventory & Buffer System (Backend)

**Goal**: Implement buffer management and inventory tracking.

**Deliverables**:
- New models: `Buffer`, `InventoryItem`, `StockMove`
- New API endpoints: `/api/buffers/*`, `/api/inventory/move`
- Buffer purity validation (allowed_lot_types enforcement)
- Idempotency key support for all write operations

**Validation**:
```bash
uv run pytest tests/test_inventory.py -v
```

### Phase 8.4: QC & Genealogy Unification (Backend + Frontend)

**Goal**: Consolidate QC inspections, temperature logs, and genealogy into unified system.

**Deliverables**:
- New models: `QCInspection` (enhanced), `TemperatureLog`, `AuditEvent`
- Temperature violation → auto-HOLD workflow
- Audit append-only enforcement
- Frontend: `/validator/genealogy`, `/validator/inspections`, `/validator/audit` routes

**Validation**:
```bash
uv run pytest tests/test_qc.py tests/test_audit.py -v
npm run build  # Frontend
```

### Phase 8.5: Route Consolidation & UI Migration (Frontend Focus)

**Goal**: Complete the frontend migration per INITIAL-11 Information Architecture.

**Deliverables**:
- Route changes: `/first-flow` → `/command/run/:runId/buffers`
- Command Center enhancements: Run controls, buffer view integration
- Quality Validator consolidation: Single entry point with tabs
- Terminology cleanup across all UI components

**Validation**:
```bash
cd flow-viz-react && npm run lint && npm run build
# Manual E2E test of all routes
```

---

## Core Concepts (From INITIAL-11)

### Naming Conventions

| Entity | Pattern | Example |
|--------|---------|---------|
| Production Run | `RUN-YYYYMMDD-SITE-####` | `RUN-20260124-DUNA-0001` |
| RAW Lot | `RAW-YYYYMMDD-SITE-####` | `RAW-20260124-DUNA-0042` |
| SKW15 Lot | `SKW15-YYYYMMDD-SITE-####` | `SKW15-20260124-DUNA-0201` |
| Pallet | `PAL-YYYYMMDD-SITE-####` | `PAL-20260124-DUNA-0012` |

### Canonical 11-Step Reference

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

## External Documentation

```yaml
# FastAPI Best Practices
- url: https://fastapi.tiangolo.com/advanced/events/
  why: Startup/shutdown events for background tasks

- url: https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/
  why: Database session management pattern

# SQLAlchemy 2.0 Patterns
- url: https://docs.sqlalchemy.org/en/20/orm/mapped_attributes.html
  why: Mapped column patterns for Python 3.10+

- url: https://docs.sqlalchemy.org/en/20/core/constraints.html
  why: CHECK constraints and triggers for data integrity

# React Router v6
- url: https://reactrouter.com/en/main/route/route
  why: Nested route patterns for protected routes

# Zustand State Management
- url: https://zustand-demo.pmnd.rs/
  why: Store patterns for complex state
```

---

## Codebase Patterns (FOLLOW EXACTLY)

### Backend - SQLAlchemy Model Pattern

**Reference**: `backend/app/models/lot.py`, `backend/app/models/production.py`

```python
# Pattern: UUID primary key, Enum column, JSONB field
class ProductionRun(Base):
    __tablename__ = "production_runs"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    run_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    flow_version_id: Mapped[UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("flow_versions.id"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="IDLE",
    )
    current_step_index: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
```

### Backend - Route Pattern with Idempotency

**Reference**: `backend/app/api/routes/flows.py`

```python
from fastapi import Header, HTTPException

@router.post("/runs", response_model=ProductionRunResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("50/minute")
async def create_run(
    request: Request,
    data: ProductionRunCreate,
    db: DBSession,
    current_user: CanCreateRuns,
    idempotency_key: UUID = Header(..., alias="Idempotency-Key"),
) -> ProductionRunResponse:
    """
    Create a new production run.

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 50/minute.
    Idempotency: Required header for duplicate prevention.
    """
    # Check for existing run with same idempotency key
    existing = await db.execute(
        select(ProductionRun).where(ProductionRun.idempotency_key == idempotency_key)
    )
    if existing.scalar_one_or_none():
        return existing  # Return existing on duplicate

    # Validate flow_version is PUBLISHED
    version = await db.execute(
        select(FlowVersion).where(FlowVersion.id == data.flow_version_id)
    )
    flow_version = version.scalar_one_or_none()
    if flow_version is None or flow_version.status != "PUBLISHED":
        raise HTTPException(400, "Flow version must be PUBLISHED to start a run")

    # Create run
    run = ProductionRun(
        flow_version_id=data.flow_version_id,
        run_code=generate_run_code(),  # RUN-YYYYMMDD-DUNA-XXXX
        idempotency_key=idempotency_key,
        started_by=current_user.id,
    )
    db.add(run)
    await db.flush()
    await db.refresh(run)
    return ProductionRunResponse.model_validate(run)
```

### Frontend - Route Migration Pattern

**Reference**: `flow-viz-react/src/router.tsx`

```typescript
// Pattern: Nested routes with RBAC
{
    path: '/command',
    element: <ProtectedRoute allowedRoles={['MANAGER', 'OPERATOR', 'ADMIN']} />,
    children: [
        {
            index: true,
            element: <CommandCenterPage />,
        },
        {
            path: 'run/:runId',
            element: <ActiveRunPage />,
            children: [
                { index: true, element: <RunControlsTab /> },
                { path: 'buffers', element: <RunBuffersTab /> },
                { path: 'lots', element: <RunLotsTab /> },
                { path: 'qc', element: <RunQCTab /> },
            ],
        },
    ],
},
```

---

## Known Gotchas & Library Quirks

```yaml
# CRITICAL: Enum vs String in SQLAlchemy
gotcha: "SQLAlchemy Enum requires .value for comparisons with String columns"
impact: "FlowVersionStatus.DRAFT != 'DRAFT' comparison always False"
solution: "Use FlowVersionStatus.DRAFT.value or change column to Enum type"

# CRITICAL: JSONB Default Mutable
gotcha: "Using dict as default creates shared mutable reference"
impact: "All rows share same dict instance"
solution: "Use default=lambda: {...} or default_factory in Pydantic"

# CRITICAL: Version Pinning
gotcha: "Production run MUST NOT change flow_version_id after creation"
impact: "Mid-run flow changes corrupt production data"
solution: "Reject PUT/PATCH to flow_version_id field, test explicitly"

# CRITICAL: Audit Append-Only
gotcha: "Audit events must never be modified or deleted"
impact: "Regulatory compliance failure"
solution: "DB triggers to prevent UPDATE/DELETE on audit_events table"

# CRITICAL: Temperature Violation Auto-Hold
gotcha: "Temperature check must auto-transition lot to HOLD"
impact: "HACCP compliance requires immediate reaction to violations"
solution: "DB trigger or application-level check on temperature_logs INSERT"

# CRITICAL: Buffer Purity
gotcha: "SKW15 buffer must only accept SKW15 lots"
impact: "Product contamination / SKU mixing"
solution: "DB trigger or application-level check on inventory_items INSERT"

# CRITICAL: QC Notes Required
gotcha: "HOLD and FAIL decisions require notes >= 10 chars"
impact: "Audit trail incomplete"
solution: "DB CHECK constraint + Pydantic model_validator"
```

---

## Implementation Blueprint

### Phase 8.1: Schema Alignment

#### Task 1.1: Create Migration for Enhanced Lot Status

```python
# backend/alembic/versions/{timestamp}_add_lot_step_index_and_quarantine.py
"""Add step_index to lots and QUARANTINE status."""

from alembic import op
import sqlalchemy as sa

def upgrade():
    # Add step_index to lots
    op.add_column('lots', sa.Column('step_index', sa.Integer(), nullable=True))
    op.create_check_constraint(
        'ck_lots_step_index_range',
        'lots',
        'step_index IS NULL OR (step_index >= 0 AND step_index <= 10)'
    )

    # Add status column to lots (if not exists)
    # Note: Existing lot_type may need migration to new status enum
    op.add_column('lots', sa.Column('status', sa.String(20), nullable=True, default='CREATED'))
    op.create_check_constraint(
        'ck_lots_status',
        'lots',
        "status IN ('CREATED','QUARANTINE','RELEASED','HOLD','REJECTED','CONSUMED','FINISHED')"
    )

def downgrade():
    op.drop_constraint('ck_lots_status', 'lots')
    op.drop_column('lots', 'status')
    op.drop_constraint('ck_lots_step_index_range', 'lots')
    op.drop_column('lots', 'step_index')
```

#### Task 1.2: Create Migration for FlowVersion Status Enhancement

```python
# backend/alembic/versions/{timestamp}_add_flow_version_review_deprecated.py
"""Add REVIEW and DEPRECATED status to flow_versions."""

from alembic import op
import sqlalchemy as sa

def upgrade():
    # Modify the CHECK constraint for flow_versions.status
    op.drop_constraint('ck_flow_versions_status', 'flow_versions')
    op.create_check_constraint(
        'ck_flow_versions_status',
        'flow_versions',
        "status IN ('DRAFT','REVIEW','PUBLISHED','DEPRECATED')"
    )

    # Add reviewed_by column
    op.add_column('flow_versions', sa.Column('reviewed_by', sa.Uuid(), nullable=True))
    op.create_foreign_key(
        'fk_flow_versions_reviewed_by',
        'flow_versions', 'users',
        ['reviewed_by'], ['id']
    )

def downgrade():
    op.drop_constraint('fk_flow_versions_reviewed_by', 'flow_versions')
    op.drop_column('flow_versions', 'reviewed_by')
    op.drop_constraint('ck_flow_versions_status', 'flow_versions')
    op.create_check_constraint(
        'ck_flow_versions_status',
        'flow_versions',
        "status IN ('DRAFT','PUBLISHED','ARCHIVED')"
    )
```

#### Task 1.3: Create Migration for Production Run Enhancement

```python
# backend/alembic/versions/{timestamp}_enhance_production_runs.py
"""Enhance production_runs with flow_version_id and new status."""

from alembic import op
import sqlalchemy as sa

def upgrade():
    # Add flow_version_id to production_runs
    op.add_column(
        'production_runs',
        sa.Column('flow_version_id', sa.Uuid(), nullable=True)
    )
    op.create_foreign_key(
        'fk_production_runs_flow_version',
        'production_runs', 'flow_versions',
        ['flow_version_id'], ['id']
    )

    # Add current_step_index
    op.add_column(
        'production_runs',
        sa.Column('current_step_index', sa.Integer(), nullable=False, server_default='0')
    )
    op.create_check_constraint(
        'ck_production_runs_step_index',
        'production_runs',
        'current_step_index >= 0 AND current_step_index <= 10'
    )

    # Modify status CHECK constraint
    # Note: May need to migrate existing ACTIVE/COMPLETED/CANCELLED to new values
    op.execute("""
        ALTER TABLE production_runs
        DROP CONSTRAINT IF EXISTS production_runs_status_check;
    """)
    op.execute("""
        ALTER TABLE production_runs
        ADD CONSTRAINT production_runs_status_check
        CHECK (status IN ('IDLE','RUNNING','HOLD','COMPLETED','ABORTED','ARCHIVED'));
    """)

    # Add idempotency_key
    op.add_column(
        'production_runs',
        sa.Column('idempotency_key', sa.Uuid(), nullable=True)
    )
    op.create_unique_constraint(
        'uq_production_runs_idempotency_key',
        'production_runs',
        ['idempotency_key']
    )

def downgrade():
    op.drop_constraint('uq_production_runs_idempotency_key', 'production_runs')
    op.drop_column('production_runs', 'idempotency_key')
    op.drop_constraint('ck_production_runs_step_index', 'production_runs')
    op.drop_column('production_runs', 'current_step_index')
    op.drop_constraint('fk_production_runs_flow_version', 'production_runs')
    op.drop_column('production_runs', 'flow_version_id')
```

### Phase 8.2: Production Run System

#### Task 2.1: Create RunStepExecution Model

```python
# backend/app/models/run.py

class RunStatus(str, enum.Enum):
    """Production run status per INITIAL-11."""
    IDLE = "IDLE"
    RUNNING = "RUNNING"
    HOLD = "HOLD"
    COMPLETED = "COMPLETED"
    ABORTED = "ABORTED"
    ARCHIVED = "ARCHIVED"


class StepExecutionStatus(str, enum.Enum):
    """Step execution status."""
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    SKIPPED = "SKIPPED"


class RunStepExecution(Base):
    """Track execution of each step within a production run."""

    __tablename__ = "run_step_executions"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    run_id: Mapped[UUID] = mapped_column(
        UUID_TYPE, ForeignKey("production_runs.id"), nullable=False
    )
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    node_id: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    operator_id: Mapped[UUID | None] = mapped_column(UUID_TYPE, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    __table_args__ = (
        sa.UniqueConstraint('run_id', 'step_index', name='uq_run_step_executions_run_step'),
        sa.CheckConstraint('step_index >= 0 AND step_index <= 10', name='ck_run_step_executions_step_index'),
    )
```

#### Task 2.2: Create Production Run API Routes

File: `backend/app/api/routes/runs.py`

```python
"""Production run management endpoints."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import CanCreateRuns, CanManageRuns, DBSession
from app.models.flow import FlowVersion, FlowVersionStatus
from app.models.run import ProductionRun, RunStatus, RunStepExecution
from app.rate_limit import limiter
from app.schemas.run import (
    ProductionRunCreate,
    ProductionRunResponse,
    AdvanceStepRequest,
    HoldRunRequest,
)

router = APIRouter(prefix="/runs", tags=["runs"])


def generate_run_code() -> str:
    """Generate run code: RUN-YYYYMMDD-DUNA-XXXX"""
    from datetime import date
    today = date.today().strftime("%Y%m%d")
    # TODO: Implement sequence counter per day
    import random
    seq = random.randint(1, 9999)
    return f"RUN-{today}-DUNA-{seq:04d}"


@router.post("", response_model=ProductionRunResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("50/minute")
async def create_run(
    request: Request,
    data: ProductionRunCreate,
    db: DBSession,
    current_user: CanCreateRuns,
    idempotency_key: UUID = Header(..., alias="Idempotency-Key"),
) -> ProductionRunResponse:
    """
    Create a new production run pinned to a PUBLISHED flow version.

    Requires: ADMIN, MANAGER, or OPERATOR role.
    """
    # Idempotency check
    existing_stmt = select(ProductionRun).where(
        ProductionRun.idempotency_key == idempotency_key
    )
    existing_result = await db.execute(existing_stmt)
    existing = existing_result.scalar_one_or_none()
    if existing:
        return ProductionRunResponse.model_validate(existing)

    # Validate flow_version is PUBLISHED
    version_stmt = select(FlowVersion).where(FlowVersion.id == data.flow_version_id)
    version_result = await db.execute(version_stmt)
    flow_version = version_result.scalar_one_or_none()

    if flow_version is None:
        raise HTTPException(404, "Flow version not found")
    if flow_version.status != FlowVersionStatus.PUBLISHED.value:
        raise HTTPException(400, "Flow version must be PUBLISHED to start a run")

    # Create run
    run = ProductionRun(
        flow_version_id=data.flow_version_id,
        run_code=generate_run_code(),
        status=RunStatus.IDLE.value,
        current_step_index=0,
        idempotency_key=idempotency_key,
        started_by=current_user.id,
    )
    db.add(run)
    await db.flush()
    await db.refresh(run)

    return ProductionRunResponse.model_validate(run)


@router.post("/{run_id}/start", response_model=ProductionRunResponse)
@limiter.limit("50/minute")
async def start_run(
    request: Request,
    run_id: UUID,
    db: DBSession,
    current_user: CanCreateRuns,
) -> ProductionRunResponse:
    """
    Transition run from IDLE to RUNNING.
    """
    stmt = select(ProductionRun).where(ProductionRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(404, "Production run not found")
    if run.status != RunStatus.IDLE.value:
        raise HTTPException(400, f"Cannot start run in {run.status} status")

    run.status = RunStatus.RUNNING.value
    run.started_at = datetime.now(UTC)

    # Create initial step execution for step 0
    step_exec = RunStepExecution(
        run_id=run.id,
        step_index=0,
        node_id="start",  # TODO: Get from flow version graph
        status="IN_PROGRESS",
        started_at=datetime.now(UTC),
        operator_id=current_user.id,
    )
    db.add(step_exec)

    await db.flush()
    await db.refresh(run)

    return ProductionRunResponse.model_validate(run)


@router.post("/{run_id}/advance", response_model=ProductionRunResponse)
@limiter.limit("100/minute")
async def advance_step(
    request: Request,
    run_id: UUID,
    data: AdvanceStepRequest,
    db: DBSession,
    current_user: CanCreateRuns,
) -> ProductionRunResponse:
    """
    Advance to the next step in the run.

    Guards:
    - Run must be RUNNING
    - Current step QC must be completed
    - No HOLD lots at current step
    """
    stmt = select(ProductionRun).where(ProductionRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(404, "Production run not found")
    if run.status != RunStatus.RUNNING.value:
        raise HTTPException(400, f"Cannot advance run in {run.status} status")
    if run.current_step_index >= 10:
        raise HTTPException(400, "Run is already at final step")

    # TODO: Check QC completion for current step
    # TODO: Check no HOLD lots at current step

    # Complete current step
    current_step_stmt = select(RunStepExecution).where(
        RunStepExecution.run_id == run_id,
        RunStepExecution.step_index == run.current_step_index,
    )
    current_step_result = await db.execute(current_step_stmt)
    current_step = current_step_result.scalar_one_or_none()
    if current_step:
        current_step.status = "COMPLETED"
        current_step.completed_at = datetime.now(UTC)

    # Advance to next step
    run.current_step_index += 1

    # Create new step execution
    next_step = RunStepExecution(
        run_id=run.id,
        step_index=run.current_step_index,
        node_id=f"step-{run.current_step_index}",  # TODO: Get from flow version graph
        status="IN_PROGRESS",
        started_at=datetime.now(UTC),
        operator_id=current_user.id,
    )
    db.add(next_step)

    await db.flush()
    await db.refresh(run)

    return ProductionRunResponse.model_validate(run)


@router.post("/{run_id}/hold", response_model=ProductionRunResponse)
@limiter.limit("50/minute")
async def hold_run(
    request: Request,
    run_id: UUID,
    data: HoldRunRequest,
    db: DBSession,
    current_user: CanCreateRuns,
) -> ProductionRunResponse:
    """Put run on HOLD."""
    stmt = select(ProductionRun).where(ProductionRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(404, "Production run not found")
    if run.status != RunStatus.RUNNING.value:
        raise HTTPException(400, f"Cannot hold run in {run.status} status")

    run.status = RunStatus.HOLD.value
    # TODO: Record hold reason in audit log

    await db.flush()
    await db.refresh(run)

    return ProductionRunResponse.model_validate(run)


@router.post("/{run_id}/resume", response_model=ProductionRunResponse)
@limiter.limit("50/minute")
async def resume_run(
    request: Request,
    run_id: UUID,
    db: DBSession,
    current_user: CanManageRuns,  # Manager approval required
) -> ProductionRunResponse:
    """Resume run from HOLD (requires Manager)."""
    stmt = select(ProductionRun).where(ProductionRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(404, "Production run not found")
    if run.status != RunStatus.HOLD.value:
        raise HTTPException(400, f"Cannot resume run in {run.status} status")

    run.status = RunStatus.RUNNING.value

    await db.flush()
    await db.refresh(run)

    return ProductionRunResponse.model_validate(run)


@router.post("/{run_id}/complete", response_model=ProductionRunResponse)
@limiter.limit("20/minute")
async def complete_run(
    request: Request,
    run_id: UUID,
    db: DBSession,
    current_user: CanCreateRuns,
) -> ProductionRunResponse:
    """Complete run (must be at step 10)."""
    stmt = select(ProductionRun).where(ProductionRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(404, "Production run not found")
    if run.status != RunStatus.RUNNING.value:
        raise HTTPException(400, f"Cannot complete run in {run.status} status")
    if run.current_step_index != 10:
        raise HTTPException(400, "Run must be at step 10 (Shipment) to complete")

    run.status = RunStatus.COMPLETED.value
    run.completed_at = datetime.now(UTC)

    await db.flush()
    await db.refresh(run)

    return ProductionRunResponse.model_validate(run)
```

### Phase 8.3: Inventory & Buffer System

#### Task 3.1: Create Buffer and InventoryItem Models

```python
# backend/app/models/inventory.py

class Buffer(Base):
    """Buffer storage location."""

    __tablename__ = "buffers"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    buffer_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    buffer_type: Mapped[str] = mapped_column(String(20), nullable=False)
    allowed_lot_types: Mapped[list[str]] = mapped_column(ARRAY(String(10)), nullable=False)
    capacity_kg: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    temp_min_c: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False)
    temp_max_c: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (
        sa.CheckConstraint(
            "buffer_type IN ('LK','MIX','SKW15','SKW30','FRZ','PAL')",
            name='ck_buffers_type'
        ),
    )


class InventoryItem(Base):
    """Stock in buffer."""

    __tablename__ = "inventory_items"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    lot_id: Mapped[UUID] = mapped_column(UUID_TYPE, ForeignKey("lots.id"), nullable=False)
    buffer_id: Mapped[UUID] = mapped_column(UUID_TYPE, ForeignKey("buffers.id"), nullable=False)
    run_id: Mapped[UUID] = mapped_column(UUID_TYPE, ForeignKey("production_runs.id"), nullable=False)
    quantity_kg: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    entered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    exited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class StockMove(Base):
    """Stock movement record."""

    __tablename__ = "stock_moves"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    lot_id: Mapped[UUID] = mapped_column(UUID_TYPE, ForeignKey("lots.id"), nullable=False)
    from_buffer_id: Mapped[UUID | None] = mapped_column(UUID_TYPE, ForeignKey("buffers.id"), nullable=True)
    to_buffer_id: Mapped[UUID | None] = mapped_column(UUID_TYPE, ForeignKey("buffers.id"), nullable=True)
    quantity_kg: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    move_type: Mapped[str] = mapped_column(String(20), nullable=False)
    operator_id: Mapped[UUID] = mapped_column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    idempotency_key: Mapped[UUID] = mapped_column(UUID_TYPE, unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    __table_args__ = (
        sa.CheckConstraint(
            "move_type IN ('RECEIVE','TRANSFER','CONSUME','SHIP')",
            name='ck_stock_moves_type'
        ),
        sa.CheckConstraint(
            "from_buffer_id IS NOT NULL OR to_buffer_id IS NOT NULL",
            name='ck_stock_moves_has_buffer'
        ),
    )
```

### Phase 8.4: QC & Genealogy Unification

#### Task 4.1: Create Enhanced QC Models

```python
# backend/app/models/qc_inspection.py

class QCInspection(Base):
    """QC inspection record."""

    __tablename__ = "qc_inspections"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    lot_id: Mapped[UUID] = mapped_column(UUID_TYPE, ForeignKey("lots.id"), nullable=False)
    run_id: Mapped[UUID] = mapped_column(UUID_TYPE, ForeignKey("production_runs.id"), nullable=False)
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    inspection_type: Mapped[str] = mapped_column(String(30), nullable=False)
    is_ccp: Mapped[bool] = mapped_column(Boolean, default=False)
    decision: Mapped[str] = mapped_column(String(10), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    inspector_id: Mapped[UUID] = mapped_column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    inspected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    idempotency_key: Mapped[UUID] = mapped_column(UUID_TYPE, unique=True, nullable=False)

    __table_args__ = (
        sa.CheckConstraint(
            "decision IN ('PASS','HOLD','FAIL')",
            name='ck_qc_inspections_decision'
        ),
        sa.CheckConstraint(
            "(decision = 'PASS') OR (notes IS NOT NULL AND LENGTH(notes) >= 10)",
            name='ck_qc_inspections_notes_required'
        ),
    )


class TemperatureLog(Base):
    """Temperature measurement log."""

    __tablename__ = "temperature_logs"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    lot_id: Mapped[UUID | None] = mapped_column(UUID_TYPE, ForeignKey("lots.id"), nullable=True)
    buffer_id: Mapped[UUID | None] = mapped_column(UUID_TYPE, ForeignKey("buffers.id"), nullable=True)
    inspection_id: Mapped[UUID | None] = mapped_column(UUID_TYPE, ForeignKey("qc_inspections.id"), nullable=True)
    temperature_c: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False)
    measurement_type: Mapped[str] = mapped_column(String(20), nullable=False)
    is_violation: Mapped[bool] = mapped_column(Boolean, default=False)
    recorded_by: Mapped[UUID] = mapped_column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    __table_args__ = (
        sa.CheckConstraint(
            "measurement_type IN ('SURFACE','CORE','AMBIENT')",
            name='ck_temperature_logs_type'
        ),
    )


class AuditEvent(Base):
    """Append-only audit event log."""

    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(30), nullable=False)
    entity_id: Mapped[UUID] = mapped_column(UUID_TYPE, nullable=False)
    user_id: Mapped[UUID] = mapped_column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    old_state: Mapped[dict | None] = mapped_column(JSONB_TYPE, nullable=True)
    new_state: Mapped[dict | None] = mapped_column(JSONB_TYPE, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB_TYPE, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
```

#### Task 4.2: Create Audit Append-Only Trigger

```sql
-- Migration: backend/alembic/versions/{timestamp}_add_audit_append_only.py

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

### Phase 8.5: Route Consolidation

#### Task 5.1: Update Frontend Router

```typescript
// flow-viz-react/src/router.tsx

export const router = createHashRouter([
    {
        path: '/login',
        element: <Login />,
    },
    {
        element: <ProtectedRoute />,
        children: [
            {
                element: (
                    <AppShell>
                        <Outlet />
                    </AppShell>
                ),
                children: [
                    { path: '/', element: <Navigate to="/dashboard" replace /> },
                    { path: '/dashboard', element: <FlowVizV1 /> },

                    // Legacy redirects
                    { path: '/flow-v1', element: <Navigate to="/dashboard" replace /> },
                    { path: '/flow-v2', element: <Navigate to="/command" replace /> },
                    { path: '/flow-v3', element: <Navigate to="/validator" replace /> },
                    { path: '/first-flow', element: <Navigate to="/command" replace /> },

                    // Command Center
                    {
                        path: '/command',
                        element: <ProtectedRoute allowedRoles={['MANAGER', 'OPERATOR', 'ADMIN']} />,
                        children: [
                            { index: true, element: <CommandCenterPage /> },
                            {
                                path: 'run/:runId',
                                element: <ActiveRunLayout />,
                                children: [
                                    { index: true, element: <RunControlsTab /> },
                                    { path: 'buffers', element: <RunBuffersTab /> },
                                    { path: 'lots', element: <RunLotsTab /> },
                                    { path: 'qc', element: <RunQCTab /> },
                                ],
                            },
                        ],
                    },

                    // Quality Validator
                    {
                        path: '/validator',
                        element: <ProtectedRoute allowedRoles={['AUDITOR', 'ADMIN', 'MANAGER']} />,
                        children: [
                            { index: true, element: <ValidatorDashboard /> },
                            { path: 'genealogy', element: <GenealogyPage /> },
                            { path: 'inspections', element: <InspectionsPage /> },
                            { path: 'audit', element: <AuditLogPage /> },
                        ],
                    },

                    // Flow Editor
                    {
                        path: '/flow-editor',
                        element: <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'OPERATOR']} />,
                        children: [
                            { index: true, element: <FlowCatalogPage /> },
                            { path: ':flowId', element: <FlowEditorPage /> },
                            { path: ':flowId/v/:versionNum', element: <FlowEditorPage /> },
                            { path: ':flowId/versions', element: <FlowVersionsPage /> },
                        ],
                    },

                    // Production Run Detail (read-only)
                    {
                        path: '/run/:runId',
                        element: <ProductionRunDetailPage />,
                        children: [
                            { index: true, element: <RunSummaryTab /> },
                            { path: 'steps', element: <RunStepsTab /> },
                            { path: 'lots', element: <RunLotsTab /> },
                            { path: 'qc', element: <RunQCTab /> },
                        ],
                    },

                    // Presentation
                    { path: '/presentation', element: <Presentation /> },
                    { path: '/presentation/:runId', element: <RunPresentationPage /> },
                ],
            },
        ],
    },
]);
```

---

## Task List (Ordered by Phase)

```yaml
# === Phase 8.1: Schema Alignment ===
Task 1.1:
  FILE: backend/alembic/versions/{ts}_add_lot_step_index.py
  DELIVERABLE: Migration adding step_index and status to lots
  VALIDATION: alembic upgrade head

Task 1.2:
  FILE: backend/alembic/versions/{ts}_enhance_flow_version_status.py
  DELIVERABLE: Migration adding REVIEW/DEPRECATED status
  VALIDATION: alembic upgrade head

Task 1.3:
  FILE: backend/alembic/versions/{ts}_enhance_production_runs.py
  DELIVERABLE: Migration adding flow_version_id, current_step_index
  VALIDATION: alembic upgrade head

Task 1.4:
  FILE: backend/app/models/lot.py (update)
  DELIVERABLE: Add step_index and LotStatus enum
  VALIDATION: uv run mypy app/models/lot.py

Task 1.5:
  FILE: backend/app/models/flow.py (update)
  DELIVERABLE: Add REVIEW and DEPRECATED to FlowVersionStatus
  VALIDATION: uv run pytest tests/characterization/test_flows.py

# === Phase 8.2: Production Run System ===
Task 2.1:
  FILE: backend/app/models/run.py (new)
  DELIVERABLE: RunStatus enum, RunStepExecution model
  VALIDATION: uv run mypy app/models/run.py

Task 2.2:
  FILE: backend/app/models/production.py (update)
  DELIVERABLE: Add flow_version_id, current_step_index to ProductionRun
  VALIDATION: uv run mypy app/models/production.py

Task 2.3:
  FILE: backend/app/schemas/run.py (new)
  DELIVERABLE: Pydantic schemas for runs API
  VALIDATION: uv run mypy app/schemas/run.py

Task 2.4:
  FILE: backend/app/api/routes/runs.py (new)
  DELIVERABLE: Full runs API with state machine
  VALIDATION: uv run pytest tests/test_runs.py

Task 2.5:
  FILE: backend/app/api/deps.py (update)
  DELIVERABLE: Add CanCreateRuns, CanManageRuns aliases
  VALIDATION: Import succeeds

Task 2.6:
  FILE: backend/app/api/routes/__init__.py (update)
  DELIVERABLE: Register runs router
  VALIDATION: /api/runs endpoint responds

# === Phase 8.3: Inventory & Buffer System ===
Task 3.1:
  FILE: backend/alembic/versions/{ts}_add_buffers_inventory.py
  DELIVERABLE: Migration for buffers, inventory_items, stock_moves
  VALIDATION: alembic upgrade head

Task 3.2:
  FILE: backend/app/models/inventory.py (new)
  DELIVERABLE: Buffer, InventoryItem, StockMove models
  VALIDATION: uv run mypy app/models/inventory.py

Task 3.3:
  FILE: backend/app/schemas/inventory.py (new)
  DELIVERABLE: Pydantic schemas for inventory API
  VALIDATION: uv run mypy app/schemas/inventory.py

Task 3.4:
  FILE: backend/app/api/routes/buffers.py (new)
  DELIVERABLE: Buffer CRUD + inventory listing
  VALIDATION: uv run pytest tests/test_buffers.py

Task 3.5:
  FILE: backend/app/api/routes/inventory.py (new)
  DELIVERABLE: Stock move endpoint with idempotency
  VALIDATION: uv run pytest tests/test_inventory.py

# === Phase 8.4: QC & Genealogy Unification ===
Task 4.1:
  FILE: backend/alembic/versions/{ts}_add_qc_inspections_audit.py
  DELIVERABLE: Migration for qc_inspections, temperature_logs, audit_events
  VALIDATION: alembic upgrade head

Task 4.2:
  FILE: backend/app/models/qc_inspection.py (new)
  DELIVERABLE: QCInspection, TemperatureLog, AuditEvent models
  VALIDATION: uv run mypy app/models/

Task 4.3:
  FILE: backend/app/schemas/qc_inspection.py (new)
  DELIVERABLE: Pydantic schemas with validation rules
  VALIDATION: uv run pytest tests/test_qc_schemas.py

Task 4.4:
  FILE: backend/app/api/routes/qc_inspections.py (new)
  DELIVERABLE: QC inspection endpoints
  VALIDATION: uv run pytest tests/test_qc_routes.py

Task 4.5:
  FILE: backend/app/api/routes/genealogy.py (new)
  DELIVERABLE: 1-back/1-forward/tree endpoints
  VALIDATION: uv run pytest tests/test_genealogy.py

Task 4.6:
  FILE: backend/app/api/routes/audit.py (new)
  DELIVERABLE: Audit event query endpoint
  VALIDATION: uv run pytest tests/test_audit.py

# === Phase 8.5: Route Consolidation ===
Task 5.1:
  FILE: flow-viz-react/src/router.tsx (update)
  DELIVERABLE: Full route structure per IA
  VALIDATION: npm run build

Task 5.2:
  FILES: flow-viz-react/src/pages/CommandCenterPage.tsx (new)
  DELIVERABLE: Command center with run list
  VALIDATION: npm run build

Task 5.3:
  FILES: flow-viz-react/src/components/run/ActiveRunLayout.tsx (new)
  DELIVERABLE: Run detail layout with tabs
  VALIDATION: npm run build

Task 5.4:
  FILES: flow-viz-react/src/components/run/RunBuffersTab.tsx (new)
  DELIVERABLE: Buffer board (migrated from FirstFlowPage)
  VALIDATION: npm run build

Task 5.5:
  FILES: flow-viz-react/src/pages/ValidatorDashboard.tsx (new)
  DELIVERABLE: Validator landing with stats
  VALIDATION: npm run build

Task 5.6:
  FILES: flow-viz-react/src/pages/GenealogyPage.tsx (new)
  DELIVERABLE: Genealogy query UI
  VALIDATION: npm run build

Task 5.7:
  FILE: flow-viz-react/src/components/shell/AppShell.tsx (update)
  DELIVERABLE: Updated navigation per IA
  VALIDATION: npm run build

Task 5.8:
  DELIVERABLE: Terminology cleanup across all UI files
  VALIDATION: grep "First Flow" returns no results in src/
```

---

## Validation Loop

### Level 1: Per-Task Validation

```bash
# After each backend task:
cd backend
uv run ruff check app/ --fix
uv run mypy app/
uv run pytest tests/characterization/ -v

# After each frontend task:
cd flow-viz-react
npm run lint
npm run build
```

### Level 2: Phase Validation

```bash
# After Phase 8.1:
cd backend && alembic upgrade head
uv run pytest tests/ -v --cov=app --cov-report=term-missing

# After Phase 8.2:
# Test full run lifecycle
curl -X POST /api/runs -H "Idempotency-Key: test-uuid" -d '{"flow_version_id":"..."}'
curl -X POST /api/runs/{id}/start
curl -X POST /api/runs/{id}/advance
# ... continue through step 10
curl -X POST /api/runs/{id}/complete

# After Phase 8.5:
cd flow-viz-react && npm run build
# Manual E2E test of all routes
```

### Level 3: Integration Validation

```bash
# Start full stack
docker-compose up -d
cd backend && uv run uvicorn app.main:app --reload --port 8000
cd flow-viz-react && npm run dev

# E2E Test Checklist:
# [ ] Create flow → Publish → Start run
# [ ] Advance through all 11 steps
# [ ] Register lots at each step
# [ ] Pass QC inspections
# [ ] Move lots to buffers
# [ ] Query genealogy
# [ ] Complete run
# [ ] Verify audit log
```

---

## Anti-Patterns to Avoid

- ❌ Don't allow modification of `flow_version_id` after run creation
- ❌ Don't skip idempotency keys on write operations
- ❌ Don't use mutable defaults for JSONB columns
- ❌ Don't allow UPDATE/DELETE on audit_events table
- ❌ Don't allow step advancement without QC completion
- ❌ Don't mix SKU types in buffers (SKW15 buffer gets only SKW15)
- ❌ Don't allow HOLD/FAIL QC decisions without notes >= 10 chars
- ❌ Don't modify PUBLISHED flow versions
- ❌ Don't skip temperature violation checks at CCP steps

---

## Confidence Score: 7/10

**High confidence due to**:
- Clear specification document (INITIAL-11.md)
- Well-established codebase patterns to follow
- Phased approach with independent validation
- Comprehensive state machines defined

**Uncertainty on**:
- Data migration for existing lots/runs (need to verify current schema)
- Frontend component refactoring scope (depends on existing FlowVizV2/V3 complexity)
- Integration with existing QCDecision model (may need migration strategy)
- Performance of genealogy queries on large datasets

---

## Sources

- [FastAPI Dependency Injection](https://fastapi.tiangolo.com/tutorial/dependencies/)
- [SQLAlchemy 2.0 Async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [Alembic Migration Tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html)
- [React Router v6](https://reactrouter.com/en/main)
- [Zustand Documentation](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [INITIAL-11.md](../INITIAL-11.md) - Primary specification

---

## Next Steps

1. **Start with Phase 8.1** - Schema alignment is foundation for all other phases
2. **Create detailed sub-PRPs** if any phase exceeds 20 tasks
3. **Set up test fixtures** for production run lifecycle testing
4. **Document API changes** in OpenAPI spec
5. **Plan data migration** for existing production data
