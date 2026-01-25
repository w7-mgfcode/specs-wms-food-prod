"""Add trigger to enforce buffer purity rules.

Revision ID: 20260124_ph83_02
Revises: 20260124_ph83_01
Create Date: 2026-01-24

Phase 8.3 Migration 2: Buffer purity trigger
- Validates lot type matches buffer's allowed_lot_types on inventory insert
- Prevents SKW30 lots from entering SKW15 buffers, etc.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260124_ph83_02"
down_revision: Union[str, None] = "20260124_ph83_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create trigger to validate buffer lot type purity."""
    # Create function to validate buffer lot type purity
    op.execute("""
        CREATE OR REPLACE FUNCTION validate_buffer_lot_type()
        RETURNS TRIGGER AS $$
        DECLARE
            allowed VARCHAR(10)[];
            lot_type_val VARCHAR(10);
        BEGIN
            -- Get allowed lot types for the buffer
            SELECT allowed_lot_types INTO allowed
            FROM buffers WHERE id = NEW.buffer_id;

            -- Get the lot type
            SELECT lot_type INTO lot_type_val
            FROM lots WHERE id = NEW.lot_id;

            -- Check if lot type is allowed
            IF NOT (lot_type_val = ANY(allowed)) THEN
                RAISE EXCEPTION 'Lot type % not allowed in this buffer. Allowed types: %',
                    lot_type_val, array_to_string(allowed, ', ');
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Create trigger on inventory_items (separate statements for asyncpg)
    op.execute("DROP TRIGGER IF EXISTS trg_inventory_buffer_purity ON inventory_items")
    op.execute("""
        CREATE TRIGGER trg_inventory_buffer_purity
        BEFORE INSERT ON inventory_items
        FOR EACH ROW
        EXECUTE FUNCTION validate_buffer_lot_type()
    """)


def downgrade() -> None:
    """Remove buffer purity trigger."""
    op.execute("DROP TRIGGER IF EXISTS trg_inventory_buffer_purity ON inventory_items")
    op.execute("DROP FUNCTION IF EXISTS validate_buffer_lot_type()")
