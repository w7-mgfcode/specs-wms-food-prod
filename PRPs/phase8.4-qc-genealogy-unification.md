# PRP: Phase 8.4 — QC & Genealogy Unification

> **Parent PRP**: phase8-unified-production-suite.md
> **Phase**: 8.4 - QC & Genealogy Unification
> **Date**: 2026-01-24
> **Status**: READY FOR IMPLEMENTATION
> **Confidence Score**: 8/10

---

## Purpose

Consolidate QC inspections, temperature logs, genealogy queries, and audit events into a unified system with:
1. Enhanced QC inspection model with step_index and idempotency
2. Temperature logging with automatic violation → HOLD workflow
3. Append-only audit event table with triggers
4. Unified genealogy API (1-back, 1-forward, full tree)
5. Frontend Quality Validator routes

---

## Prerequisites

- **Phase 8.1-8.3 Complete**: Schema alignment, runs, inventory
- Tables exist: `lots`, `production_runs`, `run_step_executions`
- Models exist: `Lot`, `ProductionRun`, `LotGenealogy`

---

## Reference Files

```yaml
Existing Patterns:
  - backend/app/models/qc.py (QCGate, QCDecision models)
  - backend/app/api/routes/qc.py (existing QC endpoints)
  - backend/app/api/routes/traceability.py (genealogy patterns)
  - INITIAL-11.md Section F (qc_inspections, temperature_logs, audit_events)
  - INITIAL-11.md Section H (validation rules)
```

---

## CCP Temperature Thresholds (from INITIAL-11)

| Step | Check | Threshold | Action on Violation |
|------|-------|-----------|---------------------|
| Receipt (1) | Surface | ≤ 4°C | HOLD lot |
| Freezing (7) | Core | ≤ -18°C | HOLD lot |
| Storage | Ambient | ≤ -18°C | HOLD buffer |
| Shipment (10) | Ambient | ≤ -18°C | HOLD shipment |

---

## Task List

### Task 4.1: Create Database Migration for QC Tables

**File**: `backend/alembic/versions/{timestamp}_add_qc_inspections_temp_audit.py`

```python
"""Add qc_inspections, temperature_logs, and audit_events tables.

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
    # Create qc_inspections table
    op.create_table(
        'qc_inspections',
        sa.Column('id', sa.Uuid(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('lot_id', sa.Uuid(), nullable=False),
        sa.Column('run_id', sa.Uuid(), nullable=False),
        sa.Column('step_index', sa.Integer(), nullable=False),
        sa.Column('inspection_type', sa.String(30), nullable=False),
        sa.Column('is_ccp', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('decision', sa.String(10), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('inspector_id', sa.Uuid(), nullable=False),
        sa.Column('inspected_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('idempotency_key', sa.Uuid(), nullable=False),

        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['lot_id'], ['lots.id']),
        sa.ForeignKeyConstraint(['run_id'], ['production_runs.id']),
        sa.ForeignKeyConstraint(['inspector_id'], ['users.id']),
        sa.UniqueConstraint('idempotency_key', name='uq_qc_inspections_idempotency'),
        sa.CheckConstraint(
            "decision IN ('PASS','HOLD','FAIL')",
            name='ck_qc_inspections_decision'
        ),
        sa.CheckConstraint(
            "(decision = 'PASS') OR (notes IS NOT NULL AND LENGTH(notes) >= 10)",
            name='ck_qc_inspections_notes_required'
        ),
        sa.CheckConstraint(
            "step_index >= 0 AND step_index <= 10",
            name='ck_qc_inspections_step_index'
        ),
    )

    op.create_index('idx_qc_inspections_lot', 'qc_inspections', ['lot_id'])
    op.create_index('idx_qc_inspections_run', 'qc_inspections', ['run_id'])
    op.create_index('idx_qc_inspections_step', 'qc_inspections', ['run_id', 'step_index'])

    # Create temperature_logs table
    op.create_table(
        'temperature_logs',
        sa.Column('id', sa.Uuid(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('lot_id', sa.Uuid(), nullable=True),
        sa.Column('buffer_id', sa.Uuid(), nullable=True),
        sa.Column('inspection_id', sa.Uuid(), nullable=True),
        sa.Column('temperature_c', sa.Numeric(5, 1), nullable=False),
        sa.Column('measurement_type', sa.String(20), nullable=False),
        sa.Column('is_violation', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('recorded_by', sa.Uuid(), nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),

        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['lot_id'], ['lots.id']),
        sa.ForeignKeyConstraint(['buffer_id'], ['buffers.id']),
        sa.ForeignKeyConstraint(['inspection_id'], ['qc_inspections.id']),
        sa.ForeignKeyConstraint(['recorded_by'], ['users.id']),
        sa.CheckConstraint(
            "measurement_type IN ('SURFACE','CORE','AMBIENT')",
            name='ck_temperature_logs_type'
        ),
    )

    op.create_index('idx_temp_logs_lot', 'temperature_logs', ['lot_id'])
    op.create_index('idx_temp_logs_buffer', 'temperature_logs', ['buffer_id'])
    op.create_index('idx_temp_logs_recorded', 'temperature_logs', ['recorded_at'])

    # Create audit_events table (append-only)
    op.create_table(
        'audit_events',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('entity_type', sa.String(30), nullable=False),
        sa.Column('entity_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('old_state', sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column('new_state', sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column('metadata', sa.dialects.postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),

        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
    )

    op.create_index('idx_audit_entity', 'audit_events', ['entity_type', 'entity_id'])
    op.create_index('idx_audit_created', 'audit_events', ['created_at'])
    op.create_index('idx_audit_user', 'audit_events', ['user_id'])


def downgrade() -> None:
    op.drop_index('idx_audit_user', 'audit_events')
    op.drop_index('idx_audit_created', 'audit_events')
    op.drop_index('idx_audit_entity', 'audit_events')
    op.drop_table('audit_events')

    op.drop_index('idx_temp_logs_recorded', 'temperature_logs')
    op.drop_index('idx_temp_logs_buffer', 'temperature_logs')
    op.drop_index('idx_temp_logs_lot', 'temperature_logs')
    op.drop_table('temperature_logs')

    op.drop_index('idx_qc_inspections_step', 'qc_inspections')
    op.drop_index('idx_qc_inspections_run', 'qc_inspections')
    op.drop_index('idx_qc_inspections_lot', 'qc_inspections')
    op.drop_table('qc_inspections')
```

