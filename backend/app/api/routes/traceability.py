"""Traceability endpoints."""

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import AllAuthenticated, DBSession
from app.models.lot import Lot, LotGenealogy
from app.rate_limit import limiter
from app.schemas.lot import LotResponse
from app.schemas.traceability import TraceabilityResponse

router = APIRouter(tags=["traceability"])


@router.get("/traceability/{lot_code}", response_model=TraceabilityResponse)
@limiter.limit("50/minute")
async def get_traceability(
    request: Request,
    lot_code: str,
    db: DBSession,
    current_user: AllAuthenticated,
) -> TraceabilityResponse:
    """
    Get lot traceability graph - matches Node/Express behavior.

    Requires: Any authenticated user (ADMIN, MANAGER, AUDITOR, OPERATOR, VIEWER).
    All roles can access traceability for compliance requirements.
    Rate limit: 50/minute (expensive recursive queries).

    Response shape matches Node/Express exactly:
    {
        "central": {...lot fields...},
        "parents": [...parent lots...],
        "children": [...child lots...]
    }
    """
    # 1. Get central lot
    stmt = select(Lot).where(Lot.lot_code == lot_code)
    result = await db.execute(stmt)
    central_lot = result.scalar_one_or_none()

    if central_lot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lot not found",
        )

    # 2. Get parents (upstream) - lots that are parents of this lot
    parents_stmt = (
        select(Lot)
        .join(LotGenealogy, LotGenealogy.parent_lot_id == Lot.id)
        .where(LotGenealogy.child_lot_id == central_lot.id)
    )
    parents_result = await db.execute(parents_stmt)
    parents = parents_result.scalars().all()

    # 3. Get children (downstream) - lots that are children of this lot
    children_stmt = (
        select(Lot)
        .join(LotGenealogy, LotGenealogy.child_lot_id == Lot.id)
        .where(LotGenealogy.parent_lot_id == central_lot.id)
    )
    children_result = await db.execute(children_stmt)
    children = children_result.scalars().all()

    return TraceabilityResponse(
        central=LotResponse.model_validate(central_lot),
        parents=[LotResponse.model_validate(p) for p in parents],
        children=[LotResponse.model_validate(c) for c in children],
    )
