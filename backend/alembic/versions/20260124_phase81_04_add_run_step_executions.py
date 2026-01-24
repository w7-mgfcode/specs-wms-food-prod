"""Add run_step_executions table for tracking step progress.

Revision ID: 20260124_ph81_04
Revises: 20260124_ph81_03
Create Date: 2026-01-24

Phase 8.1 Migration 4: RunStepExecution table
- Tracks execution of each step within a production run
- Status: PENDING, IN_PROGRESS, COMPLETED, SKIPPED
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260124_ph81_04"
down_revision: Union[str, None] = "20260124_ph81_03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create run_step_executions table."""
    op.create_table(
        "run_step_executions",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("step_index", sa.Integer(), nullable=False),
        sa.Column("node_id", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("operator_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["production_runs.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["operator_id"],
            ["users.id"],
        ),
        sa.UniqueConstraint("run_id", "step_index", name="uq_run_step_executions_run_step"),
        sa.CheckConstraint(
            "step_index >= 0 AND step_index <= 10",
            name="ck_run_step_executions_step_index",
        ),
        sa.CheckConstraint(
            "status IN ('PENDING','IN_PROGRESS','COMPLETED','SKIPPED')",
            name="ck_run_step_executions_status",
        ),
    )

    op.create_index("idx_run_step_executions_run", "run_step_executions", ["run_id"])
    op.create_index("idx_run_step_executions_status", "run_step_executions", ["status"])


def downgrade() -> None:
    """Drop run_step_executions table."""
    op.drop_index("idx_run_step_executions_status", table_name="run_step_executions")
    op.drop_index("idx_run_step_executions_run", table_name="run_step_executions")
    op.drop_table("run_step_executions")