---

### Task 4.2: Create Audit Append-Only Triggers

**File**: `backend/alembic/versions/{timestamp}_add_audit_append_only_triggers.py`

```python
"""Add triggers to enforce audit append-only and temp violation workflow.

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
    # Audit append-only enforcement
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_audit_modification()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'Audit events are append-only and cannot be modified or deleted';
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        DROP TRIGGER IF EXISTS trg_audit_no_update ON audit_events;
        CREATE TRIGGER trg_audit_no_update
        BEFORE UPDATE ON audit_events
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
    """)

    op.execute("""
        DROP TRIGGER IF EXISTS trg_audit_no_delete ON audit_events;
        CREATE TRIGGER trg_audit_no_delete
        BEFORE DELETE ON audit_events
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
    """)

    # Temperature violation auto-HOLD workflow
    op.execute("""
        CREATE OR REPLACE FUNCTION handle_temp_violation()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.is_violation = TRUE AND NEW.lot_id IS NOT NULL THEN
                -- Update lot status to HOLD
                UPDATE lots
                SET status = 'HOLD'
                WHERE id = NEW.lot_id AND status IN ('RELEASED', 'QUARANTINE');

                -- Record audit event
                INSERT INTO audit_events (event_type, entity_type, entity_id, user_id, new_state, metadata)
                VALUES (
                    'TEMP_VIOLATION_HOLD',
                    'lot',
                    NEW.lot_id,
                    NEW.recorded_by,
                    jsonb_build_object('status', 'HOLD'),
                    jsonb_build_object(
                        'temperature_c', NEW.temperature_c,
                        'measurement_type', NEW.measurement_type,
                        'threshold_violated', true
                    )
                );
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        DROP TRIGGER IF EXISTS trg_temp_violation_hold ON temperature_logs;
        CREATE TRIGGER trg_temp_violation_hold
        AFTER INSERT ON temperature_logs
        FOR EACH ROW EXECUTE FUNCTION handle_temp_violation();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_temp_violation_hold ON temperature_logs")
    op.execute("DROP FUNCTION IF EXISTS handle_temp_violation()")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_no_delete ON audit_events")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_no_update ON audit_events")
    op.execute("DROP FUNCTION IF EXISTS prevent_audit_modification()")
```

