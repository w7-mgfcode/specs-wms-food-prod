"""Inventory management endpoints.

Phase 8.3: Stock movements and inventory tracking.
"""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import AllAuthenticated, CanCreateRuns, DBSession
from app.models.inventory import Buffer, InventoryItem, StockMove
from app.models.lot import Lot
from app.models.production import ProductionRun
from app.rate_limit import limiter
from app.schemas.inventory import (
    ConsumeRequest,
    InventoryItemResponse,
    ReceiveRequest,
    StockMoveResponse,
    TransferRequest,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])


# --- Idempotency Key Dependency ---


def get_idempotency_key(
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
) -> UUID:
    """Extract idempotency key from header."""
    return idempotency_key


IdempotencyKey = Annotated[UUID, Depends(get_idempotency_key)]


# --- Helper Functions ---


async def validate_buffer_lot_type(db: DBSession, buffer_id: UUID, lot_id: UUID) -> None:
    """Validate that lot type is allowed in buffer."""
    buffer_stmt = select(Buffer).where(Buffer.id == buffer_id)
    buffer_result = await db.execute(buffer_stmt)
    buffer = buffer_result.scalar_one_or_none()

    if buffer is None:
        raise HTTPException(status_code=404, detail="Buffer not found")

    if not buffer.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Buffer is not active",
        )

    lot_stmt = select(Lot).where(Lot.id == lot_id)
    lot_result = await db.execute(lot_stmt)
    lot = lot_result.scalar_one_or_none()

    if lot is None:
        raise HTTPException(status_code=404, detail="Lot not found")

    if lot.lot_type and lot.lot_type.value not in buffer.allowed_lot_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lot type {lot.lot_type.value} not allowed in this buffer. "
            f"Allowed types: {', '.join(buffer.allowed_lot_types)}",
        )


async def check_idempotency(db: DBSession, idempotency_key: UUID) -> StockMove | None:
    """Check if operation with this idempotency key already exists."""
    stmt = select(StockMove).where(StockMove.idempotency_key == idempotency_key)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


# --- List/Get Endpoints ---


@router.get("", response_model=list[InventoryItemResponse])
@limiter.limit("100/minute")
async def list_inventory(
    request: Request,
    db: DBSession,
    current_user: AllAuthenticated,
    buffer_id: UUID | None = None,
    lot_id: UUID | None = None,
    active_only: bool = True,
) -> list[InventoryItemResponse]:
    """
    List inventory items.

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    stmt = select(InventoryItem).order_by(InventoryItem.entered_at.desc())

    if buffer_id:
        stmt = stmt.where(InventoryItem.buffer_id == buffer_id)

    if lot_id:
        stmt = stmt.where(InventoryItem.lot_id == lot_id)

    if active_only:
        stmt = stmt.where(InventoryItem.exited_at.is_(None))

    result = await db.execute(stmt)
    items = result.scalars().all()

    return [InventoryItemResponse.model_validate(i) for i in items]


@router.get("/moves", response_model=list[StockMoveResponse])
@limiter.limit("100/minute")
async def list_stock_moves(
    request: Request,
    db: DBSession,
    current_user: AllAuthenticated,
    lot_id: UUID | None = None,
    buffer_id: UUID | None = None,
    move_type: str | None = None,
    limit: int = 100,
) -> list[StockMoveResponse]:
    """
    List stock movements.

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    stmt = (
        select(StockMove)
        .order_by(StockMove.created_at.desc())
        .limit(min(limit, 500))
    )

    if lot_id:
        stmt = stmt.where(StockMove.lot_id == lot_id)

    if buffer_id:
        stmt = stmt.where(
            (StockMove.from_buffer_id == buffer_id)
            | (StockMove.to_buffer_id == buffer_id)
        )

    if move_type:
        stmt = stmt.where(StockMove.move_type == move_type)

    result = await db.execute(stmt)
    moves = result.scalars().all()

    return [StockMoveResponse.model_validate(m) for m in moves]


# --- Stock Movement Endpoints ---


