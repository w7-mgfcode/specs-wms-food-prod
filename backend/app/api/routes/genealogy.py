"""Genealogy endpoints.

Phase 8.4: QC & Genealogy Unification.
Extended genealogy queries: 1-back, 1-forward, full tree.
"""

from enum import Enum
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import AllAuthenticated, DBSession
from app.models.lot import Lot, LotGenealogy
from app.rate_limit import limiter
from app.schemas.lot import LotResponse

router = APIRouter(prefix="/genealogy", tags=["genealogy"])


class TreeDirection(str, Enum):
    """Genealogy tree direction."""

    BACKWARD = "backward"  # Parents (upstream)
    FORWARD = "forward"    # Children (downstream)
    BOTH = "both"          # Full tree


class GenealogyLink(BaseModel):
    """A link in the genealogy tree."""

    model_config = ConfigDict(from_attributes=True)

    parent_lot_id: UUID | None
    child_lot_id: UUID | None
    quantity_used_kg: float | None


class GenealogyTreeResponse(BaseModel):
    """Genealogy tree response."""

    lot: LotResponse
    direction: TreeDirection
    depth: int
    nodes: list[LotResponse]
    links: list[GenealogyLink]


@router.get(
    "/{lot_id}/parents",
    response_model=GenealogyTreeResponse,
)
@limiter.limit("50/minute")
async def get_parent_lots(
    request: Request,
    lot_id: UUID,
    db: DBSession,
    current_user: AllAuthenticated,
    depth: int = 1,
) -> GenealogyTreeResponse:
    """
    Get parent lots (1-back or more) for a lot.

    Requires: Any authenticated user.
    Rate limit: 50/minute (recursive queries).

    Query parameters:
        - depth: How many levels back to trace (default 1, max 10)

    Returns the lot, its parent lots up to the specified depth,
    and the genealogy links between them.
    """
    if depth < 1 or depth > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Depth must be between 1 and 10",
        )

    # Get the central lot
    result = await db.execute(select(Lot).where(Lot.id == lot_id))
    central_lot = result.scalar_one_or_none()

    if not central_lot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lot {lot_id} not found",
        )

    # Collect parents recursively
    nodes: list[Lot] = []
    links: list[LotGenealogy] = []
    current_ids = {lot_id}

    for _ in range(depth):
        if not current_ids:
            break

        # Get genealogy links where child_lot_id is in current_ids
        link_result = await db.execute(
            select(LotGenealogy)
            .where(LotGenealogy.child_lot_id.in_(current_ids))
            .options(selectinload(LotGenealogy.parent))
        )
        level_links = link_result.scalars().all()

        if not level_links:
            break

        links.extend(level_links)
        parent_ids = set()

        for link in level_links:
            if link.parent and link.parent not in nodes:
                nodes.append(link.parent)
                parent_ids.add(link.parent_lot_id)

        current_ids = parent_ids

    return GenealogyTreeResponse(
        lot=LotResponse.model_validate(central_lot),
        direction=TreeDirection.BACKWARD,
        depth=depth,
        nodes=[LotResponse.model_validate(n) for n in nodes],
        links=[GenealogyLink.model_validate(link) for link in links],
    )