---

### Task 4.3: Create QC Inspection Model

**File**: `backend/app/models/qc_inspection.py` (NEW)

```python
"""QC inspection, temperature log, and audit event models."""

from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, JSONB_TYPE, UUID_TYPE

if TYPE_CHECKING:
    from app.models.inventory import Buffer
    from app.models.lot import Lot
    from app.models.production import ProductionRun
    from app.models.user import User


class QCInspection(Base):
    """
    QC inspection record per INITIAL-11.

    Maps to public.qc_inspections table.
    """

    __tablename__ = "qc_inspections"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    lot_id: Mapped[UUID] = mapped_column(
        UUID_TYPE, ForeignKey("lots.id"), nullable=False
    )
    run_id: Mapped[UUID] = mapped_column(
        UUID_TYPE, ForeignKey("production_runs.id"), nullable=False
    )
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    inspection_type: Mapped[str] = mapped_column(String(30), nullable=False)
    is_ccp: Mapped[bool] = mapped_column(Boolean, default=False)
    decision: Mapped[str] = mapped_column(String(10), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    inspector_id: Mapped[UUID] = mapped_column(
        UUID_TYPE, ForeignKey("users.id"), nullable=False
    )
    inspected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    idempotency_key: Mapped[UUID] = mapped_column(UUID_TYPE, unique=True, nullable=False)

    # Relationships
    lot: Mapped["Lot"] = relationship("Lot", back_populates="qc_inspections_new")
    production_run: Mapped["ProductionRun"] = relationship(
        "ProductionRun", back_populates="qc_inspections"
    )
    inspector: Mapped["User"] = relationship("User", back_populates="qc_inspections_made")
    temperature_logs: Mapped[list["TemperatureLog"]] = relationship(
        "TemperatureLog", back_populates="inspection"
    )


class TemperatureLog(Base):
    """
    Temperature measurement log.

    Maps to public.temperature_logs table.
    """

    __tablename__ = "temperature_logs"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    lot_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE, ForeignKey("lots.id"), nullable=True
    )
    buffer_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE, ForeignKey("buffers.id"), nullable=True
    )
    inspection_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE, ForeignKey("qc_inspections.id"), nullable=True
    )
    temperature_c: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False)
    measurement_type: Mapped[str] = mapped_column(String(20), nullable=False)
    is_violation: Mapped[bool] = mapped_column(Boolean, default=False)
    recorded_by: Mapped[UUID] = mapped_column(
        UUID_TYPE, ForeignKey("users.id"), nullable=False
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Relationships
    lot: Mapped[Optional["Lot"]] = relationship("Lot", back_populates="temperature_logs")
    buffer: Mapped[Optional["Buffer"]] = relationship("Buffer", back_populates="temperature_logs")
    inspection: Mapped[Optional["QCInspection"]] = relationship(
        "QCInspection", back_populates="temperature_logs"
    )
    recorder: Mapped["User"] = relationship("User", back_populates="temperature_logs_recorded")


class AuditEvent(Base):
    """
    Append-only audit event log.

    Maps to public.audit_events table.
    """

    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(30), nullable=False)
    entity_id: Mapped[UUID] = mapped_column(UUID_TYPE, nullable=False)
    user_id: Mapped[UUID] = mapped_column(
        UUID_TYPE, ForeignKey("users.id"), nullable=False
    )
    old_state: Mapped[dict | None] = mapped_column(JSONB_TYPE, nullable=True)
    new_state: Mapped[dict | None] = mapped_column(JSONB_TYPE, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB_TYPE, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="audit_events")
```

---

### Task 4.4: Create Pydantic Schemas

**File**: `backend/app/schemas/qc_inspection.py` (NEW)

