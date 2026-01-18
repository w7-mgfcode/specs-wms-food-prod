"""QC decision schemas for request/response validation."""

from datetime import datetime
from decimal import Decimal
from typing import Optional, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.qc import Decision


class QCDecisionCreate(BaseModel):
    """
    QC decision creation request schema.

    Note: HOLD and FAIL decisions require notes (min 10 chars per CLAUDE.md).
    """

    lot_id: Optional[UUID] = None
    qc_gate_id: Optional[UUID] = None
    operator_id: Optional[UUID] = None
    decision: Optional[Decision] = None
    notes: Optional[str] = Field(None, max_length=1000)
    temperature_c: Optional[Decimal] = Field(None, ge=-50, le=100)
    digital_signature: Optional[str] = None

    @model_validator(mode="after")
    def validate_notes_for_hold_fail(self) -> Self:
        """Validate that HOLD/FAIL decisions have notes."""
        if self.decision in (Decision.HOLD, Decision.FAIL):
            if not self.notes or len(self.notes.strip()) < 10:
                raise ValueError("Notes required for HOLD/FAIL decisions (min 10 chars)")
        return self


class QCDecisionResponse(BaseModel):
    """
    QC decision response schema - matches Node/Express output.

    Node/Express returns the full qc_decisions row after INSERT.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lot_id: Optional[UUID] = None
    qc_gate_id: Optional[UUID] = None
    operator_id: Optional[UUID] = None
    decision: Optional[Decision] = None
    notes: Optional[str] = None
    temperature_c: Optional[Decimal] = None
    digital_signature: Optional[str] = None
    decided_at: datetime
