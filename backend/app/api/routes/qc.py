"""QC decision endpoints."""

from fastapi import APIRouter, status

from app.api.deps import DBSession
from app.models.qc import QCDecision
from app.schemas.qc import QCDecisionCreate, QCDecisionResponse

router = APIRouter(tags=["qc"])


@router.post(
    "/qc-decisions",
    response_model=QCDecisionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_qc_decision(
    decision_data: QCDecisionCreate,
    db: DBSession,
) -> QCDecisionResponse:
    """
    Record a QC decision - matches Node/Express behavior.

    Node/Express uses dynamic field insertion from request body.
    We use structured Pydantic validation with HOLD/FAIL notes requirement.

    Response: Returns the created decision with all fields.
    """
    # Create decision instance from validated data
    decision = QCDecision(
        lot_id=decision_data.lot_id,
        qc_gate_id=decision_data.qc_gate_id,
        operator_id=decision_data.operator_id,
        decision=decision_data.decision,
        notes=decision_data.notes,
        temperature_c=decision_data.temperature_c,
        digital_signature=decision_data.digital_signature,
    )

    db.add(decision)
    await db.flush()  # Get the generated ID
    await db.refresh(decision)  # Refresh to get all default values

    return QCDecisionResponse.model_validate(decision)
