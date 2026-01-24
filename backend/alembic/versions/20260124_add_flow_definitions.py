"""Add flow_definitions and flow_versions tables.

Revision ID: 20260124_flows
Revises:
Create Date: 2026-01-24

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260124_flows"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create flow_definitions and flow_versions tables."""
    # Create flow_definitions table
    op.create_table(
        "flow_definitions",
        sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create flow_versions table
    op.create_table(
        "flow_versions",
        sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("flow_definition_id", sa.Uuid(), nullable=False),
        sa.Column("version_num", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.String(50),
            nullable=False,
            server_default="DRAFT",
        ),
        sa.Column(
            "graph_schema",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default='{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}',
        ),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["flow_definition_id"], ["flow_definitions.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["published_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("flow_definition_id", "version_num"),
        sa.CheckConstraint(
            "status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')", name="flow_version_status_check"
        ),
    )

    # Add index for faster lookups
    op.create_index(
        "ix_flow_versions_definition_status",
        "flow_versions",
        ["flow_definition_id", "status"],
    )

    # Add flow_version_id to production_runs (nullable for backward compatibility)
    op.add_column(
        "production_runs",
        sa.Column("flow_version_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_production_runs_flow_version",
        "production_runs",
        "flow_versions",
        ["flow_version_id"],
        ["id"],
    )


def downgrade() -> None:
    """Drop flow_definitions and flow_versions tables."""
    # Remove FK from production_runs
    op.drop_constraint("fk_production_runs_flow_version", "production_runs", type_="foreignkey")
    op.drop_column("production_runs", "flow_version_id")

    # Drop index
    op.drop_index("ix_flow_versions_definition_status", table_name="flow_versions")

    # Drop tables
    op.drop_table("flow_versions")
    op.drop_table("flow_definitions")
