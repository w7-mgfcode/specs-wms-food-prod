"""Production-related models: Scenario, Stream, Phase, ProductionRun."""

import enum
from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, JSONB_TYPE, UUID_TYPE

if TYPE_CHECKING:
    from app.models.lot import Lot
    from app.models.qc import QCGate
    from app.models.user import User


class RunStatus(str, enum.Enum):
    """Production run status matching database CHECK constraint."""

    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


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
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
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
    scenario_id: Mapped[Optional[UUID]] = mapped_column(
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
    scenario_id: Mapped[Optional[UUID]] = mapped_column(
        UUID_TYPE,
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=True,
    )
    stream_id: Mapped[Optional[UUID]] = mapped_column(
        UUID_TYPE,
        ForeignKey("streams.id"),
        nullable=True,
    )
    qc_gate_id: Mapped[Optional[UUID]] = mapped_column(
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
    """

    __tablename__ = "production_runs"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    run_code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
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
    status: Mapped[RunStatus] = mapped_column(
        Enum(RunStatus, name="run_status", create_constraint=False),
        default=RunStatus.ACTIVE,
    )
    daily_target_kg: Mapped[Optional[Decimal]] = mapped_column(Numeric, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    summary: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB_TYPE, nullable=True)

    # Relationships
    scenario: Mapped[Optional["Scenario"]] = relationship(
        "Scenario", back_populates="production_runs"
    )
    operator: Mapped[Optional["User"]] = relationship(
        "User", back_populates="production_runs"
    )
    lots: Mapped[list["Lot"]] = relationship("Lot", back_populates="production_run")
