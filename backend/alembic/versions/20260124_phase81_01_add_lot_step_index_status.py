"""Add step_index and status columns to lots table.

Revision ID: 20260124_ph81_01
Revises: 20260124_flows
Create Date: 2026-01-24

Phase 8.1 Migration 1: Schema alignment for lots table
- step_index: Canonical 11-step tracking (0-10)
- status: Lot lifecycle status (CREATED, QUARANTINE, RELEASED, HOLD, REJECTED, CONSUMED, FINISHED)
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260124_ph81_01"
down_revision: Union[str, None] = "20260124_flows"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add step_index and status columns to lots table."""
    # Add step_index column for canonical 11-step tracking
    op.add_column(
        "lots",
        sa.Column("step_index", sa.Integer(), nullable=True),
    )

    # Add CHECK constraint for step_index range (0-10)
    op.create_check_constraint(
        "ck_lots_step_index_range",
        "lots",
        "step_index IS NULL OR (step_index >= 0 AND step_index <= 10)",
    )

    # Add status column for lot lifecycle
    op.add_column(
        "lots",
        sa.Column("status", sa.String(20), nullable=True, server_default="CREATED"),
    )

    # Add CHECK constraint for status values
    op.create_check_constraint(
        "ck_lots_status",
        "lots",
        "status IN ('CREATED','QUARANTINE','RELEASED','HOLD','REJECTED','CONSUMED','FINISHED')",
    )

    # Add index for step_index queries
    op.create_index("idx_lots_step_index", "lots", ["step_index"])

    # Add index for status queries
    op.create_index("idx_lots_status", "lots", ["status"])


def downgrade() -> None:
    """Remove step_index and status columns from lots table."""
    op.drop_index("idx_lots_status", table_name="lots")
    op.drop_index("idx_lots_step_index", table_name="lots")
    op.drop_constraint("ck_lots_status", "lots", type_="check")
    op.drop_column("lots", "status")
    op.drop_constraint("ck_lots_step_index_range", "lots", type_="check")
    op.drop_column("lots", "step_index")
