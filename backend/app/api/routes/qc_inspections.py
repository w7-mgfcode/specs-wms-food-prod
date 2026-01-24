"""QC inspection endpoints.

Phase 8.4: QC & Genealogy Unification.
"""

from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import AllAuthenticated, CanMakeQCDecisions, DBSession
from app.models.qc_inspection import QCInspection
from app.rate_limit import limiter
from app.schemas.qc_inspection import (
    QCInspectionCreate,
    QCInspectionListItem,
    QCInspectionResponse,
)

router = APIRouter(prefix="/qc-inspections", tags=["qc-inspections"])


@router.post(
    "",
    response_model=QCInspectionResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("100/minute")
async def create_qc_inspection(
    request: Request,
    inspection_data: QCInspectionCreate,
    db: DBSession,
    current_user: CanMakeQCDecisions,
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
) -> QCInspectionResponse:
    """
    Create a QC inspection record.

    Requires: ADMIN, MANAGER, AUDITOR, or OPERATOR role.
    Rate limit: 100/minute.

    Headers:
        - Idempotency-Key: UUID to prevent duplicate inspections

    Required fields:
        - lot_id: UUID of the lot being inspected
        - run_id: UUID of the production run
        - step_index: Production step (0-10)
        - inspection_type: Type of inspection
        - decision: PASS, HOLD, or FAIL

    Validation:
        - HOLD/FAIL decisions require notes (min 10 chars)
        - step_index must be 0-10
        - Returns 409 if idempotency_key already exists
    """
    # Check for duplicate idempotency key
    existing = await db.execute(
        select(QCInspection).where(QCInspection.idempotency_key == idempotency_key)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Inspection with this idempotency key already exists",
        )

    inspection = QCInspection(
        id=uuid4(),
        lot_id=inspection_data.lot_id,
        run_id=inspection_data.run_id,
        step_index=inspection_data.step_index,
        inspection_type=inspection_data.inspection_type,
        is_ccp=inspection_data.is_ccp,
        decision=inspection_data.decision.value,
        notes=inspection_data.notes,
        inspector_id=current_user.id,
        idempotency_key=idempotency_key,
    )

    db.add(inspection)
    await db.flush()
    await db.refresh(inspection)

    return QCInspectionResponse.model_validate(inspection)


@router.get(
    "",
    response_model=list[QCInspectionListItem],
)
@limiter.limit("200/minute")
async def list_qc_inspections(
    request: Request,
    db: DBSession,
    current_user: AllAuthenticated,
    run_id: UUID | None = None,
    lot_id: UUID | None = None,
    step_index: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[QCInspectionListItem]:
    """
    List QC inspections with optional filters.

    Requires: Any authenticated user.
    Rate limit: 200/minute.

    Query parameters:
        - run_id: Filter by production run
        - lot_id: Filter by lot
        - step_index: Filter by step (0-10)
        - limit: Max results (default 50)
        - offset: Pagination offset
    """
    query = select(QCInspection)

    if run_id:
        query = query.where(QCInspection.run_id == run_id)
    if lot_id:
        query = query.where(QCInspection.lot_id == lot_id)
    if step_index is not None:
        query = query.where(QCInspection.step_index == step_index)

    query = query.order_by(QCInspection.inspected_at.desc()).limit(limit).offset(offset)

    result = await db.execute(query)
    inspections = result.scalars().all()

    return [QCInspectionListItem.model_validate(i) for i in inspections]


@router.get(
    "/{inspection_id}",
    response_model=QCInspectionResponse,
)
@limiter.limit("200/minute")
async def get_qc_inspection(
    request: Request,
    inspection_id: UUID,
    db: DBSession,
    current_user: AllAuthenticated,
) -> QCInspectionResponse:
    """
    Get a specific QC inspection by ID.

    Requires: Any authenticated user.
    Rate limit: 200/minute.
    """
    result = await db.execute(
        select(QCInspection).where(QCInspection.id == inspection_id)
    )
    inspection = result.scalar_one_or_none()

    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"QC inspection {inspection_id} not found",
        )

    return QCInspectionResponse.model_validate(inspection)