@router.post("/receive", response_model=StockMoveResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("50/minute")
async def receive_to_buffer(
    request: Request,
    data: ReceiveRequest,
    db: DBSession,
    current_user: CanCreateRuns,
    idempotency_key: IdempotencyKey,
) -> StockMoveResponse:
    """
    Receive lot into buffer.

    Creates inventory item and stock move record.

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 50/minute.
    Idempotency: Required header.
    """
    # Idempotency check
    existing = await check_idempotency(db, idempotency_key)
    if existing:
        return StockMoveResponse.model_validate(existing)

    # Validate buffer accepts this lot type
    await validate_buffer_lot_type(db, data.buffer_id, data.lot_id)

    # Validate production run exists
    run_stmt = select(ProductionRun).where(ProductionRun.id == data.run_id)
    run_result = await db.execute(run_stmt)
    if run_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Production run not found")

    now = datetime.now(UTC)

    # Create inventory item
    inventory_item = InventoryItem(
        lot_id=data.lot_id,
        buffer_id=data.buffer_id,
        run_id=data.run_id,
        quantity_kg=data.quantity_kg,
        entered_at=now,
    )
    db.add(inventory_item)

    # Create stock move record
    stock_move = StockMove(
        lot_id=data.lot_id,
        to_buffer_id=data.buffer_id,
        quantity_kg=data.quantity_kg,
        move_type="RECEIVE",
        operator_id=current_user.id,
        idempotency_key=idempotency_key,
        created_at=now,
    )
    db.add(stock_move)

    await db.flush()
    await db.refresh(stock_move)

    return StockMoveResponse.model_validate(stock_move)


@router.post("/transfer", response_model=StockMoveResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("50/minute")
async def transfer_between_buffers(
    request: Request,
    data: TransferRequest,
    db: DBSession,
    current_user: CanCreateRuns,
    idempotency_key: IdempotencyKey,
) -> StockMoveResponse:
    """
    Transfer lot between buffers.

    Exits from source buffer and receives into target buffer.

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 50/minute.
    Idempotency: Required header.
    """
    # Idempotency check
    existing = await check_idempotency(db, idempotency_key)
    if existing:
        return StockMoveResponse.model_validate(existing)

    # Validate target buffer accepts this lot type
    await validate_buffer_lot_type(db, data.to_buffer_id, data.lot_id)

    # Find active inventory in source buffer
    inv_stmt = (
        select(InventoryItem)
        .where(InventoryItem.lot_id == data.lot_id)
        .where(InventoryItem.buffer_id == data.from_buffer_id)
        .where(InventoryItem.exited_at.is_(None))
    )
    inv_result = await db.execute(inv_stmt)
    source_item = inv_result.scalar_one_or_none()

    if source_item is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lot not found in source buffer",
        )

    if source_item.quantity_kg < data.quantity_kg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient quantity. Available: {source_item.quantity_kg} kg",
        )

    now = datetime.now(UTC)

    # Handle partial or full transfer
    if source_item.quantity_kg == data.quantity_kg:
        # Full transfer - exit source item
        source_item.exited_at = now
    else:
        # Partial transfer - reduce source quantity
        source_item.quantity_kg -= data.quantity_kg

    # Create new inventory item in target buffer
    new_item = InventoryItem(
        lot_id=data.lot_id,
        buffer_id=data.to_buffer_id,
        run_id=source_item.run_id,
        quantity_kg=data.quantity_kg,
        entered_at=now,
    )
    db.add(new_item)

    # Create stock move record
    stock_move = StockMove(
        lot_id=data.lot_id,
        from_buffer_id=data.from_buffer_id,
        to_buffer_id=data.to_buffer_id,
        quantity_kg=data.quantity_kg,
        move_type="TRANSFER",
        operator_id=current_user.id,
        idempotency_key=idempotency_key,
        created_at=now,
    )
    db.add(stock_move)

    await db.flush()
    await db.refresh(stock_move)

    return StockMoveResponse.model_validate(stock_move)


@router.post("/consume", response_model=StockMoveResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("50/minute")
async def consume_from_buffer(
    request: Request,
    data: ConsumeRequest,
    db: DBSession,
    current_user: CanCreateRuns,
    idempotency_key: IdempotencyKey,
) -> StockMoveResponse:
    """
    Consume lot from buffer (e.g., for production use).

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 50/minute.
    Idempotency: Required header.
    """
    # Idempotency check
    existing = await check_idempotency(db, idempotency_key)
    if existing:
        return StockMoveResponse.model_validate(existing)

    # Find active inventory in buffer
    inv_stmt = (
        select(InventoryItem)
        .where(InventoryItem.lot_id == data.lot_id)
        .where(InventoryItem.buffer_id == data.buffer_id)
        .where(InventoryItem.exited_at.is_(None))
    )
    inv_result = await db.execute(inv_stmt)
    item = inv_result.scalar_one_or_none()

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lot not found in buffer",
        )

    if item.quantity_kg < data.quantity_kg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient quantity. Available: {item.quantity_kg} kg",
        )

    now = datetime.now(UTC)

    # Handle partial or full consumption
    if item.quantity_kg == data.quantity_kg:
        # Full consumption - exit item
        item.exited_at = now
    else:
        # Partial consumption - reduce quantity
        item.quantity_kg -= data.quantity_kg

    # Create stock move record
    stock_move = StockMove(
        lot_id=data.lot_id,
        from_buffer_id=data.buffer_id,
        quantity_kg=data.quantity_kg,
        move_type="CONSUME",
        operator_id=current_user.id,
        idempotency_key=idempotency_key,
        created_at=now,
    )
    db.add(stock_move)

    await db.flush()
    await db.refresh(stock_move)

    return StockMoveResponse.model_validate(stock_move)


@router.post("/ship", response_model=StockMoveResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def ship_from_buffer(
    request: Request,
    data: ConsumeRequest,  # Reuse ConsumeRequest - same fields needed
    db: DBSession,
    current_user: CanCreateRuns,
    idempotency_key: IdempotencyKey,
) -> StockMoveResponse:
    """
    Ship lot from buffer (final dispatch).

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 30/minute.
    Idempotency: Required header.
    """
    # Idempotency check
    existing = await check_idempotency(db, idempotency_key)
    if existing:
        return StockMoveResponse.model_validate(existing)

    # Find active inventory in buffer
    inv_stmt = (
        select(InventoryItem)
        .where(InventoryItem.lot_id == data.lot_id)
        .where(InventoryItem.buffer_id == data.buffer_id)
        .where(InventoryItem.exited_at.is_(None))
    )
    inv_result = await db.execute(inv_stmt)
    item = inv_result.scalar_one_or_none()

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lot not found in buffer",
        )

    if item.quantity_kg < data.quantity_kg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient quantity. Available: {item.quantity_kg} kg",
        )

    now = datetime.now(UTC)

    # Handle partial or full shipment
    if item.quantity_kg == data.quantity_kg:
        # Full shipment - exit item
        item.exited_at = now
    else:
        # Partial shipment - reduce quantity
        item.quantity_kg -= data.quantity_kg

    # Create stock move record
    stock_move = StockMove(
        lot_id=data.lot_id,
        from_buffer_id=data.buffer_id,
        quantity_kg=data.quantity_kg,
        move_type="SHIP",
        operator_id=current_user.id,
        idempotency_key=idempotency_key,
        created_at=now,
    )
    db.add(stock_move)

    await db.flush()
    await db.refresh(stock_move)

    return StockMoveResponse.model_validate(stock_move)
