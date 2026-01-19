"""QC decision schemas for request/response validation."""

from datetime import datetime
from decimal import Decimal
from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.qc import Decision


class QCDecisionCreate(BaseModel):
    """
    QC decision creation request schema.

    Required fields:
        - lot_id: The lot being evaluated (UUID)
        - decision: PASS, HOLD, or FAIL

    Optional fields:
        - qc_gate_id: Associated QC gate (UUID)
        - operator_id: Operator recording the decision (UUID)
        - notes: Required for HOLD/FAIL (min 10 chars per CLAUDE.md)
        - temperature_c: Temperature reading at decision time
        - digital_signature: Optional signature for audit trail

    Validation:
        - HOLD and FAIL decisions require notes with minimum 10 characters.
    """

    lot_id: UUID
    decision: Decision
    qc_gate_id: UUID | None = None
    operator_id: UUID | None = None
    notes: str | None = Field(None, max_length=1000)
    temperature_c: Decimal | None = Field(None, ge=-50, le=100)
    digital_signature: str | None = None

    @model_validator(mode="after")
    def validate_notes_for_hold_fail(self) -> Self:
        """Validate that HOLD/FAIL decisions have notes."""
        if self.decision in (Decision.HOLD, Decision.FAIL) and (
            not self.notes or len(self.notes.strip()) < 10
        ):
            raise ValueError("Notes required for HOLD/FAIL decisions (min 10 chars)")
        return self


class QCDecisionResponse(BaseModel):
    """
    QC decision response schema - matches Node/Express output.

    Node/Express returns the full qc_decisions row after INSERT.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lot_id: UUID | None = None
    qc_gate_id: UUID | None = None
    operator_id: UUID | None = None
    decision: Decision | None = None
    notes: str | None = None
    temperature_c: Decimal | None = None
    digital_signature: str | None = None
    decided_at: datetime
