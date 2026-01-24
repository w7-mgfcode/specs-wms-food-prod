# PRP: Phase 8.3 — Inventory & Buffer System

> **Parent PRP**: phase8-unified-production-suite.md
> **Phase**: 8.3 - Inventory & Buffer System
> **Date**: 2026-01-24
> **Status**: READY FOR IMPLEMENTATION
> **Confidence Score**: 8/10

---

## Purpose

Implement buffer management and inventory tracking with:
1. Buffer table with allowed lot types and temperature constraints
2. Inventory items tracking lots in buffers
3. Stock moves with idempotency for audit trail
4. Buffer purity validation (SKW15 buffer only accepts SKW15 lots)
5. Run-scoped buffer views

---

## Prerequisites

- **Phase 8.1 Complete**: Schema alignment
- **Phase 8.2 Complete**: Production run system
- Tables exist: `lots`, `production_runs`

---

## Reference Files

```yaml
Existing Patterns:
  - backend/app/models/lot.py (model patterns)
  - backend/app/api/routes/runs.py (idempotency pattern)
  - INITIAL-11.md Section F (buffers, inventory_items, stock_moves tables)
  - INITIAL-11.md Section H.6 (buffer purity rules)
```

---

## Buffer Configuration (from INITIAL-11)

| Buffer | Buffer Type | Allowed Lot Types | Temp Range |
|--------|-------------|-------------------|------------|
| LK Buffer | LK | DEB, BULK | 1-4°C |
| MIX Buffer | MIX | MIX | 2-4°C |
| SKW15 Buffer | SKW15 | SKW15 | 2-4°C |
| SKW30 Buffer | SKW30 | SKW30 | 2-4°C |
| FRZ Buffer | FRZ | FRZ15, FRZ30 | -25 to -18°C |
| PAL Buffer | PAL | PAL | -22 to -18°C |

---

## Task List

### Task 3.1: Create Database Migration for Buffers

**File**: `backend/alembic/versions/{timestamp}_add_buffers_inventory.py`

