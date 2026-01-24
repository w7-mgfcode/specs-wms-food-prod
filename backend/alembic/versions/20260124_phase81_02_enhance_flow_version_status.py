"""Add REVIEW and DEPRECATED status to flow_versions.

Revision ID: 20260124_ph81_02
Revises: 20260124_ph81_01
Create Date: 2026-01-24

Phase 8.1 Migration 2: Enhanced FlowVersionStatus
- Add REVIEW and DEPRECATED to status CHECK constraint
- Add reviewed_by column for review workflow
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260124_ph81_02"
down_revision: Union[str, None] = "20260124_ph81_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add REVIEW and DEPRECATED status, reviewed_by column."""
    # Drop existing CHECK constraint
    op.execute("""
        ALTER TABLE flow_versions
        DROP CONSTRAINT IF EXISTS flow_version_status_check
    """)
    op.execute("""
        ALTER TABLE flow_versions
        DROP CONSTRAINT IF EXISTS ck_flow_versions_status
    """)

    # Create new CHECK constraint with REVIEW and DEPRECATED
    op.create_check_constraint(
        "ck_flow_versions_status",
        "flow_versions",
        "status IN ('DRAFT','REVIEW','PUBLISHED','DEPRECATED')",
    )

    # Add reviewed_by column
    op.add_column(
        "flow_versions",
        sa.Column("reviewed_by", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_flow_versions_reviewed_by",
        "flow_versions",
        "users",
        ["reviewed_by"],
        ["id"],
    )

    # Add index for status filtering
    op.create_index("idx_flow_versions_status", "flow_versions", ["status"])


def downgrade() -> None:
    """Restore original status CHECK constraint, remove reviewed_by."""
    op.drop_index("idx_flow_versions_status", table_name="flow_versions")
    op.drop_constraint("fk_flow_versions_reviewed_by", "flow_versions", type_="foreignkey")
    op.drop_column("flow_versions", "reviewed_by")
    op.drop_constraint("ck_flow_versions_status", "flow_versions", type_="check")
    op.create_check_constraint(
        "flow_version_status_check",
        "flow_versions",
        "status IN ('DRAFT','PUBLISHED','ARCHIVED')",
    )