@router.get(
    "/{lot_id}/children",
    response_model=GenealogyTreeResponse,
)
@limiter.limit("50/minute")
async def get_child_lots(
    request: Request,
    lot_id: UUID,
    db: DBSession,
    current_user: AllAuthenticated,
    depth: int = 1,
) -> GenealogyTreeResponse:
    """
    Get child lots (1-forward or more) for a lot.

    Requires: Any authenticated user.
    Rate limit: 50/minute (recursive queries).

    Query parameters:
        - depth: How many levels forward to trace (default 1, max 10)

    Returns the lot, its child lots up to the specified depth,
    and the genealogy links between them.
    """
    if depth < 1 or depth > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Depth must be between 1 and 10",
        )

    # Get the central lot
    result = await db.execute(select(Lot).where(Lot.id == lot_id))
    central_lot = result.scalar_one_or_none()

    if not central_lot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lot {lot_id} not found",
        )

    # Collect children recursively
    nodes: list[Lot] = []
    links: list[LotGenealogy] = []
    current_ids = {lot_id}

    for _ in range(depth):
        if not current_ids:
            break

        # Get genealogy links where parent_lot_id is in current_ids
        link_result = await db.execute(
            select(LotGenealogy)
            .where(LotGenealogy.parent_lot_id.in_(current_ids))
            .options(selectinload(LotGenealogy.child))
        )
        level_links = link_result.scalars().all()

        if not level_links:
            break

        links.extend(level_links)
        child_ids = set()

        for link in level_links:
            if link.child and link.child not in nodes:
                nodes.append(link.child)
                child_ids.add(link.child_lot_id)

        current_ids = child_ids

    return GenealogyTreeResponse(
        lot=LotResponse.model_validate(central_lot),
        direction=TreeDirection.FORWARD,
        depth=depth,
        nodes=[LotResponse.model_validate(n) for n in nodes],
        links=[GenealogyLink.model_validate(link) for link in links],
    )


@router.get(
    "/{lot_id}/tree",
    response_model=GenealogyTreeResponse,
)
@limiter.limit("30/minute")
async def get_full_genealogy_tree(
    request: Request,
    lot_id: UUID,
    db: DBSession,
    current_user: AllAuthenticated,
    depth: int = 3,
) -> GenealogyTreeResponse:
    """
    Get full genealogy tree (both parents and children) for a lot.

    Requires: Any authenticated user.
    Rate limit: 30/minute (expensive recursive queries).

    Query parameters:
        - depth: How many levels in each direction (default 3, max 5)

    Returns the lot, all related lots up to the specified depth
    in both directions, and all genealogy links between them.
    """
    if depth < 1 or depth > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Depth must be between 1 and 5 for full tree queries",
        )

    # Get the central lot
    result = await db.execute(select(Lot).where(Lot.id == lot_id))
    central_lot = result.scalar_one_or_none()

    if not central_lot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lot {lot_id} not found",
        )

    all_nodes: dict[UUID, Lot] = {}
    all_links: list[LotGenealogy] = []

    # Trace backward (parents)
    current_ids = {lot_id}
    for _ in range(depth):
        if not current_ids:
            break

        link_result = await db.execute(
            select(LotGenealogy)
            .where(LotGenealogy.child_lot_id.in_(current_ids))
            .options(selectinload(LotGenealogy.parent))
        )
        level_links = link_result.scalars().all()

        if not level_links:
            break

        all_links.extend(level_links)
        parent_ids = set()

        for link in level_links:
            if link.parent and link.parent_lot_id not in all_nodes:
                all_nodes[link.parent_lot_id] = link.parent
                parent_ids.add(link.parent_lot_id)

        current_ids = parent_ids

    # Trace forward (children)
    current_ids = {lot_id}
    for _ in range(depth):
        if not current_ids:
            break

        link_result = await db.execute(
            select(LotGenealogy)
            .where(LotGenealogy.parent_lot_id.in_(current_ids))
            .options(selectinload(LotGenealogy.child))
        )
        level_links = link_result.scalars().all()

        if not level_links:
            break

        # Avoid duplicate links
        for link in level_links:
            if link not in all_links:
                all_links.append(link)

        child_ids = set()
        for link in level_links:
            if link.child and link.child_lot_id not in all_nodes:
                all_nodes[link.child_lot_id] = link.child
                child_ids.add(link.child_lot_id)

        current_ids = child_ids

    return GenealogyTreeResponse(
        lot=LotResponse.model_validate(central_lot),
        direction=TreeDirection.BOTH,
        depth=depth,
        nodes=[LotResponse.model_validate(n) for n in all_nodes.values()],
        links=[GenealogyLink.model_validate(link) for link in all_links],
    )
