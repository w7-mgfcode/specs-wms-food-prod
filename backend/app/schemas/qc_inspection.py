"""QC inspection, temperature log, and audit event schemas.

Phase 8.4: QC & Genealogy Unification.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class InspectionDecision(str, Enum):
    """QC inspection decision."""

    PASS = "PASS"
    HOLD = "HOLD"
    FAIL = "FAIL"


class MeasurementType(str, Enum):
    """Temperature measurement type."""

    SURFACE = "SURFACE"
    CORE = "CORE"
    AMBIENT = "AMBIENT"


# Temperature thresholds per INITIAL-11
TEMP_THRESHOLDS = {
    MeasurementType.SURFACE: Decimal("4.0"),
    MeasurementType.CORE: Decimal("-18.0"),
    MeasurementType.AMBIENT: Decimal("-18.0"),
}


class QCInspectionCreate(BaseModel):
    """QC inspection creation request.

    Required fields:
        - lot_id: The lot being inspected (UUID)
        - run_id: Production run (UUID)
        - step_index: Production step 0-10
        - inspection_type: Type of inspection
        - decision: PASS, HOLD, or FAIL

    Optional fields:
        - is_ccp: Is this a Critical Control Point
        - notes: Required for HOLD/FAIL (min 10 chars)
    """

    lot_id: UUID
    run_id: UUID
    step_index: int = Field(..., ge=0, le=10)
    inspection_type: str = Field(..., max_length=30)
    is_ccp: bool = False
    decision: InspectionDecision
    notes: str | None = Field(None, max_length=2000)

    @model_validator(mode="after")
    def validate_notes_for_hold_fail(self) -> Self:
        """Validate that HOLD/FAIL decisions have notes."""
        if self.decision in (InspectionDecision.HOLD, InspectionDecision.FAIL) and (
            not self.notes or len(self.notes.strip()) < 10
        ):
            raise ValueError("Notes required for HOLD/FAIL decisions (min 10 chars)")
        return self


class QCInspectionResponse(BaseModel):
    """QC inspection response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lot_id: UUID
    run_id: UUID
    step_index: int
    inspection_type: str
    is_ccp: bool
    decision: str
    notes: str | None
    inspector_id: UUID
    inspected_at: datetime
    idempotency_key: UUID


class QCInspectionListItem(BaseModel):
    """QC inspection list item."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lot_id: UUID
    step_index: int
    inspection_type: str
    is_ccp: bool
    decision: str
    inspected_at: datetime


class TemperatureLogCreate(BaseModel):
    """Temperature log creation request.

    Required fields:
        - temperature_c: Temperature reading
        - measurement_type: SURFACE, CORE, or AMBIENT

    Optional fields:
        - lot_id: Associated lot (UUID)
        - buffer_id: Associated buffer (UUID)
        - inspection_id: Associated QC inspection (UUID)

    Note: is_violation is computed server-side based on thresholds.
    """

    lot_id: UUID | None = None
    buffer_id: UUID | None = None
    inspection_id: UUID | None = None
    temperature_c: Decimal = Field(..., ge=Decimal("-50"), le=Decimal("100"))
    measurement_type: MeasurementType


class TemperatureLogResponse(BaseModel):
    """Temperature log response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lot_id: UUID | None
    buffer_id: UUID | None
    inspection_id: UUID | None
    temperature_c: Decimal
    measurement_type: str
    is_violation: bool
    recorded_by: UUID
    recorded_at: datetime


class TemperatureLogListItem(BaseModel):
    """Temperature log list item."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    temperature_c: Decimal
    measurement_type: str
    is_violation: bool
    recorded_at: datetime


class AuditEventResponse(BaseModel):
    """Audit event response (read-only)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    entity_type: str
    entity_id: UUID
    user_id: UUID
    old_state: dict[str, Any] | None
    new_state: dict[str, Any] | None
    metadata_: dict[str, Any] = Field(alias="metadata")
    ip_address: str | None
    created_at: datetime


class AuditEventListItem(BaseModel):
    """Audit event list item."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    entity_type: str
    entity_id: UUID
    created_at: datetime


class AuditEventFilter(BaseModel):
    """Audit event filter parameters."""

    entity_type: str | None = None
    entity_id: UUID | None = None
    event_type: str | None = None
    user_id: UUID | None = None
    from_date: datetime | None = None
    to_date: datetime | None = None
    limit: int = Field(50, ge=1, le=500)
    offset: int = Field(0, ge=0)
