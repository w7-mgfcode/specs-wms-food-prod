"""Production run request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductionRunCreate(BaseModel):
    """Create a new production run."""

    flow_version_id: UUID = Field(..., description="PUBLISHED flow version to pin")


class ProductionRunResponse(BaseModel):
    """Production run response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    run_code: str
    flow_version_id: UUID | None = None
    scenario_id: UUID | None = None
    status: str
    current_step_index: int
    started_by: UUID | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime | None = None


class ProductionRunListItem(BaseModel):
    """Production run list item."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    run_code: str
    status: str
    current_step_index: int
    started_at: datetime | None = None
    completed_at: datetime | None = None


class AdvanceStepRequest(BaseModel):
    """Request to advance to next step."""

    notes: str | None = Field(
        None, max_length=500, description="Optional notes for step completion"
    )


class HoldRunRequest(BaseModel):
    """Request to put run on hold."""

    reason: str = Field(
        ..., min_length=10, max_length=500, description="Reason for hold (min 10 chars)"
    )


class ResumeRunRequest(BaseModel):
    """Request to resume run from hold."""

    resolution: str = Field(
        ..., min_length=10, max_length=500, description="Resolution notes (min 10 chars)"
    )


class AbortRunRequest(BaseModel):
    """Request to abort run."""

    reason: str = Field(
        ..., min_length=10, max_length=500, description="Reason for abort (min 10 chars)"
    )


class RunStepExecutionResponse(BaseModel):
    """Run step execution response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    run_id: UUID
    step_index: int
    node_id: str
    status: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    operator_id: UUID | None = None
    created_at: datetime


class RunWithStepsResponse(BaseModel):
    """Production run with step executions."""

    run: ProductionRunResponse
    steps: list[RunStepExecutionResponse]
