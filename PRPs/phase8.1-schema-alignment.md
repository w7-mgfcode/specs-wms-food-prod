# PRP: Phase 8.1 — Schema Alignment

> **Parent PRP**: phase8-unified-production-suite.md
> **Phase**: 8.1 - Schema Alignment
> **Date**: 2026-01-24
> **Status**: READY FOR IMPLEMENTATION
> **Confidence Score**: 9/10

---

## Purpose

Establish the database foundation for the unified Production Suite by:
1. Adding `step_index` column to lots for canonical 11-step tracking
2. Adding `REVIEW` and `DEPRECATED` states to FlowVersionStatus
3. Adding `QUARANTINE` state to lot lifecycle
4. Enhancing `production_runs` with `flow_version_id` pinning
5. Creating DB triggers for immutability enforcement

This phase is **foundational** — all subsequent phases depend on these schema changes.

---

## Prerequisites

- PostgreSQL database accessible
- Alembic migrations configured
- Existing tables: `lots`, `flow_versions`, `production_runs`, `users`

---

## Reference Files

```yaml
Models to Update:
  - backend/app/models/lot.py
  - backend/app/models/flow.py
  - backend/app/models/production.py

Existing Patterns:
  - backend/alembic/versions/20260124_add_flow_definitions.py
  - backend/app/database.py (UUID_TYPE, JSONB_TYPE)
```

---

## Task List

### Task 1.1: Add step_index and status to lots table

**File**: `backend/alembic/versions/{timestamp}_add_lot_step_index_status.py`

```python
"""Add step_index and status columns to lots table.

Revision ID: {auto}
Revises: 20260124_add_flow_definitions
Create Date: 2026-01-24
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '{auto}'
down_revision = '20260124_add_flow_definitions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add step_index column
    op.add_column(
        'lots',
        sa.Column('step_index', sa.Integer(), nullable=True)
    )

    # Add CHECK constraint for step_index range (0-10)
    op.create_check_constraint(
        'ck_lots_step_index_range',
        'lots',
        'step_index IS NULL OR (step_index >= 0 AND step_index <= 10)'
    )

    # Add status column for lot lifecycle
    op.add_column(
        'lots',
        sa.Column('status', sa.String(20), nullable=True, server_default='CREATED')
    )

    # Add CHECK constraint for status values
    op.create_check_constraint(
        'ck_lots_status',
        'lots',
        "status IN ('CREATED','QUARANTINE','RELEASED','HOLD','REJECTED','CONSUMED','FINISHED')"
    )

    # Add index for step_index queries
    op.create_index('idx_lots_step_index', 'lots', ['step_index'])

    # Add index for status queries
    op.create_index('idx_lots_status', 'lots', ['status'])


def downgrade() -> None:
    op.drop_index('idx_lots_status', 'lots')
    op.drop_index('idx_lots_step_index', 'lots')
    op.drop_constraint('ck_lots_status', 'lots', type_='check')
    op.drop_column('lots', 'status')
    op.drop_constraint('ck_lots_step_index_range', 'lots', type_='check')
    op.drop_column('lots', 'step_index')
```

**Validation**:
```bash
cd backend && alembic upgrade head
uv run python -c "from app.models.lot import Lot; print('OK')"
```

---

### Task 1.2: Enhance FlowVersionStatus with REVIEW and DEPRECATED

**File**: `backend/alembic/versions/{timestamp}_enhance_flow_version_status.py`

```python
"""Add REVIEW and DEPRECATED status to flow_versions.

Revision ID: {auto}
Revises: {previous}
Create Date: 2026-01-24
"""

from alembic import op
import sqlalchemy as sa

revision = '{auto}'
down_revision = '{previous}'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop existing CHECK constraint
    op.execute("""
        ALTER TABLE flow_versions
        DROP CONSTRAINT IF EXISTS flow_versions_status_check
    """)
    op.execute("""
        ALTER TABLE flow_versions
        DROP CONSTRAINT IF EXISTS ck_flow_versions_status
    """)

    # Create new CHECK constraint with REVIEW and DEPRECATED
    op.create_check_constraint(
        'ck_flow_versions_status',
        'flow_versions',
        "status IN ('DRAFT','REVIEW','PUBLISHED','DEPRECATED')"
    )

    # Add reviewed_by column
    op.add_column(
        'flow_versions',
        sa.Column('reviewed_by', sa.Uuid(), nullable=True)
    )
    op.create_foreign_key(
        'fk_flow_versions_reviewed_by',
        'flow_versions', 'users',
        ['reviewed_by'], ['id']
    )

    # Add index for status filtering
    op.create_index('idx_flow_versions_status', 'flow_versions', ['status'])


def downgrade() -> None:
    op.drop_index('idx_flow_versions_status', 'flow_versions')
    op.drop_constraint('fk_flow_versions_reviewed_by', 'flow_versions', type_='foreignkey')
    op.drop_column('flow_versions', 'reviewed_by')
    op.drop_constraint('ck_flow_versions_status', 'flow_versions', type_='check')
    op.create_check_constraint(
        'ck_flow_versions_status',
        'flow_versions',
        "status IN ('DRAFT','PUBLISHED','ARCHIVED')"
    )
```

