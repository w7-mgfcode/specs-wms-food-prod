"""Background tasks for traceability calculations."""

import asyncio
import json
from typing import Any

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

    async with async_session_maker() as db:
        # Get the central lot
        stmt = select(Lot).where(Lot.id == lot_id)
        result = await db.execute(stmt)
        lot = result.scalar_one_or_none()

        if lot is None:
            return {"error": "Lot not found", "lot_id": lot_id}

        # Calculate full genealogy tree (recursive)
        ancestors = await _get_all_ancestors(db, lot_id, max_depth=10)
        descendants = await _get_all_descendants(db, lot_id, max_depth=10)

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


async def _get_all_ancestors(db, lot_id: str, max_depth: int = 10) -> list[dict]:
    """Recursively get all ancestor lots up to max_depth."""
    from sqlalchemy import select

    from app.models.lot import Lot, LotGenealogy

    ancestors = []
    visited = set()
    queue = [(lot_id, 0)]  # (lot_id, depth)

    while queue:
        current_id, depth = queue.pop(0)

        if depth >= max_depth or current_id in visited:
            continue

        visited.add(current_id)

        # Get parents of current lot
        stmt = (
            select(Lot, LotGenealogy.quantity_used_kg)
            .join(LotGenealogy, LotGenealogy.parent_lot_id == Lot.id)
            .where(LotGenealogy.child_lot_id == current_id)
        )
        result = await db.execute(stmt)

        for parent, quantity in result.all():
            if parent.id not in visited:
                ancestors.append({
                    "id": str(parent.id),
                    "lot_code": parent.lot_code,
                    "lot_type": parent.lot_type.value if parent.lot_type else None,
                    "weight_kg": float(parent.weight_kg) if parent.weight_kg else None,
                    "quantity_used_kg": float(quantity) if quantity else None,
                    "depth": depth + 1,
                })
                queue.append((parent.id, depth + 1))

    return ancestors


async def _get_all_descendants(db, lot_id: str, max_depth: int = 10) -> list[dict]:
    """Recursively get all descendant lots up to max_depth."""
    from sqlalchemy import select

    from app.models.lot import Lot, LotGenealogy

    descendants = []
    visited = set()
    queue = [(lot_id, 0)]  # (lot_id, depth)

    while queue:
        current_id, depth = queue.pop(0)

        if depth >= max_depth or current_id in visited:
            continue

        visited.add(current_id)

        # Get children of current lot
        stmt = (
            select(Lot, LotGenealogy.quantity_used_kg)
            .join(LotGenealogy, LotGenealogy.child_lot_id == Lot.id)
            .where(LotGenealogy.parent_lot_id == current_id)
        )
        result = await db.execute(stmt)

        for child, quantity in result.all():
            if child.id not in visited:
                descendants.append({
                    "id": str(child.id),
                    "lot_code": child.lot_code,
                    "lot_type": child.lot_type.value if child.lot_type else None,
                    "weight_kg": float(child.weight_kg) if child.weight_kg else None,
                    "quantity_used_kg": float(quantity) if quantity else None,
                    "depth": depth + 1,
                })
                queue.append((child.id, depth + 1))

    return descendants


@celery_app.task(name="invalidate_lot_cache")
def invalidate_lot_cache(lot_code: str) -> dict[str, str]:
    """Invalidate cache for a specific lot."""
    from app.cache import delete_cache, get_traceability_cache_key

    cache_key = get_traceability_cache_key(lot_code)
    asyncio.run(delete_cache(cache_key))

    return {"status": "invalidated", "lot_code": lot_code}
