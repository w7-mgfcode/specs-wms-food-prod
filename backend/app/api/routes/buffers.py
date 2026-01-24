"""Buffer management endpoints.

Phase 8.3: Buffer storage location management.
"""

from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import func, select

from app.api.deps import AllAuthenticated, CanCreateRuns, DBSession
from app.models.inventory import Buffer, InventoryItem
from app.rate_limit import limiter
from app.schemas.inventory import (
    BufferCreate,
    BufferListItem,
    BufferResponse,
    BufferSummary,
    BufferUpdate,
)

router = APIRouter(prefix="/buffers", tags=["buffers"])


# --- Idempotency Key Dependency ---


def get_idempotency_key(
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
) -> UUID:
    """Extract idempotency key from header."""
    return idempotency_key


IdempotencyKey = Annotated[UUID, Depends(get_idempotency_key)]


# --- List/Get Endpoints ---


@router.get("", response_model=list[BufferListItem])
@limiter.limit("100/minute")
async def list_buffers(
    request: Request,
    db: DBSession,
    current_user: AllAuthenticated,
    buffer_type: str | None = None,
    is_active: bool | None = None,
) -> list[BufferListItem]:
    """
    List all buffers.

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    stmt = select(Buffer).order_by(Buffer.buffer_code)

    if buffer_type:
        stmt = stmt.where(Buffer.buffer_type == buffer_type)

    if is_active is not None:
        stmt = stmt.where(Buffer.is_active == is_active)

    result = await db.execute(stmt)
    buffers = result.scalars().all()

    return [BufferListItem.model_validate(b) for b in buffers]


@router.get("/summary", response_model=list[BufferSummary])
@limiter.limit("60/minute")
async def get_buffer_summaries(
    request: Request,
    db: DBSession,
    current_user: AllAuthenticated,
    buffer_type: str | None = None,
) -> list[BufferSummary]:
    """
    Get buffer summaries with current inventory levels.

    Requires: Any authenticated user.
    Rate limit: 60/minute.
    """
    # Build buffer query
    buffer_stmt = select(Buffer).where(Buffer.is_active.is_(True))
    if buffer_type:
        buffer_stmt = buffer_stmt.where(Buffer.buffer_type == buffer_type)

    buffer_result = await db.execute(buffer_stmt)
    buffers = buffer_result.scalars().all()

    summaries = []
    for buffer in buffers:
        # Get current inventory (active items where exited_at is NULL)
        inv_stmt = (
            select(
                func.coalesce(func.sum(InventoryItem.quantity_kg), Decimal("0")),
                func.count(InventoryItem.id),
            )
            .where(InventoryItem.buffer_id == buffer.id)
            .where(InventoryItem.exited_at.is_(None))
        )
        inv_result = await db.execute(inv_stmt)
        total_qty, item_count = inv_result.one()

        summaries.append(
            BufferSummary(
                buffer=BufferResponse.model_validate(buffer),
                current_quantity_kg=total_qty,
                item_count=item_count,
            )
        )

    return summaries


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


# --- Create/Update Endpoints ---


@router.post("", response_model=BufferResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def create_buffer(
    request: Request,
    data: BufferCreate,
    db: DBSession,
    current_user: CanCreateRuns,
) -> BufferResponse:
    """
    Create a new buffer.

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 20/minute.
    """
    # Check for duplicate buffer_code
    existing_stmt = select(Buffer).where(Buffer.buffer_code == data.buffer_code)
    existing_result = await db.execute(existing_stmt)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Buffer with code '{data.buffer_code}' already exists",
        )

    # Validate temperature range
    if data.temp_min_c >= data.temp_max_c:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minimum temperature must be less than maximum temperature",
        )

    buffer = Buffer(
        buffer_code=data.buffer_code,
        buffer_type=data.buffer_type,
        allowed_lot_types=data.allowed_lot_types,
        capacity_kg=data.capacity_kg,
        temp_min_c=data.temp_min_c,
        temp_max_c=data.temp_max_c,
    )
    db.add(buffer)
    await db.flush()
    await db.refresh(buffer)

    return BufferResponse.model_validate(buffer)


@router.patch("/{buffer_id}", response_model=BufferResponse)
@limiter.limit("30/minute")
async def update_buffer(
    request: Request,
    buffer_id: UUID,
    data: BufferUpdate,
    db: DBSession,
    current_user: CanCreateRuns,
) -> BufferResponse:
    """
    Update buffer settings.

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 30/minute.
    """
    stmt = select(Buffer).where(Buffer.id == buffer_id)
    result = await db.execute(stmt)
    buffer = result.scalar_one_or_none()

    if buffer is None:
        raise HTTPException(status_code=404, detail="Buffer not found")

    # Apply updates
    if data.capacity_kg is not None:
        buffer.capacity_kg = data.capacity_kg

    if data.temp_min_c is not None:
        buffer.temp_min_c = data.temp_min_c

    if data.temp_max_c is not None:
        buffer.temp_max_c = data.temp_max_c

    if data.is_active is not None:
        buffer.is_active = data.is_active

    # Validate temperature range
    if buffer.temp_min_c >= buffer.temp_max_c:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minimum temperature must be less than maximum temperature",
        )

    await db.flush()
    await db.refresh(buffer)

    return BufferResponse.model_validate(buffer)