```python
"""QC inspection, temperature log, and audit event schemas."""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class QCDecisionType(str, Enum):
    """QC decision types."""
    PASS = "PASS"
    HOLD = "HOLD"
    FAIL = "FAIL"


class MeasurementType(str, Enum):
    """Temperature measurement types."""
    SURFACE = "SURFACE"
    CORE = "CORE"
    AMBIENT = "AMBIENT"


# --- QC Inspection Schemas ---


class QCInspectionCreate(BaseModel):
    """Create a QC inspection."""

    lot_id: UUID
    run_id: UUID
    step_index: int = Field(..., ge=0, le=10)
    inspection_type: str = Field(..., max_length=30)
    is_ccp: bool = False
    decision: QCDecisionType
    notes: str | None = Field(None, max_length=1000)

    @model_validator(mode="after")
    def validate_notes_required(self) -> Self:
        """Validate notes required for HOLD/FAIL."""
        if self.decision in (QCDecisionType.HOLD, QCDecisionType.FAIL):
            if not self.notes or len(self.notes.strip()) < 10:
                raise ValueError("Notes required for HOLD/FAIL decisions (min 10 chars)")
        return self


class QCInspectionResponse(BaseModel):
    """QC inspection response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lot_id: UUID
    run_id: UUID
    step_index: int
    inspection_type: str
    is_ccp: bool
    decision: str
    notes: str | None = None
    inspector_id: UUID
    inspected_at: datetime


class QCInspectionWithLotResponse(BaseModel):
    """QC inspection with lot details."""

    id: UUID
    lot_id: UUID
    lot_code: str
    run_id: UUID
    step_index: int
    inspection_type: str
    is_ccp: bool
    decision: str
    notes: str | None = None
    inspector_id: UUID
    inspector_name: str | None = None
    inspected_at: datetime


# --- Temperature Log Schemas ---


class TemperatureLogCreate(BaseModel):
    """Create a temperature log."""

    lot_id: UUID | None = None
    buffer_id: UUID | None = None
    inspection_id: UUID | None = None
    temperature_c: Decimal = Field(..., ge=-50, le=50)
    measurement_type: MeasurementType
    is_violation: bool = False


class TemperatureLogResponse(BaseModel):
    """Temperature log response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lot_id: UUID | None = None
    buffer_id: UUID | None = None
    inspection_id: UUID | None = None
    temperature_c: Decimal
    measurement_type: str
    is_violation: bool
    recorded_by: UUID
    recorded_at: datetime


# --- Audit Event Schemas ---


class AuditEventResponse(BaseModel):
    """Audit event response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    entity_type: str
    entity_id: UUID
    user_id: UUID
    old_state: dict | None = None
    new_state: dict | None = None
    metadata: dict = Field(default_factory=dict, alias="metadata_")
    ip_address: str | None = None
    created_at: datetime


class AuditEventListResponse(BaseModel):
    """Paginated audit event list."""

    items: list[AuditEventResponse]
    total: int
    page: int
    per_page: int
```

---

### Task 4.5: Create QC Inspection API Routes

**File**: `backend/app/api/routes/qc_inspections.py` (NEW)

