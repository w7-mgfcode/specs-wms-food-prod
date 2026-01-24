"""Inventory and buffer request/response schemas.

Phase 8.3: Buffer management and inventory tracking.
"""

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# --- Buffer Schemas ---


class BufferResponse(BaseModel):
    """Buffer storage location response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    buffer_code: str
    buffer_type: str
    allowed_lot_types: list[str]
    capacity_kg: Decimal
    temp_min_c: Decimal
    temp_max_c: Decimal
    is_active: bool
    created_at: datetime


class BufferListItem(BaseModel):
    """Buffer list item for compact listings."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    buffer_code: str
    buffer_type: str
    is_active: bool


class BufferCreate(BaseModel):
    """Create a new buffer."""

    buffer_code: str = Field(
        ..., min_length=1, max_length=20, description="Unique buffer code"
    )
    buffer_type: Literal["LK", "MIX", "SKW15", "SKW30", "FRZ", "PAL"] = Field(
        ..., description="Buffer type"
    )
    allowed_lot_types: list[str] = Field(
        ..., min_length=1, description="Allowed lot types"
    )
    capacity_kg: Decimal = Field(..., gt=0, description="Capacity in kg")
    temp_min_c: Decimal = Field(..., ge=-50, le=50, description="Minimum temperature")
    temp_max_c: Decimal = Field(..., ge=-50, le=50, description="Maximum temperature")


class BufferUpdate(BaseModel):
    """Update buffer settings."""

    capacity_kg: Decimal | None = Field(None, gt=0, description="Capacity in kg")
    temp_min_c: Decimal | None = Field(None, ge=-50, le=50)
    temp_max_c: Decimal | None = Field(None, ge=-50, le=50)
    is_active: bool | None = None


# --- Inventory Item Schemas ---


class InventoryItemResponse(BaseModel):
    """Inventory item in buffer."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lot_id: UUID
    buffer_id: UUID
    run_id: UUID
    quantity_kg: Decimal
    entered_at: datetime
    exited_at: datetime | None = None


class InventoryItemCreate(BaseModel):
    """Create inventory item (receive to buffer)."""

    lot_id: UUID = Field(..., description="Lot to receive")
    buffer_id: UUID = Field(..., description="Target buffer")
    run_id: UUID = Field(..., description="Production run")
    quantity_kg: Decimal = Field(..., gt=0, description="Quantity in kg")


# --- Stock Move Schemas ---


MoveType = Literal["RECEIVE", "TRANSFER", "CONSUME", "SHIP"]


class StockMoveResponse(BaseModel):
    """Stock movement record."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lot_id: UUID
    from_buffer_id: UUID | None = None
    to_buffer_id: UUID | None = None
    quantity_kg: Decimal
    move_type: str
    operator_id: UUID
    idempotency_key: UUID
    created_at: datetime


class StockMoveCreate(BaseModel):
    """Create stock movement."""

    lot_id: UUID = Field(..., description="Lot to move")
    from_buffer_id: UUID | None = Field(None, description="Source buffer (null for RECEIVE)")
    to_buffer_id: UUID | None = Field(None, description="Target buffer (null for CONSUME/SHIP)")
    quantity_kg: Decimal = Field(..., gt=0, description="Quantity in kg")
    move_type: MoveType = Field(..., description="Type of movement")


class TransferRequest(BaseModel):
    """Request to transfer lot between buffers."""

    lot_id: UUID = Field(..., description="Lot to transfer")
    from_buffer_id: UUID = Field(..., description="Source buffer")
    to_buffer_id: UUID = Field(..., description="Target buffer")
    quantity_kg: Decimal = Field(..., gt=0, description="Quantity to transfer")


class ConsumeRequest(BaseModel):
    """Request to consume lot from buffer."""

    lot_id: UUID = Field(..., description="Lot to consume")
    buffer_id: UUID = Field(..., description="Buffer to consume from")
    quantity_kg: Decimal = Field(..., gt=0, description="Quantity to consume")


class ReceiveRequest(BaseModel):
    """Request to receive lot into buffer."""

    lot_id: UUID = Field(..., description="Lot to receive")
    buffer_id: UUID = Field(..., description="Target buffer")
    run_id: UUID = Field(..., description="Production run")
    quantity_kg: Decimal = Field(..., gt=0, description="Quantity to receive")


# --- Buffer Summary Schemas ---


class BufferSummary(BaseModel):
    """Buffer summary with current inventory."""

    buffer: BufferResponse
    current_quantity_kg: Decimal
    item_count: int


class RunBufferSummary(BaseModel):
    """Buffer summary for a specific production run."""

    buffer_id: UUID
    buffer_code: str
    buffer_type: str
    lot_count: int
    total_quantity_kg: Decimal