**Validation**:
```bash
alembic upgrade head
psql -c "SELECT DISTINCT status FROM flow_versions"
```

---

### Task 1.3: Enhance production_runs with flow_version_id pinning

**File**: `backend/alembic/versions/{timestamp}_enhance_production_runs.py`

```python
"""Enhance production_runs with flow_version_id and step tracking.

Revision ID: {auto}
Revises: {previous}
Create Date: 2026-01-24
"""

from alembic import op
import sqlalchemy as sa

revision = '{auto}'
down_revision = '{previous}'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add flow_version_id for version pinning
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

    # Update status CHECK constraint for new lifecycle
    # First, migrate existing data
    op.execute("""
        UPDATE production_runs
        SET status = 'RUNNING'
        WHERE status = 'ACTIVE'
    """)
    op.execute("""
        UPDATE production_runs
        SET status = 'ABORTED'
        WHERE status = 'CANCELLED'
    """)

    # Drop old constraint and create new one
    op.execute("""
        ALTER TABLE production_runs
        DROP CONSTRAINT IF EXISTS production_runs_status_check
    """)
    op.execute("""
        ALTER TABLE production_runs
        DROP CONSTRAINT IF EXISTS ck_production_runs_status
    """)
    op.create_check_constraint(
        'ck_production_runs_status',
        'production_runs',
        "status IN ('IDLE','RUNNING','HOLD','COMPLETED','ABORTED','ARCHIVED')"
    )

    # Add idempotency_key for duplicate prevention
    op.add_column(
        'production_runs',
        sa.Column('idempotency_key', sa.Uuid(), nullable=True)
    )
    op.create_unique_constraint(
        'uq_production_runs_idempotency_key',
        'production_runs',
        ['idempotency_key']
    )

    # Add started_by for audit
    op.add_column(
        'production_runs',
        sa.Column('started_by', sa.Uuid(), nullable=True)
    )
    op.create_foreign_key(
        'fk_production_runs_started_by',
        'production_runs', 'users',
        ['started_by'], ['id']
    )

    # Add completed_at timestamp
    op.add_column(
        'production_runs',
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True)
    )

    # Add indexes
    op.create_index('idx_production_runs_flow_version', 'production_runs', ['flow_version_id'])
    op.create_index('idx_production_runs_status', 'production_runs', ['status'])


def downgrade() -> None:
    op.drop_index('idx_production_runs_status', 'production_runs')
    op.drop_index('idx_production_runs_flow_version', 'production_runs')
    op.drop_column('production_runs', 'completed_at')
    op.drop_constraint('fk_production_runs_started_by', 'production_runs', type_='foreignkey')
    op.drop_column('production_runs', 'started_by')
    op.drop_constraint('uq_production_runs_idempotency_key', 'production_runs', type_='unique')
    op.drop_column('production_runs', 'idempotency_key')

    # Restore old status values
    op.execute("UPDATE production_runs SET status = 'ACTIVE' WHERE status = 'RUNNING'")
    op.execute("UPDATE production_runs SET status = 'CANCELLED' WHERE status = 'ABORTED'")

    op.drop_constraint('ck_production_runs_status', 'production_runs', type_='check')
    op.create_check_constraint(
        'production_runs_status_check',
        'production_runs',
        "status IN ('ACTIVE','COMPLETED','CANCELLED')"
    )
    op.drop_constraint('ck_production_runs_step_index', 'production_runs', type_='check')
    op.drop_column('production_runs', 'current_step_index')
    op.drop_constraint('fk_production_runs_flow_version', 'production_runs', type_='foreignkey')
    op.drop_column('production_runs', 'flow_version_id')
```

