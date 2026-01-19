"""QC decision endpoints."""

from fastapi import APIRouter, Request, status

from app.api.deps import CanMakeQCDecisions, DBSession
from app.models.qc import QCDecision
from app.rate_limit import limiter
from app.schemas.qc import QCDecisionCreate, QCDecisionResponse

router = APIRouter(tags=["qc"])


@router.post(
    "/qc-decisions",
    response_model=QCDecisionResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("100/minute")
async def create_qc_decision(
    request: Request,
    decision_data: QCDecisionCreate,
    db: DBSession,
    current_user: CanMakeQCDecisions,
) -> QCDecisionResponse:
    """
    Record a QC decision for a lot.

    Requires: ADMIN, MANAGER, AUDITOR, or OPERATOR role.
    VIEWER cannot make QC decisions.
    Rate limit: 100/minute (normal QC gate processing).

    Required fields:
        - lot_id: UUID of the lot being evaluated
        - decision: PASS, HOLD, or FAIL

    Validation:
        - HOLD/FAIL decisions require notes (min 10 chars)
        - Returns 422 if required fields missing or validation fails

    Response: Returns the created decision with all fields (201 Created).
    """
    # Create decision instance from validated data
    # Use authenticated user as operator if not explicitly provided
    decision = QCDecision(
        lot_id=decision_data.lot_id,
        qc_gate_id=decision_data.qc_gate_id,
        operator_id=decision_data.operator_id or current_user.id,
        decision=decision_data.decision,
        notes=decision_data.notes,
        temperature_c=decision_data.temperature_c,
        digital_signature=decision_data.digital_signature,
    )

    db.add(decision)
    await db.flush()  # Get the generated ID
    await db.refresh(decision)  # Refresh to get all default values

    return QCDecisionResponse.model_validate(decision)