```python
"""Add buffers, inventory_items, and stock_moves tables.

Revision ID: {auto}
Revises: {previous}
Create Date: 2026-01-24
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

revision = '{auto}'
down_revision = '{previous}'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create buffers table
    op.create_table(
        'buffers',
        sa.Column('id', sa.Uuid(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('buffer_code', sa.String(20), nullable=False),
        sa.Column('buffer_type', sa.String(20), nullable=False),
        sa.Column('allowed_lot_types', ARRAY(sa.String(10)), nullable=False),
        sa.Column('capacity_kg', sa.Numeric(10, 2), nullable=False),
        sa.Column('temp_min_c', sa.Numeric(5, 1), nullable=False),
        sa.Column('temp_max_c', sa.Numeric(5, 1), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),

        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('buffer_code', name='uq_buffers_code'),
        sa.CheckConstraint(
            "buffer_type IN ('LK','MIX','SKW15','SKW30','FRZ','PAL')",
            name='ck_buffers_type'
        ),
    )

    op.create_index('idx_buffers_type', 'buffers', ['buffer_type'])
    op.create_index('idx_buffers_active', 'buffers', ['is_active'])

    # Create inventory_items table
    op.create_table(
        'inventory_items',
        sa.Column('id', sa.Uuid(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('lot_id', sa.Uuid(), nullable=False),
        sa.Column('buffer_id', sa.Uuid(), nullable=False),
        sa.Column('run_id', sa.Uuid(), nullable=False),
        sa.Column('quantity_kg', sa.Numeric(10, 2), nullable=False),
        sa.Column('entered_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('exited_at', sa.DateTime(timezone=True), nullable=True),

        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['lot_id'], ['lots.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['buffer_id'], ['buffers.id']),
        sa.ForeignKeyConstraint(['run_id'], ['production_runs.id']),
    )

    # Partial index for active inventory (exited_at IS NULL)
    op.create_index(
        'idx_inventory_buffer_active',
        'inventory_items',
        ['buffer_id'],
        postgresql_where=sa.text('exited_at IS NULL')
    )
    op.create_index('idx_inventory_lot', 'inventory_items', ['lot_id'])
    op.create_index('idx_inventory_run', 'inventory_items', ['run_id'])

    # Create stock_moves table
    op.create_table(
        'stock_moves',
        sa.Column('id', sa.Uuid(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('lot_id', sa.Uuid(), nullable=False),
        sa.Column('from_buffer_id', sa.Uuid(), nullable=True),
        sa.Column('to_buffer_id', sa.Uuid(), nullable=True),
        sa.Column('quantity_kg', sa.Numeric(10, 2), nullable=False),
        sa.Column('move_type', sa.String(20), nullable=False),
        sa.Column('operator_id', sa.Uuid(), nullable=False),
        sa.Column('idempotency_key', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),

        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['lot_id'], ['lots.id']),
        sa.ForeignKeyConstraint(['from_buffer_id'], ['buffers.id']),
        sa.ForeignKeyConstraint(['to_buffer_id'], ['buffers.id']),
        sa.ForeignKeyConstraint(['operator_id'], ['users.id']),
        sa.UniqueConstraint('idempotency_key', name='uq_stock_moves_idempotency'),
        sa.CheckConstraint(
            "move_type IN ('RECEIVE','TRANSFER','CONSUME','SHIP')",
            name='ck_stock_moves_type'
        ),
        sa.CheckConstraint(
            "from_buffer_id IS NOT NULL OR to_buffer_id IS NOT NULL",
            name='ck_stock_moves_has_buffer'
        ),
    )

    op.create_index('idx_stock_moves_lot', 'stock_moves', ['lot_id'])
    op.create_index('idx_stock_moves_created', 'stock_moves', ['created_at'])

    # Seed default buffers
    op.execute("""
        INSERT INTO buffers (buffer_code, buffer_type, allowed_lot_types, capacity_kg, temp_min_c, temp_max_c)
        VALUES
            ('LK-001', 'LK', ARRAY['DEB', 'BULK'], 1000.00, 1.0, 4.0),
            ('MIX-001', 'MIX', ARRAY['MIX'], 500.00, 2.0, 4.0),
            ('SKW15-001', 'SKW15', ARRAY['SKW15'], 300.00, 2.0, 4.0),
            ('SKW30-001', 'SKW30', ARRAY['SKW30'], 300.00, 2.0, 4.0),
            ('FRZ-001', 'FRZ', ARRAY['FRZ15', 'FRZ30'], 800.00, -25.0, -18.0),
            ('PAL-001', 'PAL', ARRAY['PAL'], 2000.00, -22.0, -18.0)
    """)


def downgrade() -> None:
    op.drop_index('idx_stock_moves_created', 'stock_moves')
    op.drop_index('idx_stock_moves_lot', 'stock_moves')
    op.drop_table('stock_moves')

    op.drop_index('idx_inventory_run', 'inventory_items')
    op.drop_index('idx_inventory_lot', 'inventory_items')
    op.drop_index('idx_inventory_buffer_active', 'inventory_items')
    op.drop_table('inventory_items')

    op.drop_index('idx_buffers_active', 'buffers')
    op.drop_index('idx_buffers_type', 'buffers')
    op.drop_table('buffers')
```

**Validation**:
```bash
alembic upgrade head
psql -c "\d buffers"
psql -c "SELECT * FROM buffers"
```

---

### Task 3.2: Add Buffer Purity Trigger

**File**: `backend/alembic/versions/{timestamp}_add_buffer_purity_trigger.py`

