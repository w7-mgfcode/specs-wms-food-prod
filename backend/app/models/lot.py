"""Lot and genealogy models."""

import enum
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.production import Phase, ProductionRun
    from app.models.qc import QCDecision
    from app.models.user import User


class LotType(str, enum.Enum):
    """Lot type matching database CHECK constraint."""

    RAW = "RAW"  # Raw material receipt
    DEB = "DEB"  # Deboned meat
    BULK = "BULK"  # Bulk buffer
    MIX = "MIX"  # Mixed batch
    SKW = "SKW"  # Skewered rod
    FRZ = "FRZ"  # Frozen
    FG = "FG"  # Finished goods


class Lot(Base):
    """
    Production lot tracking.

    Maps to public.lots table.
    """

    __tablename__ = "lots"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    lot_code: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    lot_type: Mapped[Optional[LotType]] = mapped_column(
        Enum(LotType, name="lot_type", create_constraint=False), nullable=True
    )
    production_run_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("production_runs.id"), nullable=True
    )
    phase_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("phases.id"), nullable=True
    )
    operator_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    weight_kg: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    temperature_c: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 1), nullable=True
    )
    metadata: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
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


class LotGenealogy(Base):
    """
    Parent/child lot relationships for traceability.

    Maps to public.lot_genealogy table.
    """

    __tablename__ = "lot_genealogy"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    parent_lot_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("lots.id"), nullable=True
    )
    child_lot_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("lots.id"), nullable=True
    )
    quantity_used_kg: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    linked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    # Relationships
    parent: Mapped[Optional["Lot"]] = relationship(
        "Lot",
        foreign_keys=[parent_lot_id],
        back_populates="child_links",
    )
    child: Mapped[Optional["Lot"]] = relationship(
        "Lot",
        foreign_keys=[child_lot_id],
        back_populates="parent_links",
    )
