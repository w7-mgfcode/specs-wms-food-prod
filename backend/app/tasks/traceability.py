"""Background tasks for traceability calculations."""

import asyncio
from collections import deque
from typing import Any, Literal
from uuid import UUID

from app.tasks import celery_app


@celery_app.task(bind=True, name="calculate_deep_genealogy")
def calculate_deep_genealogy(self, lot_id: str) -> dict[str, Any]:
    """
    Calculate deep lot genealogy (multi-level parent/child traversal).

    This is a background task for computing complex traceability graphs
    that would be too slow to do in real-time.

    Args:
        lot_id: UUID of the lot to calculate genealogy for

    Returns:
        Dict with genealogy data and metadata
    """
    # Run async code in sync context (Celery doesn't support async tasks directly)
    return asyncio.run(_calculate_deep_genealogy_async(lot_id))


async def _calculate_deep_genealogy_async(lot_id: str) -> dict[str, Any]:
    """Async implementation of deep genealogy calculation."""
    from sqlalchemy import select

    from app.cache import get_traceability_cache_key, set_cache
    from app.database import async_session_maker
    from app.models.lot import Lot, LotGenealogy

    # Parse lot_id to UUID once at entry point
    try:
        lot_uuid = UUID(lot_id)
    except (TypeError, ValueError):
        return {"error": "Invalid lot_id format", "lot_id": lot_id}

    async with async_session_maker() as db:
        # Get the central lot
        stmt = select(Lot).where(Lot.id == lot_uuid)
        result = await db.execute(stmt)
        lot = result.scalar_one_or_none()

        if lot is None:
            return {"error": "Lot not found", "lot_id": lot_id}

        # Calculate full genealogy tree (recursive)
        ancestors = await _get_all_ancestors(db, lot_uuid, max_depth=10)
        descendants = await _get_all_descendants(db, lot_uuid, max_depth=10)

        genealogy_data = {
            "lot_id": str(lot_id),
            "lot_code": lot.lot_code,
            "ancestors": ancestors,
            "descendants": descendants,
            "ancestor_count": len(ancestors),
            "descendant_count": len(descendants),
        }

        # Cache the result
        cache_key = get_traceability_cache_key(lot.lot_code)
        await set_cache(cache_key, genealogy_data, ttl_seconds=300)

        return genealogy_data


async def _traverse_genealogy(
    db,
    root_lot_id: UUID,
    *,
    max_depth: int,
    direction: Literal["ancestors", "descendants"],
) -> list[dict]:
    """
    Traverse lot genealogy tree using BFS.

    This is a shared helper for both ancestor and descendant traversal,
    parameterized by direction to avoid code duplication.

    Args:
        db: Database session
        root_lot_id: Starting lot UUID (typed as UUID, not str)
        max_depth: Maximum traversal depth
        direction: "ancestors" to find parents, "descendants" to find children

    Returns:
        List of related lots with metadata
    """
    from sqlalchemy import select

    from app.models.lot import Lot, LotGenealogy

    results: list[dict] = []
    visited: set[UUID] = set()
    queue: deque[tuple[UUID, int]] = deque([(root_lot_id, 0)])

    while queue:
        current_id, depth = queue.popleft()

        if depth >= max_depth or current_id in visited:
            continue

        visited.add(current_id)

        # Build query based on direction
        if direction == "ancestors":
            # Get parents of current lot
            stmt = (
                select(Lot, LotGenealogy.quantity_used_kg)
                .join(LotGenealogy, LotGenealogy.parent_lot_id == Lot.id)
                .where(LotGenealogy.child_lot_id == current_id)
            )
        else:  # descendants
            # Get children of current lot
            stmt = (
                select(Lot, LotGenealogy.quantity_used_kg)
                .join(LotGenealogy, LotGenealogy.child_lot_id == Lot.id)
                .where(LotGenealogy.parent_lot_id == current_id)
            )

        result = await db.execute(stmt)

        for related_lot, quantity in result.all():
            if related_lot.id not in visited:
                results.append({
                    "id": str(related_lot.id),
                    "lot_code": related_lot.lot_code,
                    "lot_type": (
                        related_lot.lot_type.value if related_lot.lot_type else None
                    ),
                    "weight_kg": (
                        float(related_lot.weight_kg) if related_lot.weight_kg else None
                    ),
                    "quantity_used_kg": float(quantity) if quantity else None,
                    "depth": depth + 1,
                })
                queue.append((related_lot.id, depth + 1))

    return results


async def _get_all_ancestors(db, lot_id: UUID, max_depth: int = 10) -> list[dict]:
    """Recursively get all ancestor lots up to max_depth."""
    return await _traverse_genealogy(
        db,
        root_lot_id=lot_id,
        max_depth=max_depth,
        direction="ancestors",
    )


async def _get_all_descendants(db, lot_id: UUID, max_depth: int = 10) -> list[dict]:
    """Recursively get all descendant lots up to max_depth."""
    return await _traverse_genealogy(
        db,
        root_lot_id=lot_id,
        max_depth=max_depth,
        direction="descendants",
    )


@celery_app.task(name="invalidate_lot_cache")
def invalidate_lot_cache(lot_code: str) -> dict[str, str]:
    """Invalidate cache for a specific lot."""
    from app.cache import delete_cache, get_traceability_cache_key

    cache_key = get_traceability_cache_key(lot_code)
    asyncio.run(delete_cache(cache_key))

    return {"status": "invalidated", "lot_code": lot_code}