```python
"""QC inspection endpoints."""

from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import AllAuthenticated, CanMakeQCDecisions, DBSession
from app.models.lot import Lot, LotStatus
from app.models.qc_inspection import QCInspection
from app.rate_limit import limiter
from app.schemas.qc_inspection import (
    QCDecisionType,
    QCInspectionCreate,
    QCInspectionResponse,
    QCInspectionWithLotResponse,
)

router = APIRouter(prefix="/qc/inspections", tags=["qc"])


@router.get("", response_model=list[QCInspectionResponse])
@limiter.limit("100/minute")
async def list_inspections(
    request: Request,
    db: DBSession,
    current_user: AllAuthenticated,
    lot_id: UUID | None = None,
    run_id: UUID | None = None,
    step_index: int | None = None,
    decision: str | None = None,
    limit: int = 100,
) -> list[QCInspectionResponse]:
    """
    List QC inspections with optional filters.

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    stmt = select(QCInspection).order_by(QCInspection.inspected_at.desc()).limit(limit)

    if lot_id:
        stmt = stmt.where(QCInspection.lot_id == lot_id)
    if run_id:
        stmt = stmt.where(QCInspection.run_id == run_id)
    if step_index is not None:
        stmt = stmt.where(QCInspection.step_index == step_index)
    if decision:
        stmt = stmt.where(QCInspection.decision == decision)

    result = await db.execute(stmt)
    inspections = result.scalars().all()

    return [QCInspectionResponse.model_validate(i) for i in inspections]


@router.get("/{inspection_id}", response_model=QCInspectionResponse)
@limiter.limit("100/minute")
async def get_inspection(
    request: Request,
    inspection_id: UUID,
    db: DBSession,
    current_user: AllAuthenticated,
) -> QCInspectionResponse:
    """
    Get QC inspection by ID.

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    stmt = select(QCInspection).where(QCInspection.id == inspection_id)
    result = await db.execute(stmt)
    inspection = result.scalar_one_or_none()

    if inspection is None:
        raise HTTPException(status_code=404, detail="Inspection not found")

    return QCInspectionResponse.model_validate(inspection)


@router.post("", response_model=QCInspectionResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("100/minute")
async def create_inspection(
    request: Request,
    data: QCInspectionCreate,
    db: DBSession,
    current_user: CanMakeQCDecisions,
    idempotency_key: UUID = Header(..., alias="Idempotency-Key"),
) -> QCInspectionResponse:
    """
    Record a QC inspection.

    Notes are required for HOLD and FAIL decisions (min 10 chars).

    Requires: ADMIN, MANAGER, AUDITOR, or OPERATOR role.
    Rate limit: 100/minute.
    Idempotency: Required header for duplicate prevention.
    """
    # Idempotency check
    existing_stmt = select(QCInspection).where(QCInspection.idempotency_key == idempotency_key)
    existing_result = await db.execute(existing_stmt)
    existing = existing_result.scalar_one_or_none()
    if existing:
        return QCInspectionResponse.model_validate(existing)

    # Validate lot exists
    lot_stmt = select(Lot).where(Lot.id == data.lot_id)
    lot_result = await db.execute(lot_stmt)
    lot = lot_result.scalar_one_or_none()

    if lot is None:
        raise HTTPException(status_code=404, detail="Lot not found")

    # Create inspection
    inspection = QCInspection(
        lot_id=data.lot_id,
        run_id=data.run_id,
        step_index=data.step_index,
        inspection_type=data.inspection_type,
        is_ccp=data.is_ccp,
        decision=data.decision.value,
        notes=data.notes,
        inspector_id=current_user.id,
        idempotency_key=idempotency_key,
    )
    db.add(inspection)

    # Update lot status based on decision
    if data.decision == QCDecisionType.PASS:
        if lot.status == LotStatus.QUARANTINE.value:
            lot.status = LotStatus.RELEASED.value
    elif data.decision == QCDecisionType.HOLD:
        lot.status = LotStatus.HOLD.value
    elif data.decision == QCDecisionType.FAIL:
        lot.status = LotStatus.REJECTED.value

    await db.flush()
    await db.refresh(inspection)

    return QCInspectionResponse.model_validate(inspection)
```

---

### Task 4.6: Create Temperature Log API Routes

**File**: `backend/app/api/routes/temperature.py` (NEW)

