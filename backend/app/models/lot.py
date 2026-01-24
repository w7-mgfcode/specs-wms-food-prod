"""Lot and genealogy models."""

import enum
from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import JSONB_TYPE, UUID_TYPE, Base

if TYPE_CHECKING:
    from app.models.inventory import InventoryItem, StockMove
    from app.models.production import Phase, ProductionRun
    from app.models.qc import QCDecision
    from app.models.user import User


class LotType(str, enum.Enum):
    """Lot type matching database CHECK constraint.

    Extended per INITIAL-11 to include SKU-specific types.
    """

    RAW = "RAW"      # Raw material receipt
    DEB = "DEB"      # Deboned meat
    BULK = "BULK"    # Bulk buffer
    MIX = "MIX"      # Mixed batch
    SKW = "SKW"      # Skewered rod (legacy)
    SKW15 = "SKW15"  # 15g skewer rod
    SKW30 = "SKW30"  # 30g skewer rod
    FRZ = "FRZ"      # Frozen (legacy)
    FRZ15 = "FRZ15"  # Frozen 15g
    FRZ30 = "FRZ30"  # Frozen 30g
    FG = "FG"        # Finished goods (legacy)
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
    lot_type: Mapped[LotType | None] = mapped_column(
        Enum(LotType, name="lot_type", create_constraint=False), nullable=True
    )

    # Phase 8.1: Step index for canonical 11-step tracking (0-10)
    step_index: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Phase 8.1: Lot lifecycle status
    status: Mapped[str] = mapped_column(
        String(20), default=LotStatus.CREATED.value
    )

    production_run_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("production_runs.id"),
        nullable=True,
    )
    phase_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("phases.id"),
        nullable=True,
    )
    operator_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("users.id"),
        nullable=True,
    )
    weight_kg: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    temperature_c: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 1), nullable=True
    )
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB_TYPE,
        default=dict,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
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

    # Phase 8.3: Inventory relationships
    inventory_items: Mapped[list["InventoryItem"]] = relationship(
        "InventoryItem", back_populates="lot"
    )
    stock_moves: Mapped[list["StockMove"]] = relationship(
        "StockMove", back_populates="lot"
    )


class LotGenealogy(Base):
    """
    Parent/child lot relationships for traceability.

    Maps to public.lot_genealogy table.
    """

    __tablename__ = "lot_genealogy"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    parent_lot_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("lots.id"),
        nullable=True,
    )
    child_lot_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("lots.id"),
        nullable=True,
    )
    quantity_used_kg: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    linked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
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
