"""Lot management endpoints."""

from fastapi import APIRouter, Request, status
from sqlalchemy import select

from app.api.deps import AllAuthenticated, CanCreateLots, DBSession
from app.models.lot import Lot
from app.rate_limit import limiter
from app.schemas.lot import LotCreate, LotResponse

router = APIRouter(tags=["lots"])


@router.get("/lots", response_model=list[LotResponse])
@limiter.limit("200/minute")
async def list_lots(
    request: Request,
    db: DBSession,
    current_user: AllAuthenticated,
) -> list[LotResponse]:
    """
    List all lots.

    Requires: Any authenticated user (ADMIN, MANAGER, AUDITOR, OPERATOR, VIEWER).
    Rate limit: 200/minute.
    """
    stmt = select(Lot).order_by(Lot.created_at.desc()).limit(100)
    result = await db.execute(stmt)
    lots = result.scalars().all()

    return [LotResponse.model_validate(lot) for lot in lots]


@router.post("/lots", response_model=LotResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("100/minute")
async def create_lot(
    request: Request,
    lot_data: LotCreate,
    db: DBSession,
    current_user: CanCreateLots,
) -> LotResponse:
    """
    Create a new lot - matches Node/Express behavior.

    Node/Express uses dynamic field insertion from request body.
    We use structured Pydantic validation but maintain response parity.

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 100/minute (normal factory throughput).

    Response: Returns the created lot with all fields.
    """
    # Create lot instance from validated data
    # Use authenticated user as operator if not explicitly provided
    lot = Lot(
        lot_code=lot_data.lot_code,
        lot_type=lot_data.lot_type,
        production_run_id=lot_data.production_run_id,
        phase_id=lot_data.phase_id,
        operator_id=lot_data.operator_id or current_user.id,
        weight_kg=lot_data.weight_kg,
        temperature_c=lot_data.temperature_c,
        metadata_=lot_data.metadata or {},
    )

    db.add(lot)
    await db.flush()  # Get the generated ID
    await db.refresh(lot)  # Refresh to get all default values

    return LotResponse.model_validate(lot)