```python
"""Temperature logging endpoints."""

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import AllAuthenticated, CanMakeQCDecisions, DBSession
from app.models.lot import Lot
from app.models.inventory import Buffer
from app.models.qc_inspection import TemperatureLog
from app.rate_limit import limiter
from app.schemas.qc_inspection import TemperatureLogCreate, TemperatureLogResponse

router = APIRouter(prefix="/temperature-logs", tags=["qc"])

# CCP Temperature Thresholds
TEMP_THRESHOLDS = {
    "SURFACE": {"max": Decimal("4.0"), "step": 1},  # Receipt
    "CORE": {"min": Decimal("-18.0"), "step": 7},    # Freezing
    "AMBIENT": {"min": Decimal("-18.0"), "step": 10}, # Shipment
}


def check_violation(measurement_type: str, temperature_c: Decimal, step_index: int | None) -> bool:
    """Check if temperature violates thresholds."""
    if measurement_type == "SURFACE":
        return temperature_c > Decimal("4.0")
    elif measurement_type == "CORE":
        return temperature_c > Decimal("-18.0")
    elif measurement_type == "AMBIENT":
        return temperature_c > Decimal("-18.0")
    return False


@router.get("", response_model=list[TemperatureLogResponse])
@limiter.limit("100/minute")
async def list_temperature_logs(
    request: Request,
    db: DBSession,
    current_user: AllAuthenticated,
    lot_id: UUID | None = None,
    buffer_id: UUID | None = None,
    violations_only: bool = False,
    limit: int = 100,
) -> list[TemperatureLogResponse]:
    """
    List temperature logs.

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    stmt = select(TemperatureLog).order_by(TemperatureLog.recorded_at.desc()).limit(limit)

    if lot_id:
        stmt = stmt.where(TemperatureLog.lot_id == lot_id)
    if buffer_id:
        stmt = stmt.where(TemperatureLog.buffer_id == buffer_id)
    if violations_only:
        stmt = stmt.where(TemperatureLog.is_violation == True)

    result = await db.execute(stmt)
    logs = result.scalars().all()

    return [TemperatureLogResponse.model_validate(log) for log in logs]


@router.post("", response_model=TemperatureLogResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("100/minute")
async def create_temperature_log(
    request: Request,
    data: TemperatureLogCreate,
    db: DBSession,
    current_user: CanMakeQCDecisions,
) -> TemperatureLogResponse:
    """
    Record a temperature measurement.

    If is_violation=true and lot_id is provided, the lot will be automatically
    placed on HOLD via database trigger.

    Requires: ADMIN, MANAGER, AUDITOR, or OPERATOR role.
    Rate limit: 100/minute.
    """
    # Validate lot exists if provided
    step_index = None
    if data.lot_id:
        lot_stmt = select(Lot).where(Lot.id == data.lot_id)
        lot_result = await db.execute(lot_stmt)
        lot = lot_result.scalar_one_or_none()
        if lot is None:
            raise HTTPException(status_code=404, detail="Lot not found")
        step_index = lot.step_index

    # Validate buffer exists if provided
    if data.buffer_id:
        buffer_stmt = select(Buffer).where(Buffer.id == data.buffer_id)
        buffer_result = await db.execute(buffer_stmt)
        if buffer_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Buffer not found")

    # Auto-detect violation if not explicitly set
    is_violation = data.is_violation
    if not is_violation:
        is_violation = check_violation(
            data.measurement_type.value,
            data.temperature_c,
            step_index
        )

    # Create log (trigger will handle HOLD workflow if violation)
    log = TemperatureLog(
        lot_id=data.lot_id,
        buffer_id=data.buffer_id,
        inspection_id=data.inspection_id,
        temperature_c=data.temperature_c,
        measurement_type=data.measurement_type.value,
        is_violation=is_violation,
        recorded_by=current_user.id,
    )
    db.add(log)
    await db.flush()
    await db.refresh(log)

    return TemperatureLogResponse.model_validate(log)
```

---

### Task 4.7: Create Genealogy API Routes

**File**: `backend/app/api/routes/genealogy.py` (NEW)