```python
"""Add trigger to enforce buffer purity rules.

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
    # Create function to validate buffer lot type purity
    op.execute("""
        CREATE OR REPLACE FUNCTION validate_buffer_lot_type()
        RETURNS TRIGGER AS $$
        DECLARE
            allowed VARCHAR(10)[];
            lot_type_val VARCHAR(10);
        BEGIN
            -- Get allowed lot types for the buffer
            SELECT allowed_lot_types INTO allowed
            FROM buffers WHERE id = NEW.buffer_id;

            -- Get the lot type
            SELECT lot_type INTO lot_type_val
            FROM lots WHERE id = NEW.lot_id;

            -- Check if lot type is allowed
            IF NOT (lot_type_val = ANY(allowed)) THEN
                RAISE EXCEPTION 'Lot type % not allowed in this buffer. Allowed types: %',
                    lot_type_val, array_to_string(allowed, ', ');
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Create trigger on inventory_items
    op.execute("""
        DROP TRIGGER IF EXISTS trg_inventory_buffer_purity ON inventory_items;
        CREATE TRIGGER trg_inventory_buffer_purity
        BEFORE INSERT ON inventory_items
        FOR EACH ROW
        EXECUTE FUNCTION validate_buffer_lot_type();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_inventory_buffer_purity ON inventory_items")
    op.execute("DROP FUNCTION IF EXISTS validate_buffer_lot_type()")
```

**Validation**:
```bash
alembic upgrade head
# Test that SKW30 lot cannot go into SKW15 buffer - should fail
psql -c "
    -- This should fail with purity error
    INSERT INTO inventory_items (lot_id, buffer_id, run_id, quantity_kg)
    SELECT l.id, b.id, l.production_run_id, 10.0
    FROM lots l, buffers b
    WHERE l.lot_type = 'SKW30' AND b.buffer_type = 'SKW15'
    LIMIT 1;
" 2>&1 | grep -q "not allowed" && echo "PASS: Buffer purity enforced"
```

---

### Task 3.3: Create Inventory Models

**File**: `backend/app/models/inventory.py` (NEW)

```python
"""Inventory and buffer models."""

from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, UUID_TYPE

if TYPE_CHECKING:
    from app.models.lot import Lot
    from app.models.production import ProductionRun
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
    allowed_lot_types: Mapped[list[str]] = mapped_column(ARRAY(String(10)), nullable=False)
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
```

**Validation**:
```bash
uv run mypy app/models/inventory.py
```

---

### Task 3.4: Update Related Models with Relationships

**File**: `backend/app/models/lot.py` (UPDATE - add relationships)

```python
# Add to Lot class:

    # Inventory relationships
    inventory_items: Mapped[list["InventoryItem"]] = relationship(
        "InventoryItem", back_populates="lot"
    )
    stock_moves: Mapped[list["StockMove"]] = relationship(
        "StockMove", back_populates="lot"
    )
```

**File**: `backend/app/models/production.py` (UPDATE - add relationship)

```python
# Add to ProductionRun class:

    # Inventory relationship
    inventory_items: Mapped[list["InventoryItem"]] = relationship(
        "InventoryItem", back_populates="production_run"
    )
```

**File**: `backend/app/models/user.py` (UPDATE - add relationship)

```python
# Add to User class:

    # Stock move relationship
    stock_moves: Mapped[list["StockMove"]] = relationship(
        "StockMove", back_populates="operator"
    )
```

---

### Task 3.5: Create Pydantic Schemas for Inventory

**File**: `backend/app/schemas/inventory.py` (NEW)

