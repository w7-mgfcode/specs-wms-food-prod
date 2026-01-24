"""Add qc_inspections, temperature_logs, and audit_events tables.

Revision ID: 20260124_ph84_01
Revises: 20260124_ph83_02
Create Date: 2026-01-24

Phase 8.4 Migration 1: QC inspection, temperature logging, and audit tables
- qc_inspections: Enhanced QC with step_index and idempotency
- temperature_logs: Temperature measurements with violation tracking
- audit_events: Append-only audit event log
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260124_ph84_01"
down_revision: Union[str, None] = "20260124_ph83_02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create qc_inspections, temperature_logs, and audit_events tables."""
    # Create qc_inspections table
    op.create_table(
        "qc_inspections",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("lot_id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("step_index", sa.Integer(), nullable=False),
        sa.Column("inspection_type", sa.String(30), nullable=False),
        sa.Column("is_ccp", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("decision", sa.String(10), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("inspector_id", sa.Uuid(), nullable=False),
        sa.Column(
            "inspected_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("idempotency_key", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["lot_id"], ["lots.id"]),
        sa.ForeignKeyConstraint(["run_id"], ["production_runs.id"]),
        sa.ForeignKeyConstraint(["inspector_id"], ["users.id"]),
        sa.UniqueConstraint("idempotency_key", name="uq_qc_inspections_idempotency"),
        sa.CheckConstraint(
            "decision IN ('PASS','HOLD','FAIL')",
            name="ck_qc_inspections_decision",
        ),
        sa.CheckConstraint(
            "(decision = 'PASS') OR (notes IS NOT NULL AND LENGTH(notes) >= 10)",
            name="ck_qc_inspections_notes_required",
        ),
        sa.CheckConstraint(
            "step_index >= 0 AND step_index <= 10",
            name="ck_qc_inspections_step_index",
        ),
    )

    op.create_index("idx_qc_inspections_lot", "qc_inspections", ["lot_id"])
    op.create_index("idx_qc_inspections_run", "qc_inspections", ["run_id"])
    op.create_index("idx_qc_inspections_step", "qc_inspections", ["run_id", "step_index"])

    # Create temperature_logs table
    op.create_table(
        "temperature_logs",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("lot_id", sa.Uuid(), nullable=True),
        sa.Column("buffer_id", sa.Uuid(), nullable=True),
        sa.Column("inspection_id", sa.Uuid(), nullable=True),
        sa.Column("temperature_c", sa.Numeric(5, 1), nullable=False),
        sa.Column("measurement_type", sa.String(20), nullable=False),
        sa.Column("is_violation", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("recorded_by", sa.Uuid(), nullable=False),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["lot_id"], ["lots.id"]),
        sa.ForeignKeyConstraint(["buffer_id"], ["buffers.id"]),
        sa.ForeignKeyConstraint(["inspection_id"], ["qc_inspections.id"]),
        sa.ForeignKeyConstraint(["recorded_by"], ["users.id"]),
        sa.CheckConstraint(
            "measurement_type IN ('SURFACE','CORE','AMBIENT')",
            name="ck_temperature_logs_type",
        ),
    )

    op.create_index("idx_temp_logs_lot", "temperature_logs", ["lot_id"])
    op.create_index("idx_temp_logs_buffer", "temperature_logs", ["buffer_id"])
    op.create_index("idx_temp_logs_recorded", "temperature_logs", ["recorded_at"])

    # Create audit_events table (append-only)
    op.create_table(
        "audit_events",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(30), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("old_state", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("new_state", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column(
            "metadata",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )

    op.create_index("idx_audit_entity", "audit_events", ["entity_type", "entity_id"])
    op.create_index("idx_audit_created", "audit_events", ["created_at"])
    op.create_index("idx_audit_user", "audit_events", ["user_id"])


def downgrade() -> None:
    """Remove qc_inspections, temperature_logs, and audit_events tables."""
    op.drop_index("idx_audit_user", table_name="audit_events")
    op.drop_index("idx_audit_created", table_name="audit_events")
    op.drop_index("idx_audit_entity", table_name="audit_events")
    op.drop_table("audit_events")

    op.drop_index("idx_temp_logs_recorded", table_name="temperature_logs")
    op.drop_index("idx_temp_logs_buffer", table_name="temperature_logs")
    op.drop_index("idx_temp_logs_lot", table_name="temperature_logs")
    op.drop_table("temperature_logs")

    op.drop_index("idx_qc_inspections_step", table_name="qc_inspections")
    op.drop_index("idx_qc_inspections_run", table_name="qc_inspections")
    op.drop_index("idx_qc_inspections_lot", table_name="qc_inspections")
    op.drop_table("qc_inspections")
