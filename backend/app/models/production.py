"""Production-related models: Scenario, Stream, Phase, ProductionRun."""

import enum
from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import JSONB_TYPE, UUID_TYPE, Base

if TYPE_CHECKING:
    from app.models.flow import FlowVersion
    from app.models.inventory import InventoryItem
    from app.models.lot import Lot
    from app.models.qc import QCGate
    from app.models.qc_inspection import QCInspection
    from app.models.run import RunStepExecution
    from app.models.user import User


class RunStatus(str, enum.Enum):
    """Production run status per INITIAL-11.

    Phase 8.1: Updated lifecycle states.
    """

    IDLE = "IDLE"          # Created but not started
    RUNNING = "RUNNING"    # Active execution (was ACTIVE)
    HOLD = "HOLD"          # Paused due to issue
    COMPLETED = "COMPLETED"  # Successfully finished
    ABORTED = "ABORTED"    # Terminated early (was CANCELLED)
    ARCHIVED = "ARCHIVED"  # Historical record


class Scenario(Base):
    """
    Production scenario configuration.

    Maps to public.scenarios table.
    """

    __tablename__ = "scenarios"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    name: Mapped[dict[str, Any]] = mapped_column(
        JSONB_TYPE,
        nullable=False,
    )  # {hu: str, en: str}
    version: Mapped[str] = mapped_column(String, nullable=False)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB_TYPE, default=dict)
    i18n: Mapped[dict[str, Any]] = mapped_column(JSONB_TYPE, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Relationships
    streams: Mapped[list["Stream"]] = relationship(
        "Stream", back_populates="scenario", cascade="all, delete-orphan"
    )
    qc_gates: Mapped[list["QCGate"]] = relationship(
        "QCGate", back_populates="scenario", cascade="all, delete-orphan"
    )
    phases: Mapped[list["Phase"]] = relationship(
        "Phase", back_populates="scenario", cascade="all, delete-orphan"
    )
    production_runs: Mapped[list["ProductionRun"]] = relationship(
        "ProductionRun", back_populates="scenario"
    )


class Stream(Base):
    """
    Production stream (A, B, C).

    Maps to public.streams table.
    """

    __tablename__ = "streams"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    scenario_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=True,
    )
    stream_key: Mapped[str] = mapped_column(String, nullable=False)  # 'A', 'B', 'C'
    name: Mapped[dict[str, Any]] = mapped_column(JSONB_TYPE, nullable=False)
    color: Mapped[str] = mapped_column(String, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    scenario: Mapped[Optional["Scenario"]] = relationship(
        "Scenario", back_populates="streams"
    )
    phases: Mapped[list["Phase"]] = relationship("Phase", back_populates="stream")


class Phase(Base):
    """
    Production phase within a stream.

    Maps to public.phases table.
    """

    __tablename__ = "phases"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    scenario_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=True,
    )
    stream_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("streams.id"),
        nullable=True,
    )
    qc_gate_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("qc_gates.id"),
        nullable=True,
    )
    phase_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[dict[str, Any]] = mapped_column(JSONB_TYPE, nullable=False)
    description: Mapped[dict[str, Any]] = mapped_column(JSONB_TYPE, nullable=False)

    # Relationships
    scenario: Mapped[Optional["Scenario"]] = relationship(
        "Scenario", back_populates="phases"
    )
    stream: Mapped[Optional["Stream"]] = relationship("Stream", back_populates="phases")
    qc_gate: Mapped[Optional["QCGate"]] = relationship("QCGate", back_populates="phases")
    lots: Mapped[list["Lot"]] = relationship("Lot", back_populates="phase")


class ProductionRun(Base):
    """
    Active production run.

    Maps to public.production_runs table.

    Phase 8.1: Enhanced with flow version pinning and step tracking.
    """

    __tablename__ = "production_runs"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    run_code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)

    # Phase 8.1: Flow version pinning (immutable after creation)
    flow_version_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("flow_versions.id"),
        nullable=True,
    )

    scenario_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("scenarios.id"),
        nullable=True,
    )
    operator_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("users.id"),
        nullable=True,
    )

    # Phase 8.1: Started by user (separate from operator for audit)
    started_by: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("users.id"),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default=RunStatus.IDLE.value,
    )

    # Phase 8.1: Current step index (0-10)
    current_step_index: Mapped[int] = mapped_column(Integer, default=0)

    daily_target_kg: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Phase 8.1: Completed timestamp (distinct from ended_at)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Phase 8.1: Idempotency key for duplicate prevention
    idempotency_key: Mapped[UUID | None] = mapped_column(UUID_TYPE, unique=True, nullable=True)

    summary: Mapped[dict[str, Any] | None] = mapped_column(JSONB_TYPE, nullable=True)

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

    # Phase 8.1: Step executions
    step_executions: Mapped[list["RunStepExecution"]] = relationship(
        "RunStepExecution", back_populates="production_run", cascade="all, delete-orphan"
    )

    # Phase 8.3: Inventory items in this run
    inventory_items: Mapped[list["InventoryItem"]] = relationship(
        "InventoryItem", back_populates="production_run"
    )

    # Phase 8.4: QC inspections in this run
    qc_inspections: Mapped[list["QCInspection"]] = relationship(
        "QCInspection", back_populates="production_run"
    )