**Validation**:
```bash
alembic upgrade head
psql -c "\d production_runs" | grep -E "(flow_version_id|current_step_index|idempotency_key)"
```

---

### Task 1.4: Create run_step_executions table

**File**: `backend/alembic/versions/{timestamp}_add_run_step_executions.py`

```python
"""Add run_step_executions table for tracking step progress.

Revision ID: {auto}
Revises: {previous}
Create Date: 2026-01-24
"""

from alembic import op
import sqlalchemy as sa

revision = '{auto}'
down_revision = '{previous}'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'run_step_executions',
        sa.Column('id', sa.Uuid(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('run_id', sa.Uuid(), nullable=False),
        sa.Column('step_index', sa.Integer(), nullable=False),
        sa.Column('node_id', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='PENDING'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('operator_id', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),

        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['run_id'], ['production_runs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['operator_id'], ['users.id']),
        sa.UniqueConstraint('run_id', 'step_index', name='uq_run_step_executions_run_step'),
        sa.CheckConstraint('step_index >= 0 AND step_index <= 10', name='ck_run_step_executions_step_index'),
        sa.CheckConstraint(
            "status IN ('PENDING','IN_PROGRESS','COMPLETED','SKIPPED')",
            name='ck_run_step_executions_status'
        ),
    )

    op.create_index('idx_run_step_executions_run', 'run_step_executions', ['run_id'])
    op.create_index('idx_run_step_executions_status', 'run_step_executions', ['status'])


def downgrade() -> None:
    op.drop_index('idx_run_step_executions_status', 'run_step_executions')
    op.drop_index('idx_run_step_executions_run', 'run_step_executions')
    op.drop_table('run_step_executions')
```

**Validation**:
```bash
alembic upgrade head
psql -c "\d run_step_executions"
```

---

### Task 1.5: Add immutability trigger for published flow versions

**File**: `backend/alembic/versions/{timestamp}_add_flow_version_immutability_trigger.py`

```python
"""Add trigger to prevent modification of PUBLISHED flow versions.

Revision ID: {auto}
Revises: {previous}
Create Date: 2026-01-24
"""

from alembic import op

revision = '{auto}'
down_revision = '{previous}'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create function to prevent published version modification
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_published_flow_version_modification()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Allow status change TO DEPRECATED (archiving)
            IF OLD.status = 'PUBLISHED' AND NEW.status = 'DEPRECATED' THEN
                RETURN NEW;
            END IF;

            -- Block all other modifications to PUBLISHED versions
            IF OLD.status = 'PUBLISHED' THEN
                RAISE EXCEPTION 'Cannot modify PUBLISHED flow version. Status: %, ID: %', OLD.status, OLD.id;
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Create trigger
    op.execute("""
        DROP TRIGGER IF EXISTS trg_flow_version_immutable ON flow_versions;
        CREATE TRIGGER trg_flow_version_immutable
        BEFORE UPDATE ON flow_versions
        FOR EACH ROW
        EXECUTE FUNCTION prevent_published_flow_version_modification();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_flow_version_immutable ON flow_versions")
    op.execute("DROP FUNCTION IF EXISTS prevent_published_flow_version_modification()")
```

**Validation**:
```bash
alembic upgrade head
# Test that published version cannot be modified
psql -c "
    UPDATE flow_versions
    SET graph_schema = '{}'::jsonb
    WHERE status = 'PUBLISHED'
    LIMIT 1
" 2>&1 | grep -q "Cannot modify PUBLISHED" && echo "Trigger works!"
```

---

### Task 1.6: Update Lot model with new fields

**File**: `backend/app/models/lot.py` (UPDATE)