```python
"""Inventory and buffer request/response schemas."""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MoveType(str, Enum):
    """Stock move types."""
    RECEIVE = "RECEIVE"
    TRANSFER = "TRANSFER"
    CONSUME = "CONSUME"
    SHIP = "SHIP"


# --- Buffer Schemas ---


class BufferResponse(BaseModel):
    """Buffer response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    buffer_code: str
    buffer_type: str
    allowed_lot_types: list[str]
    capacity_kg: Decimal
    temp_min_c: Decimal
    temp_max_c: Decimal
    is_active: bool


class BufferWithInventoryResponse(BaseModel):
    """Buffer with current inventory count."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    buffer_code: str
    buffer_type: str
    allowed_lot_types: list[str]
    capacity_kg: Decimal
    temp_min_c: Decimal
    temp_max_c: Decimal
    is_active: bool
    current_quantity_kg: Decimal = Field(default=Decimal("0"))
    item_count: int = Field(default=0)


# --- Inventory Item Schemas ---


class InventoryItemResponse(BaseModel):
    """Inventory item response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lot_id: UUID
    buffer_id: UUID
    run_id: UUID
    quantity_kg: Decimal
    entered_at: datetime
    exited_at: datetime | None = None


class InventoryItemWithLotResponse(BaseModel):
    """Inventory item with lot details."""

    id: UUID
    lot_id: UUID
    lot_code: str
    lot_type: str | None
    buffer_id: UUID
    buffer_code: str
    quantity_kg: Decimal
    temperature_c: Decimal | None = None
    entered_at: datetime


# --- Stock Move Schemas ---


class StockMoveCreate(BaseModel):
    """Create a stock move."""

    lot_id: UUID
    from_buffer_id: UUID | None = None
    to_buffer_id: UUID | None = None
    quantity_kg: Decimal = Field(..., gt=0, le=10000)
    move_type: MoveType


class StockMoveResponse(BaseModel):
    """Stock move response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lot_id: UUID
    from_buffer_id: UUID | None = None
    to_buffer_id: UUID | None = None
    quantity_kg: Decimal
    move_type: str
    operator_id: UUID
    created_at: datetime


# --- Buffer Inventory View Schemas ---


class RunBufferInventoryResponse(BaseModel):
    """Buffer inventory for a specific run."""

    buffer: BufferResponse
    items: list[InventoryItemWithLotResponse]
    total_quantity_kg: Decimal
```

**Validation**:
```bash
uv run mypy app/schemas/inventory.py
```

---

### Task 3.6: Create Buffer API Routes

**File**: `backend/app/api/routes/buffers.py` (NEW)

```python
"""Buffer management endpoints."""

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import func, select

from app.api.deps import AllAuthenticated, DBSession
from app.models.inventory import Buffer, InventoryItem
from app.models.lot import Lot
from app.rate_limit import limiter
from app.schemas.inventory import (
    BufferResponse,
    BufferWithInventoryResponse,
    InventoryItemWithLotResponse,
)

router = APIRouter(prefix="/buffers", tags=["buffers"])


@router.get("", response_model=list[BufferWithInventoryResponse])
@limiter.limit("100/minute")
async def list_buffers(
    request: Request,
    db: DBSession,
    current_user: AllAuthenticated,
    active_only: bool = True,
) -> list[BufferWithInventoryResponse]:
    """
    List all buffers with current inventory summary.

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    stmt = select(Buffer)
    if active_only:
        stmt = stmt.where(Buffer.is_active == True)
    stmt = stmt.order_by(Buffer.buffer_code)

    result = await db.execute(stmt)
    buffers = result.scalars().all()

    responses = []
    for buffer in buffers:
        # Get inventory summary
        inv_stmt = select(
            func.sum(InventoryItem.quantity_kg).label("total_qty"),
            func.count(InventoryItem.id).label("item_count"),
        ).where(
            InventoryItem.buffer_id == buffer.id,
            InventoryItem.exited_at.is_(None),
        )
        inv_result = await db.execute(inv_stmt)
        inv_row = inv_result.one()

        responses.append(BufferWithInventoryResponse(
            id=buffer.id,
            buffer_code=buffer.buffer_code,
            buffer_type=buffer.buffer_type,
            allowed_lot_types=buffer.allowed_lot_types,
            capacity_kg=buffer.capacity_kg,
            temp_min_c=buffer.temp_min_c,
            temp_max_c=buffer.temp_max_c,
            is_active=buffer.is_active,
            current_quantity_kg=inv_row.total_qty or Decimal("0"),
            item_count=inv_row.item_count or 0,
        ))

    return responses


@router.get("/{buffer_id}", response_model=BufferResponse)
@limiter.limit("100/minute")
async def get_buffer(
    request: Request,
    buffer_id: UUID,
    db: DBSession,
    current_user: AllAuthenticated,
) -> BufferResponse:
    """
    Get buffer by ID.

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    stmt = select(Buffer).where(Buffer.id == buffer_id)
    result = await db.execute(stmt)
    buffer = result.scalar_one_or_none()

    if buffer is None:
        raise HTTPException(status_code=404, detail="Buffer not found")

    return BufferResponse.model_validate(buffer)


@router.get("/{buffer_id}/inventory", response_model=list[InventoryItemWithLotResponse])
@limiter.limit("100/minute")
async def get_buffer_inventory(
    request: Request,
    buffer_id: UUID,
    db: DBSession,
    current_user: AllAuthenticated,
    include_exited: bool = False,
) -> list[InventoryItemWithLotResponse]:
    """
    Get current inventory in a buffer.

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    # Verify buffer exists
    buffer_stmt = select(Buffer).where(Buffer.id == buffer_id)
    buffer_result = await db.execute(buffer_stmt)
    buffer = buffer_result.scalar_one_or_none()

    if buffer is None:
        raise HTTPException(status_code=404, detail="Buffer not found")

    # Get inventory items with lot details
    stmt = (
        select(InventoryItem, Lot)
        .join(Lot, InventoryItem.lot_id == Lot.id)
        .where(InventoryItem.buffer_id == buffer_id)
    )

    if not include_exited:
        stmt = stmt.where(InventoryItem.exited_at.is_(None))

    stmt = stmt.order_by(InventoryItem.entered_at.desc())

    result = await db.execute(stmt)
    rows = result.all()

    return [
        InventoryItemWithLotResponse(
            id=item.id,
            lot_id=item.lot_id,
            lot_code=lot.lot_code,
            lot_type=lot.lot_type.value if lot.lot_type else None,
            buffer_id=item.buffer_id,
            buffer_code=buffer.buffer_code,
            quantity_kg=item.quantity_kg,
            temperature_c=lot.temperature_c,
            entered_at=item.entered_at,
        )
        for item, lot in rows
    ]
```

