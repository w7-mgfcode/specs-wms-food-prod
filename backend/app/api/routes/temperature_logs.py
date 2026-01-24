"""Temperature log endpoints.

Phase 8.4: QC & Genealogy Unification.
"""

from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import AllAuthenticated, CanMakeQCDecisions, DBSession
from app.models.qc_inspection import TemperatureLog
from app.rate_limit import limiter
from app.schemas.qc_inspection import (
    TEMP_THRESHOLDS,
    MeasurementType,
    TemperatureLogCreate,
    TemperatureLogListItem,
    TemperatureLogResponse,
)

router = APIRouter(prefix="/temperature-logs", tags=["temperature-logs"])


def check_violation(temperature_c: float, measurement_type: MeasurementType) -> bool:
    """Check if temperature exceeds threshold for measurement type."""
    threshold = TEMP_THRESHOLDS.get(measurement_type)
    if threshold is None:
        return False
    return float(temperature_c) > float(threshold)


@router.post(
    "",
    response_model=TemperatureLogResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("200/minute")
async def create_temperature_log(
    request: Request,
    log_data: TemperatureLogCreate,
    db: DBSession,
    current_user: CanMakeQCDecisions,
) -> TemperatureLogResponse:
    """
    Record a temperature measurement.

    Requires: ADMIN, MANAGER, AUDITOR, or OPERATOR role.
    Rate limit: 200/minute.

    Required fields:
        - temperature_c: Temperature reading (-50 to 100)
        - measurement_type: SURFACE, CORE, or AMBIENT

    Optional fields:
        - lot_id: Associated lot
        - buffer_id: Associated buffer
        - inspection_id: Associated QC inspection

    Note: is_violation is computed server-side based on thresholds:
        - SURFACE: > 4°C is violation
        - CORE: > -18°C is violation
        - AMBIENT: > -18°C is violation

    If is_violation=True and lot_id is provided, the database trigger
    will automatically set the lot status to HOLD.
    """
    # Compute violation based on thresholds
    is_violation = check_violation(
        float(log_data.temperature_c),
        log_data.measurement_type,
    )

    temp_log = TemperatureLog(
        id=uuid4(),
        lot_id=log_data.lot_id,
        buffer_id=log_data.buffer_id,
        inspection_id=log_data.inspection_id,
        temperature_c=log_data.temperature_c,
        measurement_type=log_data.measurement_type.value,
        is_violation=is_violation,
        recorded_by=current_user.id,
    )

    db.add(temp_log)
    await db.flush()
    await db.refresh(temp_log)

    return TemperatureLogResponse.model_validate(temp_log)


@router.get(
    "",
    response_model=list[TemperatureLogListItem],
)
@limiter.limit("200/minute")
async def list_temperature_logs(
    request: Request,
    db: DBSession,
    current_user: AllAuthenticated,
    lot_id: UUID | None = None,
    buffer_id: UUID | None = None,
    inspection_id: UUID | None = None,
    violations_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[TemperatureLogListItem]:
    """
    List temperature logs with optional filters.

    Requires: Any authenticated user.
    Rate limit: 200/minute.

    Query parameters:
        - lot_id: Filter by lot
        - buffer_id: Filter by buffer
        - inspection_id: Filter by inspection
        - violations_only: Only return violations
        - limit: Max results (default 50)
        - offset: Pagination offset
    """
    query = select(TemperatureLog)

    if lot_id:
        query = query.where(TemperatureLog.lot_id == lot_id)
    if buffer_id:
        query = query.where(TemperatureLog.buffer_id == buffer_id)
    if inspection_id:
        query = query.where(TemperatureLog.inspection_id == inspection_id)
    if violations_only:
        query = query.where(TemperatureLog.is_violation == True)  # noqa: E712

    query = query.order_by(TemperatureLog.recorded_at.desc()).limit(limit).offset(offset)

    result = await db.execute(query)
    logs = result.scalars().all()

    return [TemperatureLogListItem.model_validate(log) for log in logs]


@router.get(
    "/{log_id}",
    response_model=TemperatureLogResponse,
)
@limiter.limit("200/minute")
async def get_temperature_log(
    request: Request,
    log_id: UUID,
    db: DBSession,
    current_user: AllAuthenticated,
) -> TemperatureLogResponse:
    """
    Get a specific temperature log by ID.

    Requires: Any authenticated user.
    Rate limit: 200/minute.
    """
    result = await db.execute(
        select(TemperatureLog).where(TemperatureLog.id == log_id)
    )
    log = result.scalar_one_or_none()

    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Temperature log {log_id} not found",
        )

    return TemperatureLogResponse.model_validate(log)
