"""QC inspection, temperature log, and audit event models.

Phase 8.4: QC & Genealogy Unification.
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import JSONB_TYPE, UUID_TYPE, Base

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
    old_state: Mapped[dict[str, Any] | None] = mapped_column(JSONB_TYPE, nullable=True)
    new_state: Mapped[dict[str, Any] | None] = mapped_column(JSONB_TYPE, nullable=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB_TYPE, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="audit_events")