**Validation**:
```bash
uv run mypy app/api/routes/buffers.py
```

---

### Task 3.7: Create Inventory Move API Route

**File**: `backend/app/api/routes/inventory.py` (NEW)

```python
"""Inventory movement endpoints."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import CanCreateLots, DBSession
from app.models.inventory import Buffer, InventoryItem, StockMove
from app.models.lot import Lot
from app.rate_limit import limiter
from app.schemas.inventory import StockMoveCreate, StockMoveResponse

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.post("/move", response_model=StockMoveResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("100/minute")
async def create_stock_move(
    request: Request,
    data: StockMoveCreate,
    db: DBSession,
    current_user: CanCreateLots,
    idempotency_key: UUID = Header(..., alias="Idempotency-Key"),
) -> StockMoveResponse:
    """
    Create a stock movement between buffers.

    Move types:
    - RECEIVE: Into buffer (from_buffer_id is NULL)
    - TRANSFER: Between buffers (both from/to specified)
    - CONSUME: Out of buffer for processing (to_buffer_id is NULL)
    - SHIP: Out of buffer for shipment (to_buffer_id is NULL)

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 100/minute.
    Idempotency: Required header for duplicate prevention.
    """
    # Idempotency check
    existing_stmt = select(StockMove).where(StockMove.idempotency_key == idempotency_key)
    existing_result = await db.execute(existing_stmt)
    existing = existing_result.scalar_one_or_none()
    if existing:
        return StockMoveResponse.model_validate(existing)

    # Validate at least one buffer specified
    if data.from_buffer_id is None and data.to_buffer_id is None:
        raise HTTPException(
            status_code=400,
            detail="At least one of from_buffer_id or to_buffer_id must be specified"
        )

    # Validate lot exists
    lot_stmt = select(Lot).where(Lot.id == data.lot_id)
    lot_result = await db.execute(lot_stmt)
    lot = lot_result.scalar_one_or_none()

    if lot is None:
        raise HTTPException(status_code=404, detail="Lot not found")

    now = datetime.now(UTC)

    # Handle source buffer (if TRANSFER or CONSUME/SHIP)
    if data.from_buffer_id:
        # Verify buffer exists
        from_buffer_stmt = select(Buffer).where(Buffer.id == data.from_buffer_id)
        from_buffer_result = await db.execute(from_buffer_stmt)
        from_buffer = from_buffer_result.scalar_one_or_none()

        if from_buffer is None:
            raise HTTPException(status_code=404, detail="Source buffer not found")

        # Find active inventory item
        inv_stmt = select(InventoryItem).where(
            InventoryItem.lot_id == data.lot_id,
            InventoryItem.buffer_id == data.from_buffer_id,
            InventoryItem.exited_at.is_(None),
        )
        inv_result = await db.execute(inv_stmt)
        inv_item = inv_result.scalar_one_or_none()

        if inv_item is None:
            raise HTTPException(
                status_code=400,
                detail=f"Lot {lot.lot_code} not found in source buffer"
            )

        if inv_item.quantity_kg < data.quantity_kg:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient quantity. Available: {inv_item.quantity_kg} kg"
            )

        # Mark as exited
        inv_item.exited_at = now

    # Handle destination buffer (if RECEIVE or TRANSFER)
    if data.to_buffer_id:
        # Verify buffer exists
        to_buffer_stmt = select(Buffer).where(Buffer.id == data.to_buffer_id)
        to_buffer_result = await db.execute(to_buffer_stmt)
        to_buffer = to_buffer_result.scalar_one_or_none()

        if to_buffer is None:
            raise HTTPException(status_code=404, detail="Destination buffer not found")

        # Validate lot type is allowed (trigger will also check, but give better error)
        lot_type_str = lot.lot_type.value if lot.lot_type else None
        if lot_type_str and lot_type_str not in to_buffer.allowed_lot_types:
            raise HTTPException(
                status_code=400,
                detail=f"Lot type {lot_type_str} not allowed in buffer {to_buffer.buffer_code}. "
                       f"Allowed: {', '.join(to_buffer.allowed_lot_types)}"
            )

        # Create new inventory item
        new_inv = InventoryItem(
            lot_id=data.lot_id,
            buffer_id=data.to_buffer_id,
            run_id=lot.production_run_id,
            quantity_kg=data.quantity_kg,
            entered_at=now,
        )
        db.add(new_inv)

    # Create stock move record
    move = StockMove(
        lot_id=data.lot_id,
        from_buffer_id=data.from_buffer_id,
        to_buffer_id=data.to_buffer_id,
        quantity_kg=data.quantity_kg,
        move_type=data.move_type.value,
        operator_id=current_user.id,
        idempotency_key=idempotency_key,
    )
    db.add(move)

    await db.flush()
    await db.refresh(move)

    return StockMoveResponse.model_validate(move)


@router.get("/moves", response_model=list[StockMoveResponse])
@limiter.limit("100/minute")
async def list_stock_moves(
    request: Request,
    db: DBSession,
    current_user: CanCreateLots,
    lot_id: UUID | None = None,
    buffer_id: UUID | None = None,
    limit: int = 100,
) -> list[StockMoveResponse]:
    """
    List stock movements.

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 100/minute.
    """
    stmt = select(StockMove).order_by(StockMove.created_at.desc()).limit(limit)

    if lot_id:
        stmt = stmt.where(StockMove.lot_id == lot_id)

    if buffer_id:
        stmt = stmt.where(
            (StockMove.from_buffer_id == buffer_id) | (StockMove.to_buffer_id == buffer_id)
        )

    result = await db.execute(stmt)
    moves = result.scalars().all()

    return [StockMoveResponse.model_validate(m) for m in moves]
```