```python
"""Lot and genealogy models."""

import enum
from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, JSONB_TYPE, UUID_TYPE

if TYPE_CHECKING:
    from app.models.production import Phase, ProductionRun
    from app.models.qc import QCDecision
    from app.models.user import User


class LotType(str, enum.Enum):
    """Lot type matching database CHECK constraint."""

    RAW = "RAW"      # Raw material receipt
    DEB = "DEB"      # Deboned meat
    BULK = "BULK"    # Bulk buffer
    MIX = "MIX"      # Mixed batch
    SKW15 = "SKW15"  # 15g skewer rod
    SKW30 = "SKW30"  # 30g skewer rod
    FRZ15 = "FRZ15"  # Frozen 15g
    FRZ30 = "FRZ30"  # Frozen 30g
    FG15 = "FG15"    # Finished goods 15g
    FG30 = "FG30"    # Finished goods 30g
    PAL = "PAL"      # Pallet
    SHIP = "SHIP"    # Shipment


class LotStatus(str, enum.Enum):
    """Lot lifecycle status per INITIAL-11."""

    CREATED = "CREATED"
    QUARANTINE = "QUARANTINE"
    RELEASED = "RELEASED"
    HOLD = "HOLD"
    REJECTED = "REJECTED"
    CONSUMED = "CONSUMED"
    FINISHED = "FINISHED"


class Lot(Base):
    """
    Production lot tracking.

    Maps to public.lots table.
    """

    __tablename__ = "lots"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    lot_code: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    lot_type: Mapped[Optional[LotType]] = mapped_column(
        Enum(LotType, name="lot_type", create_constraint=False), nullable=True
    )

    # NEW: Step index for canonical 11-step tracking (0-10)
    step_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # NEW: Lot lifecycle status
    status: Mapped[str] = mapped_column(
        String(20), default=LotStatus.CREATED.value
    )

    production_run_id: Mapped[Optional[UUID]] = mapped_column(
        UUID_TYPE,
        ForeignKey("production_runs.id"),
        nullable=True,
    )
    phase_id: Mapped[Optional[UUID]] = mapped_column(
        UUID_TYPE,
        ForeignKey("phases.id"),
        nullable=True,
    )
    operator_id: Mapped[Optional[UUID]] = mapped_column(
        UUID_TYPE,
        ForeignKey("users.id"),
        nullable=True,
    )
    weight_kg: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    temperature_c: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 1), nullable=True
    )

    # NEW: SKU type for SKW/FRZ/FG lots (15 or 30)
    sku_type: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    # NEW: Supplier for RAW lots
    supplier_id: Mapped[Optional[UUID]] = mapped_column(
        UUID_TYPE,
        ForeignKey("suppliers.id", use_alter=True),  # use_alter if suppliers table doesn't exist yet
        nullable=True,
    )

    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB_TYPE,
        default=dict,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    production_run: Mapped[Optional["ProductionRun"]] = relationship(
        "ProductionRun", back_populates="lots"
    )
    phase: Mapped[Optional["Phase"]] = relationship("Phase", back_populates="lots")
    operator: Mapped[Optional["User"]] = relationship("User", back_populates="lots")
    qc_decisions: Mapped[list["QCDecision"]] = relationship(
        "QCDecision", back_populates="lot"
    )

    # Genealogy relationships
    parent_links: Mapped[list["LotGenealogy"]] = relationship(
        "LotGenealogy",
        foreign_keys="LotGenealogy.child_lot_id",
        back_populates="child",
    )
    child_links: Mapped[list["LotGenealogy"]] = relationship(
        "LotGenealogy",
        foreign_keys="LotGenealogy.parent_lot_id",
        back_populates="parent",
    )


# LotGenealogy class remains unchanged...
```

**Validation**:
```bash
uv run mypy app/models/lot.py
uv run python -c "from app.models.lot import Lot, LotStatus, LotType; print('Enums:', list(LotStatus), list(LotType))"
```

---

### Task 1.7: Update FlowVersion model with REVIEW/DEPRECATED

**File**: `backend/app/models/flow.py` (UPDATE)

```python
# Update the FlowVersionStatus enum
class FlowVersionStatus(str, enum.Enum):
    """Flow version lifecycle states per INITIAL-11."""

    DRAFT = "DRAFT"
    REVIEW = "REVIEW"         # NEW: Pending approval
    PUBLISHED = "PUBLISHED"
    DEPRECATED = "DEPRECATED"  # NEW: Replaced by newer version


# Update FlowVersion class to add reviewed_by
class FlowVersion(Base):
    # ... existing fields ...

    # NEW: Reviewed by (for REVIEW → PUBLISHED transition)
    reviewed_by: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("users.id"),
        nullable=True,
    )

    # Add relationship for reviewer
    reviewer: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[reviewed_by], back_populates="flow_versions_reviewed"
    )
```

**Validation**:
```bash
uv run mypy app/models/flow.py
uv run python -c "from app.models.flow import FlowVersionStatus; print(list(FlowVersionStatus))"
```

---

### Task 1.8: Update ProductionRun model

**File**: `backend/app/models/production.py` (UPDATE)

