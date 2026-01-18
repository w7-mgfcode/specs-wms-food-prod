"""Lot schemas for request/response validation."""

from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.lot import LotType


class LotCreate(BaseModel):
    """
    Lot creation request schema.

    Note: Node/Express accepts dynamic fields, but we define the expected schema.
    Additional fields are captured in metadata.
    """

    lot_code: str = Field(..., min_length=1, max_length=100)
    lot_type: Optional[LotType] = None
    production_run_id: Optional[UUID] = None
    phase_id: Optional[UUID] = None
    operator_id: Optional[UUID] = None
    weight_kg: Optional[Decimal] = Field(None, ge=0, le=10000)
    temperature_c: Optional[Decimal] = Field(None, ge=-50, le=100)
    metadata: Optional[dict[str, Any]] = None


class LotResponse(BaseModel):
    """
    Lot response schema - matches Node/Express output.

    Node/Express returns the full lot row after INSERT.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lot_code: str
    lot_type: Optional[LotType] = None
    production_run_id: Optional[UUID] = None
    phase_id: Optional[UUID] = None
    operator_id: Optional[UUID] = None
    weight_kg: Optional[Decimal] = None
    temperature_c: Optional[Decimal] = None
    metadata: dict[str, Any] = Field(default_factory=dict, validation_alias="metadata_")
    created_at: datetime