**Validation**:
```bash
uv run mypy app/api/routes/inventory.py
```

---

### Task 3.8: Create Run Buffers Endpoint

**File**: `backend/app/api/routes/runs.py` (UPDATE - add buffers endpoint)

```python
# Add this endpoint to runs.py

from app.models.inventory import Buffer, InventoryItem
from app.schemas.inventory import RunBufferInventoryResponse, BufferResponse, InventoryItemWithLotResponse


@router.get("/{run_id}/buffers", response_model=list[RunBufferInventoryResponse])
@limiter.limit("100/minute")
async def get_run_buffers(
    request: Request,
    run_id: UUID,
    db: DBSession,
    current_user: AllAuthenticated,
) -> list[RunBufferInventoryResponse]:
    """
    Get buffer inventory for a specific run.

    This is the "Run Buffers" view (formerly "First Flow").

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    # Verify run exists
    run_stmt = select(ProductionRun.id).where(ProductionRun.id == run_id)
    run_result = await db.execute(run_stmt)
    if run_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Production run not found")

    # Get all active buffers
    buffers_stmt = select(Buffer).where(Buffer.is_active == True).order_by(Buffer.buffer_code)
    buffers_result = await db.execute(buffers_stmt)
    buffers = buffers_result.scalars().all()

    responses = []
    for buffer in buffers:
        # Get inventory items for this run and buffer
        inv_stmt = (
            select(InventoryItem, Lot)
            .join(Lot, InventoryItem.lot_id == Lot.id)
            .where(
                InventoryItem.buffer_id == buffer.id,
                InventoryItem.run_id == run_id,
                InventoryItem.exited_at.is_(None),
            )
            .order_by(InventoryItem.entered_at.desc())
        )
        inv_result = await db.execute(inv_stmt)
        rows = inv_result.all()

        items = [
            InventoryItemWithLotResponse(
                id=item.id,
                lot_id=item.lot_id,
                lot_code=lot.lot_code,
                lot_type=lot.lot_type.value if lot.lot_type else None,
                buffer_id=item.buffer_id,
                buffer_code=buffer.buffer_code,
                quantity_kg=item.quantity_kg,
                temperature_c=lot.temperature_c,
                entered_at=item.entered_at,
            )
            for item, lot in rows
        ]

        total_qty = sum(item.quantity_kg for item in items)

        responses.append(RunBufferInventoryResponse(
            buffer=BufferResponse.model_validate(buffer),
            items=items,
            total_quantity_kg=total_qty,
        ))

    return responses
```