```python
# Update RunStatus enum
class RunStatus(str, enum.Enum):
    """Production run status per INITIAL-11."""

    IDLE = "IDLE"          # Created but not started
    RUNNING = "RUNNING"    # Active execution
    HOLD = "HOLD"          # Paused due to issue
    COMPLETED = "COMPLETED"  # Successfully finished
    ABORTED = "ABORTED"    # Terminated early
    ARCHIVED = "ARCHIVED"  # Historical record


# Update ProductionRun class
class ProductionRun(Base):
    """
    Active production run.

    Maps to public.production_runs table.
    """

    __tablename__ = "production_runs"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    run_code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)

    # NEW: Flow version pinning (immutable after creation)
    flow_version_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("flow_versions.id"),
        nullable=True,
    )

    scenario_id: Mapped[Optional[UUID]] = mapped_column(
        UUID_TYPE,
        ForeignKey("scenarios.id"),
        nullable=True,
    )
    operator_id: Mapped[Optional[UUID]] = mapped_column(
        UUID_TYPE,
        ForeignKey("users.id"),
        nullable=True,
    )

    # NEW: Started by user (separate from operator)
    started_by: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("users.id"),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default=RunStatus.IDLE.value,
    )

    # NEW: Current step index (0-10)
    current_step_index: Mapped[int] = mapped_column(Integer, default=0)

    daily_target_kg: Mapped[Optional[Decimal]] = mapped_column(Numeric, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # NEW: Completed timestamp (distinct from ended_at)
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # NEW: Idempotency key for duplicate prevention
    idempotency_key: Mapped[UUID | None] = mapped_column(UUID_TYPE, unique=True, nullable=True)

    summary: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB_TYPE, nullable=True)

    # Relationships
    flow_version: Mapped[Optional["FlowVersion"]] = relationship(
        "FlowVersion", back_populates="production_runs"
    )
    scenario: Mapped[Optional["Scenario"]] = relationship(
        "Scenario", back_populates="production_runs"
    )
    operator: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[operator_id], back_populates="production_runs"
    )
    starter: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[started_by], back_populates="production_runs_started"
    )
    lots: Mapped[list["Lot"]] = relationship("Lot", back_populates="production_run")
    step_executions: Mapped[list["RunStepExecution"]] = relationship(
        "RunStepExecution", back_populates="production_run", cascade="all, delete-orphan"
    )
```

**Validation**:
```bash
uv run mypy app/models/production.py
uv run python -c "from app.models.production import RunStatus; print(list(RunStatus))"
```

---

### Task 1.9: Create RunStepExecution model

**File**: `backend/app/models/run.py` (NEW)

```python
"""Run step execution model."""

import enum
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Optional
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, UUID_TYPE

if TYPE_CHECKING:
    from app.models.production import ProductionRun
    from app.models.user import User


class StepExecutionStatus(str, enum.Enum):
    """Step execution status."""

    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    SKIPPED = "SKIPPED"


class RunStepExecution(Base):
    """
    Track execution of each step within a production run.

    Maps to public.run_step_executions table.
    """

    __tablename__ = "run_step_executions"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    run_id: Mapped[UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("production_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    node_id: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=StepExecutionStatus.PENDING.value
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    operator_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE, ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Relationships
    production_run: Mapped["ProductionRun"] = relationship(
        "ProductionRun", back_populates="step_executions"
    )
    operator: Mapped[Optional["User"]] = relationship(
        "User", back_populates="step_executions"
    )
```

**Validation**:
```bash
uv run mypy app/models/run.py
uv run python -c "from app.models.run import RunStepExecution, StepExecutionStatus; print('OK')"
```

---

### Task 1.10: Update models/__init__.py

**File**: `backend/app/models/__init__.py` (UPDATE)

```python
"""SQLAlchemy models."""

from app.models.flow import FlowDefinition, FlowVersion, FlowVersionStatus
from app.models.lot import Lot, LotGenealogy, LotStatus, LotType
from app.models.production import Phase, ProductionRun, RunStatus, Scenario, Stream
from app.models.qc import Decision, GateType, QCDecision, QCGate
from app.models.run import RunStepExecution, StepExecutionStatus
from app.models.user import User, UserRole

__all__ = [
    # Flow
    "FlowDefinition",
    "FlowVersion",
    "FlowVersionStatus",
    # Lot
    "Lot",
    "LotGenealogy",
    "LotStatus",
    "LotType",
    # Production
    "Phase",
    "ProductionRun",
    "RunStatus",
    "Scenario",
    "Stream",
    # Run
    "RunStepExecution",
    "StepExecutionStatus",
    # QC
    "Decision",
    "GateType",
    "QCDecision",
    "QCGate",
    # User
    "User",
    "UserRole",
]
```

