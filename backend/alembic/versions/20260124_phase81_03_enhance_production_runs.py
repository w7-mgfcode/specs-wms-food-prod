"""Enhance production_runs with step tracking and new lifecycle.

Revision ID: 20260124_ph81_03
Revises: 20260124_ph81_02
Create Date: 2026-01-24

Phase 8.1 Migration 3: Enhanced ProductionRun
- current_step_index: Track current step (0-10)
- idempotency_key: Duplicate prevention
- started_by: Audit who started the run
- completed_at: Completion timestamp
- New status values: IDLE, RUNNING, HOLD, COMPLETED, ABORTED, ARCHIVED
- Migrate ACTIVE→RUNNING, CANCELLED→ABORTED
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260124_ph81_03"
down_revision: Union[str, None] = "20260124_ph81_02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Enhance production_runs with new fields and status values."""
    # Add current_step_index
    op.add_column(
        "production_runs",
        sa.Column("current_step_index", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_check_constraint(
        "ck_production_runs_step_index",
        "production_runs",
        "current_step_index >= 0 AND current_step_index <= 10",
    )

    # Migrate existing status values before changing constraint
    op.execute("""
        UPDATE production_runs
        SET status = 'RUNNING'
        WHERE status = 'ACTIVE'
    """)
    op.execute("""
        UPDATE production_runs
        SET status = 'ABORTED'
        WHERE status = 'CANCELLED'
    """)

    # Drop old status constraint (handle both possible names)
    op.execute("""
        ALTER TABLE production_runs
        DROP CONSTRAINT IF EXISTS production_runs_status_check
    """)
    op.execute("""
        ALTER TABLE production_runs
        DROP CONSTRAINT IF EXISTS ck_production_runs_status
    """)

    # Need to alter the status column to String to remove Enum type constraint
    # First alter column type if it's using Enum
    op.execute("""
        ALTER TABLE production_runs
        ALTER COLUMN status TYPE VARCHAR(20)
    """)

    # Create new status CHECK constraint
    op.create_check_constraint(
        "ck_production_runs_status",
        "production_runs",
        "status IN ('IDLE','RUNNING','HOLD','COMPLETED','ABORTED','ARCHIVED')",
    )

    # Add idempotency_key for duplicate prevention
    op.add_column(
        "production_runs",
        sa.Column("idempotency_key", sa.Uuid(), nullable=True),
    )
    op.create_unique_constraint(
        "uq_production_runs_idempotency_key",
        "production_runs",
        ["idempotency_key"],
    )

    # Add started_by for audit
    op.add_column(
        "production_runs",
        sa.Column("started_by", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_production_runs_started_by",
        "production_runs",
        "users",
        ["started_by"],
        ["id"],
    )

    # Add completed_at timestamp
    op.add_column(
        "production_runs",
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Add indexes
    op.create_index("idx_production_runs_status", "production_runs", ["status"])
    op.create_index("idx_production_runs_step_index", "production_runs", ["current_step_index"])


def downgrade() -> None:
    """Revert production_runs enhancements."""
    op.drop_index("idx_production_runs_step_index", table_name="production_runs")
    op.drop_index("idx_production_runs_status", table_name="production_runs")
    op.drop_column("production_runs", "completed_at")
    op.drop_constraint("fk_production_runs_started_by", "production_runs", type_="foreignkey")
    op.drop_column("production_runs", "started_by")
    op.drop_constraint("uq_production_runs_idempotency_key", "production_runs", type_="unique")
    op.drop_column("production_runs", "idempotency_key")

    # Restore old status values
    op.execute("UPDATE production_runs SET status = 'ACTIVE' WHERE status = 'RUNNING'")
    op.execute("UPDATE production_runs SET status = 'CANCELLED' WHERE status = 'ABORTED'")

    op.drop_constraint("ck_production_runs_status", "production_runs", type_="check")
    op.create_check_constraint(
        "production_runs_status_check",
        "production_runs",
        "status IN ('ACTIVE','COMPLETED','CANCELLED')",
    )
    op.drop_constraint("ck_production_runs_step_index", "production_runs", type_="check")
    op.drop_column("production_runs", "current_step_index")