---

### Task 3.9: Register Routers

**File**: `backend/app/api/routes/__init__.py` (UPDATE)

```python
from fastapi import APIRouter

from app.api.routes import auth, buffers, flows, health, inventory, lots, qc, runs, traceability

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(lots.router)
api_router.include_router(qc.router)
api_router.include_router(traceability.router)
api_router.include_router(flows.router)
api_router.include_router(runs.router)
api_router.include_router(buffers.router)    # NEW
api_router.include_router(inventory.router)  # NEW
```

---

### Task 3.10: Update models/__init__.py

**File**: `backend/app/models/__init__.py` (UPDATE)

```python
from app.models.inventory import Buffer, InventoryItem, StockMove

__all__ = [
    # ... existing exports ...
    # Inventory
    "Buffer",
    "InventoryItem",
    "StockMove",
]
```

---

### Task 3.11: Create Tests

**File**: `backend/tests/test_inventory.py` (NEW)

```python
"""Tests for inventory and buffer API endpoints."""

import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import Buffer, InventoryItem
from app.models.lot import Lot, LotType


@pytest.fixture
async def test_buffer(db_session: AsyncSession):
    """Create a test buffer."""
    buffer = Buffer(
        buffer_code="TEST-001",
        buffer_type="SKW15",
        allowed_lot_types=["SKW15"],
        capacity_kg=Decimal("500.00"),
        temp_min_c=Decimal("2.0"),
        temp_max_c=Decimal("4.0"),
        is_active=True,
    )
    db_session.add(buffer)
    await db_session.flush()
    return buffer


@pytest.mark.asyncio
async def test_list_buffers(
    client: AsyncClient,
    auth_headers: dict,
):
    """Test listing buffers."""
    response = await client.get("/api/buffers", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Should have seeded buffers
    assert len(data) >= 6


@pytest.mark.asyncio
async def test_buffer_purity_enforcement(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    test_buffer: Buffer,
    test_operator_user,
):
    """Test that buffer purity is enforced."""
    # Create a SKW30 lot (wrong type for SKW15 buffer)
    lot = Lot(
        lot_code=f"SKW30-TEST-{uuid.uuid4().hex[:8]}",
        lot_type=LotType.SKW30,  # Wrong type!
        weight_kg=Decimal("10.00"),
        operator_id=test_operator_user.id,
    )
    db_session.add(lot)
    await db_session.flush()

    # Try to move into SKW15 buffer - should fail
    response = await client.post(
        "/api/inventory/move",
        json={
            "lot_id": str(lot.id),
            "to_buffer_id": str(test_buffer.id),
            "quantity_kg": "10.00",
            "move_type": "RECEIVE",
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    assert response.status_code == 400
    assert "not allowed" in response.json()["detail"]


@pytest.mark.asyncio
async def test_stock_move_idempotency(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    test_operator_user,
):
    """Test stock move idempotency."""
    # Get LK buffer (allows DEB)
    buffer_response = await client.get("/api/buffers", headers=auth_headers)
    lk_buffer = next(b for b in buffer_response.json() if b["buffer_type"] == "LK")

    # Create a DEB lot
    lot = Lot(
        lot_code=f"DEB-TEST-{uuid.uuid4().hex[:8]}",
        lot_type=LotType.DEB,
        weight_kg=Decimal("50.00"),
        operator_id=test_operator_user.id,
    )
    db_session.add(lot)
    await db_session.flush()

    idempotency_key = str(uuid.uuid4())
    headers = {**auth_headers, "Idempotency-Key": idempotency_key}

    # First move
    response1 = await client.post(
        "/api/inventory/move",
        json={
            "lot_id": str(lot.id),
            "to_buffer_id": lk_buffer["id"],
            "quantity_kg": "50.00",
            "move_type": "RECEIVE",
        },
        headers=headers,
    )

    # Duplicate move with same key
    response2 = await client.post(
        "/api/inventory/move",
        json={
            "lot_id": str(lot.id),
            "to_buffer_id": lk_buffer["id"],
            "quantity_kg": "50.00",
            "move_type": "RECEIVE",
        },
        headers=headers,
    )

    assert response1.status_code == 201
    assert response2.status_code == 201
    assert response1.json()["id"] == response2.json()["id"]
```

