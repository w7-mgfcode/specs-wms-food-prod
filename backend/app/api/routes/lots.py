"""Lot management endpoints."""

from fastapi import APIRouter, status

from app.api.deps import DBSession
from app.models.lot import Lot
from app.schemas.lot import LotCreate, LotResponse

router = APIRouter(tags=["lots"])


@router.post("/lots", response_model=LotResponse, status_code=status.HTTP_201_CREATED)
async def create_lot(
    lot_data: LotCreate,
    db: DBSession,
) -> LotResponse:
    """
    Create a new lot - matches Node/Express behavior.

    Node/Express uses dynamic field insertion from request body.
    We use structured Pydantic validation but maintain response parity.

    Response: Returns the created lot with all fields.
    """
    # Create lot instance from validated data
    lot = Lot(
        lot_code=lot_data.lot_code,
        lot_type=lot_data.lot_type,
        production_run_id=lot_data.production_run_id,
        phase_id=lot_data.phase_id,
        operator_id=lot_data.operator_id,
        weight_kg=lot_data.weight_kg,
        temperature_c=lot_data.temperature_c,
        metadata=lot_data.metadata or {},
    )

    db.add(lot)
    await db.flush()  # Get the generated ID
    await db.refresh(lot)  # Refresh to get all default values

    return LotResponse.model_validate(lot)