**Validation**:
```bash
uv run python -c "from app.models import *; print('All models imported successfully')"
```

---

### Task 1.11: Update User model with new relationships

**File**: `backend/app/models/user.py` (UPDATE - add relationships)

```python
# Add these relationships to the User class:

    # Flow Editor relationships
    flow_definitions: Mapped[list["FlowDefinition"]] = relationship(
        "FlowDefinition", foreign_keys="FlowDefinition.created_by", back_populates="creator"
    )
    flow_versions_created: Mapped[list["FlowVersion"]] = relationship(
        "FlowVersion", foreign_keys="FlowVersion.created_by", back_populates="creator"
    )
    flow_versions_published: Mapped[list["FlowVersion"]] = relationship(
        "FlowVersion", foreign_keys="FlowVersion.published_by", back_populates="publisher"
    )
    flow_versions_reviewed: Mapped[list["FlowVersion"]] = relationship(
        "FlowVersion", foreign_keys="FlowVersion.reviewed_by", back_populates="reviewer"
    )

    # Production Run relationships
    production_runs_started: Mapped[list["ProductionRun"]] = relationship(
        "ProductionRun", foreign_keys="ProductionRun.started_by", back_populates="starter"
    )

    # Step execution relationships
    step_executions: Mapped[list["RunStepExecution"]] = relationship(
        "RunStepExecution", back_populates="operator"
    )
```

**Validation**:
```bash
uv run mypy app/models/user.py
```

---

## Validation Loop

### Step 1: Run All Migrations

```bash
cd backend
alembic upgrade head
```

### Step 2: Verify Schema

```bash
psql -c "\d lots" | grep -E "(step_index|status)"
psql -c "\d flow_versions" | grep -E "(reviewed_by|status)"
psql -c "\d production_runs" | grep -E "(flow_version_id|current_step_index|idempotency_key)"
psql -c "\d run_step_executions"
```

### Step 3: Test Models

```bash
uv run mypy app/models/
uv run python -c "
from app.models import *
print('LotStatus:', list(LotStatus))
print('LotType:', list(LotType))
print('FlowVersionStatus:', list(FlowVersionStatus))
print('RunStatus:', list(RunStatus))
print('StepExecutionStatus:', list(StepExecutionStatus))
"
```

### Step 4: Run Characterization Tests

```bash
uv run pytest tests/characterization/ -v
```

### Step 5: Test Immutability Trigger

```bash
# This should fail with "Cannot modify PUBLISHED"
psql -c "
    INSERT INTO flow_definitions (id, name) VALUES (gen_random_uuid(), '{\"en\":\"Test\"}');
    INSERT INTO flow_versions (id, flow_definition_id, version_num, status, graph_schema)
    SELECT gen_random_uuid(), id, 1, 'PUBLISHED', '{\"nodes\":[],\"edges\":[],\"viewport\":{}}'
    FROM flow_definitions WHERE name->>'en' = 'Test';

    UPDATE flow_versions
    SET graph_schema = '{\"nodes\":[{\"id\":\"test\"}],\"edges\":[],\"viewport\":{}}'
    WHERE status = 'PUBLISHED';
" 2>&1 | grep -q "Cannot modify PUBLISHED" && echo "PASS: Immutability trigger works"
```

---

## Final Checklist

- [ ] Migration 1: lots.step_index and lots.status added
- [ ] Migration 2: flow_versions.status CHECK updated, reviewed_by added
- [ ] Migration 3: production_runs enhanced with flow_version_id, step tracking
- [ ] Migration 4: run_step_executions table created
- [ ] Migration 5: Immutability trigger for PUBLISHED flow versions
- [ ] Model: LotStatus and LotType enums updated
- [ ] Model: FlowVersionStatus enum updated
- [ ] Model: RunStatus enum updated
- [ ] Model: RunStepExecution created
- [ ] Model: User relationships added
- [ ] All migrations run successfully
- [ ] All models import without errors
- [ ] Characterization tests pass
- [ ] Immutability trigger verified

---

## Confidence Score: 9/10

**High confidence** because:
- Migrations are straightforward column additions
- Existing patterns are well-established
- Triggers are simple and testable

**Minor uncertainty**:
- User model relationships may need TYPE_CHECKING imports adjusted
- Existing data migration (ACTIVE → RUNNING) needs verification on real data