**Validation**:
```bash
uv run pytest tests/test_inventory.py -v
```

---

## Validation Loop

### Step 1: Run Migrations

```bash
cd backend
alembic upgrade head
```

### Step 2: Verify Schema

```bash
psql -c "\d buffers"
psql -c "\d inventory_items"
psql -c "\d stock_moves"
psql -c "SELECT * FROM buffers"
```

### Step 3: Type Check

```bash
uv run mypy app/models/inventory.py app/schemas/inventory.py app/api/routes/buffers.py app/api/routes/inventory.py
```

### Step 4: Run Tests

```bash
uv run pytest tests/test_inventory.py -v
```

### Step 5: Manual API Test

```bash
# List buffers
curl http://localhost:8000/api/buffers | jq

# Get buffer inventory
curl http://localhost:8000/api/buffers/{buffer_id}/inventory | jq

# Create stock move
curl -X POST http://localhost:8000/api/inventory/move \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"lot_id":"...","to_buffer_id":"...","quantity_kg":"10.00","move_type":"RECEIVE"}' | jq
```

---

## Final Checklist

- [ ] Migration: buffers, inventory_items, stock_moves tables
- [ ] Migration: Buffer purity trigger
- [ ] Migration: Seed default buffers
- [ ] Models: Buffer, InventoryItem, StockMove
- [ ] Models: Relationships added to Lot, ProductionRun, User
- [ ] Schemas: Buffer, InventoryItem, StockMove request/response
- [ ] Routes: GET /buffers, GET /buffers/{id}, GET /buffers/{id}/inventory
- [ ] Routes: POST /inventory/move with idempotency
- [ ] Routes: GET /runs/{id}/buffers (Run Buffers view)
- [ ] Routers registered
- [ ] Tests: Buffer listing, purity enforcement, idempotency
- [ ] All tests pass

---

## Confidence Score: 8/10

**High confidence** because:
- Clear data model from INITIAL-11
- Simple CRUD patterns
- Trigger-based validation

**Uncertainty**:
- Partial quantity moves need more testing
- Capacity warnings not yet implemented
- Temperature monitoring integration deferred