```python
"""Genealogy query endpoints."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from app.api.deps import AllAuthenticated, DBSession
from app.models.lot import Lot, LotGenealogy
from app.rate_limit import limiter
from app.schemas.lot import LotResponse

router = APIRouter(prefix="/genealogy", tags=["genealogy"])


@router.get("/{lot_code}/parents", response_model=list[LotResponse])
@limiter.limit("50/minute")
async def get_parents(
    request: Request,
    lot_code: str,
    db: DBSession,
    current_user: AllAuthenticated,
) -> list[LotResponse]:
    """
    Get parent lots (1-back trace).

    Returns all lots that were inputs to this lot.

    Requires: Any authenticated user.
    Rate limit: 50/minute.
    """
    # Find the lot
    lot_stmt = select(Lot).where(Lot.lot_code == lot_code)
    lot_result = await db.execute(lot_stmt)
    lot = lot_result.scalar_one_or_none()

    if lot is None:
        raise HTTPException(status_code=404, detail="Lot not found")

    # Get parents
    parents_stmt = (
        select(Lot)
        .join(LotGenealogy, LotGenealogy.parent_lot_id == Lot.id)
        .where(LotGenealogy.child_lot_id == lot.id)
    )
    parents_result = await db.execute(parents_stmt)
    parents = parents_result.scalars().all()

    return [LotResponse.model_validate(p) for p in parents]


@router.get("/{lot_code}/children", response_model=list[LotResponse])
@limiter.limit("50/minute")
async def get_children(
    request: Request,
    lot_code: str,
    db: DBSession,
    current_user: AllAuthenticated,
) -> list[LotResponse]:
    """
    Get child lots (1-forward trace).

    Returns all lots that were produced from this lot.

    Requires: Any authenticated user.
    Rate limit: 50/minute.
    """
    # Find the lot
    lot_stmt = select(Lot).where(Lot.lot_code == lot_code)
    lot_result = await db.execute(lot_stmt)
    lot = lot_result.scalar_one_or_none()

    if lot is None:
        raise HTTPException(status_code=404, detail="Lot not found")

    # Get children
    children_stmt = (
        select(Lot)
        .join(LotGenealogy, LotGenealogy.child_lot_id == Lot.id)
        .where(LotGenealogy.parent_lot_id == lot.id)
    )
    children_result = await db.execute(children_stmt)
    children = children_result.scalars().all()

    return [LotResponse.model_validate(c) for c in children]


@router.get("/{lot_code}/tree")
@limiter.limit("20/minute")
async def get_genealogy_tree(
    request: Request,
    lot_code: str,
    db: DBSession,
    current_user: AllAuthenticated,
    depth: int = 3,
):
    """
    Get full genealogy tree (both directions).

    Returns a tree structure with parents and children up to specified depth.

    Requires: Any authenticated user.
    Rate limit: 20/minute (expensive query).
    """
    # Find the lot
    lot_stmt = select(Lot).where(Lot.lot_code == lot_code)
    lot_result = await db.execute(lot_stmt)
    lot = lot_result.scalar_one_or_none()

    if lot is None:
        raise HTTPException(status_code=404, detail="Lot not found")

    async def get_ancestors(lot_id: UUID, current_depth: int) -> list:
        if current_depth <= 0:
            return []

        parents_stmt = (
            select(Lot, LotGenealogy.quantity_used_kg)
            .join(LotGenealogy, LotGenealogy.parent_lot_id == Lot.id)
            .where(LotGenealogy.child_lot_id == lot_id)
        )
        parents_result = await db.execute(parents_stmt)
        parents = parents_result.all()

        result = []
        for parent_lot, qty in parents:
            ancestors = await get_ancestors(parent_lot.id, current_depth - 1)
            result.append({
                "lot": LotResponse.model_validate(parent_lot).model_dump(),
                "quantity_used_kg": float(qty) if qty else None,
                "parents": ancestors,
            })
        return result

    async def get_descendants(lot_id: UUID, current_depth: int) -> list:
        if current_depth <= 0:
            return []

        children_stmt = (
            select(Lot, LotGenealogy.quantity_used_kg)
            .join(LotGenealogy, LotGenealogy.child_lot_id == Lot.id)
            .where(LotGenealogy.parent_lot_id == lot_id)
        )
        children_result = await db.execute(children_stmt)
        children = children_result.all()

        result = []
        for child_lot, qty in children:
            descendants = await get_descendants(child_lot.id, current_depth - 1)
            result.append({
                "lot": LotResponse.model_validate(child_lot).model_dump(),
                "quantity_used_kg": float(qty) if qty else None,
                "children": descendants,
            })
        return result

    parents = await get_ancestors(lot.id, depth)
    children = await get_descendants(lot.id, depth)

    return {
        "central": LotResponse.model_validate(lot).model_dump(),
        "parents": parents,
        "children": children,
        "depth": depth,
    }
```

---

### Task 4.8: Create Audit API Routes

**File**: `backend/app/api/routes/audit.py` (NEW)

```python
"""Audit event query endpoints."""

from uuid import UUID

from fastapi import APIRouter, Request
from sqlalchemy import func, select

from app.api.deps import AllAuthenticated, DBSession
from app.models.qc_inspection import AuditEvent
from app.rate_limit import limiter
from app.schemas.qc_inspection import AuditEventListResponse, AuditEventResponse

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/events", response_model=AuditEventListResponse)
@limiter.limit("50/minute")
async def list_audit_events(
    request: Request,
    db: DBSession,
    current_user: AllAuthenticated,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    event_type: str | None = None,
    user_id: UUID | None = None,
    page: int = 1,
    per_page: int = 50,
) -> AuditEventListResponse:
    """
    Query audit events with pagination.

    Requires: Any authenticated user.
    Rate limit: 50/minute.
    """
    # Base query
    stmt = select(AuditEvent).order_by(AuditEvent.created_at.desc())

    # Apply filters
    if entity_type:
        stmt = stmt.where(AuditEvent.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditEvent.entity_id == entity_id)
    if event_type:
        stmt = stmt.where(AuditEvent.event_type == event_type)
    if user_id:
        stmt = stmt.where(AuditEvent.user_id == user_id)

    # Get total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    count_result = await db.execute(count_stmt)
    total = count_result.scalar_one()

    # Apply pagination
    offset = (page - 1) * per_page
    stmt = stmt.offset(offset).limit(per_page)

    result = await db.execute(stmt)
    events = result.scalars().all()

    return AuditEventListResponse(
        items=[AuditEventResponse.model_validate(e) for e in events],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/events/{entity_type}/{entity_id}", response_model=list[AuditEventResponse])
@limiter.limit("100/minute")
async def get_entity_audit_trail(
    request: Request,
    entity_type: str,
    entity_id: UUID,
    db: DBSession,
    current_user: AllAuthenticated,
) -> list[AuditEventResponse]:
    """
    Get audit trail for a specific entity.

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    stmt = (
        select(AuditEvent)
        .where(
            AuditEvent.entity_type == entity_type,
            AuditEvent.entity_id == entity_id,
        )
        .order_by(AuditEvent.created_at.desc())
    )

    result = await db.execute(stmt)
    events = result.scalars().all()

    return [AuditEventResponse.model_validate(e) for e in events]
```

