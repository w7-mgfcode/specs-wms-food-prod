"""QC Gate and Decision models."""

import enum
from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import JSONB_TYPE, UUID_TYPE, Base

if TYPE_CHECKING:
    from app.models.lot import Lot
    from app.models.production import Phase, Scenario
    from app.models.user import User


class GateType(str, enum.Enum):
    """QC gate type matching database CHECK constraint."""

    CHECKPOINT = "CHECKPOINT"
    BLOCKING = "BLOCKING"
    INFO = "INFO"


class Decision(str, enum.Enum):
    """QC decision matching database CHECK constraint."""

    PASS = "PASS"
    HOLD = "HOLD"
    FAIL = "FAIL"


class QCGate(Base):
    """
    QC checkpoint configuration.

    Maps to public.qc_gates table.
    """

    __tablename__ = "qc_gates"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    scenario_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=True,
    )
    gate_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[dict[str, Any]] = mapped_column(JSONB_TYPE, nullable=False)
    gate_type: Mapped[GateType | None] = mapped_column(
        Enum(GateType, name="gate_type", create_constraint=False), nullable=True
    )
    is_ccp: Mapped[bool] = mapped_column(Boolean, default=False)  # Critical Control Point
    checklist: Mapped[list[Any]] = mapped_column(JSONB_TYPE, default=list)

    # Relationships
    scenario: Mapped[Optional["Scenario"]] = relationship(
        "Scenario", back_populates="qc_gates"
    )
    phases: Mapped[list["Phase"]] = relationship("Phase", back_populates="qc_gate")
    decisions: Mapped[list["QCDecision"]] = relationship(
        "QCDecision", back_populates="qc_gate"
    )


class QCDecision(Base):
    """
    QC decision record (immutable audit log).

    Maps to public.qc_decisions table.
    """

    __tablename__ = "qc_decisions"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    lot_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("lots.id"),
        nullable=True,
    )
    qc_gate_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("qc_gates.id"),
        nullable=True,
    )
    operator_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("users.id"),
        nullable=True,
    )
    decision: Mapped[Decision | None] = mapped_column(
        Enum(Decision, name="decision", create_constraint=False), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    temperature_c: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 1), nullable=True
    )
    digital_signature: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Relationships
    lot: Mapped[Optional["Lot"]] = relationship("Lot", back_populates="qc_decisions")
    qc_gate: Mapped[Optional["QCGate"]] = relationship(
        "QCGate", back_populates="decisions"
    )
    operator: Mapped[Optional["User"]] = relationship(
        "User", back_populates="qc_decisions"
    )
