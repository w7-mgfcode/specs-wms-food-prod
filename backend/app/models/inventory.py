"""Inventory and buffer models.

Phase 8.3: Buffer management and inventory tracking.
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import ARRAY_STRING_TYPE, UUID_TYPE, Base

if TYPE_CHECKING:
    from app.models.lot import Lot
    from app.models.production import ProductionRun
    from app.models.qc_inspection import TemperatureLog
    from app.models.user import User


class Buffer(Base):
    """
    Buffer storage location.

    Maps to public.buffers table.
    """

    __tablename__ = "buffers"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    buffer_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    buffer_type: Mapped[str] = mapped_column(String(20), nullable=False)
    allowed_lot_types: Mapped[list[str]] = mapped_column(
        ARRAY_STRING_TYPE, nullable=False
    )
    capacity_kg: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    temp_min_c: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False)
    temp_max_c: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Relationships
    inventory_items: Mapped[list["InventoryItem"]] = relationship(
        "InventoryItem", back_populates="buffer"
    )

    # Phase 8.4: Temperature logs for this buffer
    temperature_logs: Mapped[list["TemperatureLog"]] = relationship(
        "TemperatureLog", back_populates="buffer"
    )


class InventoryItem(Base):
    """
    Stock in buffer.

    Maps to public.inventory_items table.
    """

    __tablename__ = "inventory_items"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    lot_id: Mapped[UUID] = mapped_column(
        UUID_TYPE, ForeignKey("lots.id", ondelete="CASCADE"), nullable=False
    )
    buffer_id: Mapped[UUID] = mapped_column(
        UUID_TYPE, ForeignKey("buffers.id"), nullable=False
    )
    run_id: Mapped[UUID] = mapped_column(
        UUID_TYPE, ForeignKey("production_runs.id"), nullable=False
    )
    quantity_kg: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    entered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    exited_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    lot: Mapped["Lot"] = relationship("Lot", back_populates="inventory_items")
    buffer: Mapped["Buffer"] = relationship("Buffer", back_populates="inventory_items")
    production_run: Mapped["ProductionRun"] = relationship(
        "ProductionRun", back_populates="inventory_items"
    )


class StockMove(Base):
    """
    Stock movement record.

    Maps to public.stock_moves table.
    """

    __tablename__ = "stock_moves"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    lot_id: Mapped[UUID] = mapped_column(
        UUID_TYPE, ForeignKey("lots.id"), nullable=False
    )
    from_buffer_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE, ForeignKey("buffers.id"), nullable=True
    )
    to_buffer_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE, ForeignKey("buffers.id"), nullable=True
    )
    quantity_kg: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    move_type: Mapped[str] = mapped_column(String(20), nullable=False)
    operator_id: Mapped[UUID] = mapped_column(
        UUID_TYPE, ForeignKey("users.id"), nullable=False
    )
    idempotency_key: Mapped[UUID] = mapped_column(UUID_TYPE, unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Relationships
    lot: Mapped["Lot"] = relationship("Lot", back_populates="stock_moves")
    from_buffer: Mapped[Optional["Buffer"]] = relationship(
        "Buffer", foreign_keys=[from_buffer_id]
    )
    to_buffer: Mapped[Optional["Buffer"]] = relationship(
        "Buffer", foreign_keys=[to_buffer_id]
    )
    operator: Mapped["User"] = relationship("User", back_populates="stock_moves")
