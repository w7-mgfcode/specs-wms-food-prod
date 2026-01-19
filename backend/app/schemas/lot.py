"""Lot schemas for request/response validation."""

from datetime import datetime
from decimal import Decimal
from typing import Any
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
    lot_type: LotType | None = None
    production_run_id: UUID | None = None
    phase_id: UUID | None = None
    operator_id: UUID | None = None
    weight_kg: Decimal | None = Field(None, ge=0, le=10000)
    temperature_c: Decimal | None = Field(None, ge=-50, le=100)
    metadata: dict[str, Any] | None = None


class LotResponse(BaseModel):
    """
    Lot response schema - matches Node/Express output.

    Node/Express returns the full lot row after INSERT.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lot_code: str
    lot_type: LotType | None = None
    production_run_id: UUID | None = None
    phase_id: UUID | None = None
    operator_id: UUID | None = None
    weight_kg: Decimal | None = None
    temperature_c: Decimal | None = None
    # ORM uses metadata_ (to avoid SQLAlchemy reserved name), API outputs as metadata
    metadata: dict[str, Any] = Field(
        default_factory=dict, alias="metadata_", serialization_alias="metadata"
    )
    created_at: datetime
