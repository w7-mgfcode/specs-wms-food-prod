"""Add buffers, inventory_items, and stock_moves tables.

Revision ID: 20260124_ph83_01
Revises: 20260124_ph81_05
Create Date: 2026-01-24

Phase 8.3 Migration 1: Buffer and Inventory tables
- buffers: Storage locations with allowed lot types and temperature constraints
- inventory_items: Track lots in buffers with enter/exit timestamps
- stock_moves: Audit trail of all stock movements with idempotency
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

# revision identifiers, used by Alembic.
revision: str = "20260124_ph83_01"
down_revision: Union[str, None] = "20260124_ph81_05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create buffers, inventory_items, and stock_moves tables."""
    # Create buffers table
    op.create_table(
        "buffers",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("buffer_code", sa.String(20), nullable=False),
        sa.Column("buffer_type", sa.String(20), nullable=False),
        sa.Column("allowed_lot_types", ARRAY(sa.String(10)), nullable=False),
        sa.Column("capacity_kg", sa.Numeric(10, 2), nullable=False),
        sa.Column("temp_min_c", sa.Numeric(5, 1), nullable=False),
        sa.Column("temp_max_c", sa.Numeric(5, 1), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("buffer_code", name="uq_buffers_code"),
        sa.CheckConstraint(
            "buffer_type IN ('LK','MIX','SKW15','SKW30','FRZ','PAL')",
            name="ck_buffers_type",
        ),
    )

    op.create_index("idx_buffers_type", "buffers", ["buffer_type"])
    op.create_index("idx_buffers_active", "buffers", ["is_active"])

    # Create inventory_items table
    op.create_table(
        "inventory_items",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("lot_id", sa.Uuid(), nullable=False),
        sa.Column("buffer_id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("quantity_kg", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "entered_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("exited_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["lot_id"], ["lots.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["buffer_id"], ["buffers.id"]),
        sa.ForeignKeyConstraint(["run_id"], ["production_runs.id"]),
    )

    # Partial index for active inventory (exited_at IS NULL)
    op.create_index(
        "idx_inventory_buffer_active",
        "inventory_items",
        ["buffer_id"],
        postgresql_where=sa.text("exited_at IS NULL"),
    )
    op.create_index("idx_inventory_lot", "inventory_items", ["lot_id"])
    op.create_index("idx_inventory_run", "inventory_items", ["run_id"])

    # Create stock_moves table
    op.create_table(
        "stock_moves",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("lot_id", sa.Uuid(), nullable=False),
        sa.Column("from_buffer_id", sa.Uuid(), nullable=True),
        sa.Column("to_buffer_id", sa.Uuid(), nullable=True),
        sa.Column("quantity_kg", sa.Numeric(10, 2), nullable=False),
        sa.Column("move_type", sa.String(20), nullable=False),
        sa.Column("operator_id", sa.Uuid(), nullable=False),
        sa.Column("idempotency_key", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["lot_id"], ["lots.id"]),
        sa.ForeignKeyConstraint(["from_buffer_id"], ["buffers.id"]),
        sa.ForeignKeyConstraint(["to_buffer_id"], ["buffers.id"]),
        sa.ForeignKeyConstraint(["operator_id"], ["users.id"]),
        sa.UniqueConstraint("idempotency_key", name="uq_stock_moves_idempotency"),
        sa.CheckConstraint(
            "move_type IN ('RECEIVE','TRANSFER','CONSUME','SHIP')",
            name="ck_stock_moves_type",
        ),
        sa.CheckConstraint(
            "from_buffer_id IS NOT NULL OR to_buffer_id IS NOT NULL",
            name="ck_stock_moves_has_buffer",
        ),
    )

    op.create_index("idx_stock_moves_lot", "stock_moves", ["lot_id"])
    op.create_index("idx_stock_moves_created", "stock_moves", ["created_at"])

    # Seed default buffers
    op.execute("""
        INSERT INTO buffers (buffer_code, buffer_type, allowed_lot_types, capacity_kg, temp_min_c, temp_max_c)
        VALUES
            ('LK-001', 'LK', ARRAY['DEB', 'BULK'], 1000.00, 1.0, 4.0),
            ('MIX-001', 'MIX', ARRAY['MIX'], 500.00, 2.0, 4.0),
            ('SKW15-001', 'SKW15', ARRAY['SKW15'], 300.00, 2.0, 4.0),
            ('SKW30-001', 'SKW30', ARRAY['SKW30'], 300.00, 2.0, 4.0),
            ('FRZ-001', 'FRZ', ARRAY['FRZ15', 'FRZ30'], 800.00, -25.0, -18.0),
            ('PAL-001', 'PAL', ARRAY['PAL'], 2000.00, -22.0, -18.0)
    """)


def downgrade() -> None:
    """Remove buffers, inventory_items, and stock_moves tables."""
    op.drop_index("idx_stock_moves_created", table_name="stock_moves")
    op.drop_index("idx_stock_moves_lot", table_name="stock_moves")
    op.drop_table("stock_moves")

    op.drop_index("idx_inventory_run", table_name="inventory_items")
    op.drop_index("idx_inventory_lot", table_name="inventory_items")
    op.drop_index("idx_inventory_buffer_active", table_name="inventory_items")
    op.drop_table("inventory_items")

    op.drop_index("idx_buffers_active", table_name="buffers")
    op.drop_index("idx_buffers_type", table_name="buffers")
    op.drop_table("buffers")