---

### Task 4.9: Register All New Routers

**File**: `backend/app/api/routes/__init__.py` (UPDATE)

```python
from fastapi import APIRouter

from app.api.routes import (
    audit,
    auth,
    buffers,
    flows,
    genealogy,
    health,
    inventory,
    lots,
    qc,
    qc_inspections,
    runs,
    temperature,
    traceability,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(lots.router)
api_router.include_router(qc.router)
api_router.include_router(traceability.router)
api_router.include_router(flows.router)
api_router.include_router(runs.router)
api_router.include_router(buffers.router)
api_router.include_router(inventory.router)
api_router.include_router(qc_inspections.router)   # NEW
api_router.include_router(temperature.router)      # NEW
api_router.include_router(genealogy.router)        # NEW
api_router.include_router(audit.router)            # NEW
```

---

### Task 4.10: Update models/__init__.py

**File**: `backend/app/models/__init__.py` (UPDATE)

```python
from app.models.qc_inspection import AuditEvent, QCInspection, TemperatureLog

__all__ = [
    # ... existing exports ...
    # QC
    "QCInspection",
    "TemperatureLog",
    "AuditEvent",
]
```

---

## Validation Loop

### Step 1: Run Migrations

```bash
cd backend
alembic upgrade head
```

### Step 2: Verify Triggers

```bash
# Test audit append-only
psql -c "
    INSERT INTO audit_events (event_type, entity_type, entity_id, user_id)
    VALUES ('TEST', 'test', gen_random_uuid(), (SELECT id FROM users LIMIT 1));

    UPDATE audit_events SET event_type = 'MODIFIED' WHERE event_type = 'TEST';
" 2>&1 | grep -q "append-only" && echo "PASS: Audit is append-only"

# Test temperature violation auto-HOLD
# (Need to set up test data first)
```

### Step 3: Type Check

```bash
uv run mypy app/models/qc_inspection.py app/schemas/qc_inspection.py app/api/routes/qc_inspections.py app/api/routes/temperature.py app/api/routes/genealogy.py app/api/routes/audit.py
```

### Step 4: Run Tests

```bash
uv run pytest tests/test_qc_inspections.py tests/test_audit.py -v
```

---

## Final Checklist

- [ ] Migration: qc_inspections, temperature_logs, audit_events tables
- [ ] Migration: Audit append-only triggers
- [ ] Migration: Temperature violation auto-HOLD trigger
- [ ] Models: QCInspection, TemperatureLog, AuditEvent
- [ ] Schemas: Create/Response schemas with validation
- [ ] Routes: GET/POST /qc/inspections
- [ ] Routes: GET/POST /temperature-logs
- [ ] Routes: GET /genealogy/{lot_code}/parents
- [ ] Routes: GET /genealogy/{lot_code}/children
- [ ] Routes: GET /genealogy/{lot_code}/tree
- [ ] Routes: GET /audit/events
- [ ] Routes: GET /audit/events/{entity_type}/{entity_id}
- [ ] Routers registered
- [ ] Tests pass

---

## Confidence Score: 8/10

**High confidence** because:
- Clear data model from INITIAL-11
- Trigger patterns well-established in PostgreSQL
- Existing genealogy patterns in codebase

**Uncertainty**:
- Recursive tree queries may need optimization for large datasets
- Temperature threshold configuration could be more flexible
- Audit event creation integration needs more coverage
