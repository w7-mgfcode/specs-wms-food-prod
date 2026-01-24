"""Audit event endpoints.

Phase 8.4: QC & Genealogy Unification.
Read-only access to append-only audit log.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import AllAuthenticated, DBSession
from app.models.qc_inspection import AuditEvent
from app.rate_limit import limiter
from app.schemas.qc_inspection import (
    AuditEventListItem,
    AuditEventResponse,
)

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get(
    "/events",
    response_model=list[AuditEventListItem],
)
@limiter.limit("100/minute")
async def list_audit_events(
    request: Request,
    db: DBSession,
    current_user: AllAuthenticated,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    event_type: str | None = None,
    user_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[AuditEventListItem]:
    """
    List audit events with optional filters.

    Requires: Any authenticated user.
    Rate limit: 100/minute.

    Query parameters:
        - entity_type: Filter by entity type (e.g., 'lot', 'run')
        - entity_id: Filter by entity ID
        - event_type: Filter by event type (e.g., 'TEMP_VIOLATION_HOLD')
        - user_id: Filter by user who triggered the event
        - limit: Max results (default 50, max 500)
        - offset: Pagination offset

    Returns audit events in reverse chronological order (newest first).
    """
    if limit > 500:
        limit = 500

    query = select(AuditEvent)

    if entity_type:
        query = query.where(AuditEvent.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditEvent.entity_id == entity_id)
    if event_type:
        query = query.where(AuditEvent.event_type == event_type)
    if user_id:
        query = query.where(AuditEvent.user_id == user_id)

    query = query.order_by(AuditEvent.created_at.desc()).limit(limit).offset(offset)

    result = await db.execute(query)
    events = result.scalars().all()

    return [AuditEventListItem.model_validate(e) for e in events]


@router.get(
    "/events/{event_id}",
    response_model=AuditEventResponse,
)
@limiter.limit("200/minute")
async def get_audit_event(
    request: Request,
    event_id: int,
    db: DBSession,
    current_user: AllAuthenticated,
) -> AuditEventResponse:
    """
    Get a specific audit event by ID.

    Requires: Any authenticated user.
    Rate limit: 200/minute.

    Returns full audit event details including old_state, new_state, and metadata.
    """
    result = await db.execute(
        select(AuditEvent).where(AuditEvent.id == event_id)
    )
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audit event {event_id} not found",
        )

    return AuditEventResponse.model_validate(event)


@router.get(
    "/entity/{entity_type}/{entity_id}",
    response_model=list[AuditEventListItem],
)
@limiter.limit("100/minute")
async def get_entity_audit_trail(
    request: Request,
    entity_type: str,
    entity_id: UUID,
    db: DBSession,
    current_user: AllAuthenticated,
    limit: int = 100,
) -> list[AuditEventListItem]:
    """
    Get full audit trail for a specific entity.

    Requires: Any authenticated user.
    Rate limit: 100/minute.

    Path parameters:
        - entity_type: Type of entity (e.g., 'lot', 'run', 'inspection')
        - entity_id: UUID of the entity

    Returns all audit events for the entity in chronological order.
    """
    if limit > 500:
        limit = 500

    result = await db.execute(
        select(AuditEvent)
        .where(AuditEvent.entity_type == entity_type)
        .where(AuditEvent.entity_id == entity_id)
        .order_by(AuditEvent.created_at.asc())
        .limit(limit)
    )
    events = result.scalars().all()

    return [AuditEventListItem.model_validate(e) for e in events]
