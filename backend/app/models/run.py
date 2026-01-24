"""Run step execution model.

Phase 8.1: Track execution of each step within a production run.
"""

import enum
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Optional
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import UUID_TYPE, Base

if TYPE_CHECKING:
    from app.models.production import ProductionRun
    from app.models.user import User


class StepExecutionStatus(str, enum.Enum):
    """Step execution status."""

    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    SKIPPED = "SKIPPED"


class RunStepExecution(Base):
    """
    Track execution of each step within a production run.

    Maps to public.run_step_executions table.

    Each production run has up to 11 step executions (indices 0-10),
    one for each canonical step in the production flow.
    """

    __tablename__ = "run_step_executions"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    run_id: Mapped[UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("production_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    node_id: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=StepExecutionStatus.PENDING.value
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    operator_id: Mapped[UUID | None] = mapped_column(
        UUID_TYPE, ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Relationships
    production_run: Mapped["ProductionRun"] = relationship(
        "ProductionRun", back_populates="step_executions"
    )
    operator: Mapped[Optional["User"]] = relationship(
        "User", back_populates="step_executions"
    )
