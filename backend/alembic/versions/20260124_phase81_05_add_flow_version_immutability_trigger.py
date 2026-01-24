"""Add trigger to prevent modification of PUBLISHED flow versions.

Revision ID: 20260124_ph81_05
Revises: 20260124_ph81_04
Create Date: 2026-01-24

Phase 8.1 Migration 5: FlowVersion immutability trigger
- Prevents modification of PUBLISHED flow versions
- Allows status change TO DEPRECATED (for archiving)
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260124_ph81_05"
down_revision: Union[str, None] = "20260124_ph81_04"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create trigger to prevent PUBLISHED flow version modification."""
    # Create function to prevent published version modification
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_published_flow_version_modification()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Allow status change TO DEPRECATED (archiving)
            IF OLD.status = 'PUBLISHED' AND NEW.status = 'DEPRECATED' THEN
                RETURN NEW;
            END IF;

            -- Block all other modifications to PUBLISHED versions
            IF OLD.status = 'PUBLISHED' THEN
                RAISE EXCEPTION 'Cannot modify PUBLISHED flow version. Status: %, ID: %', OLD.status, OLD.id;
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Create trigger
    op.execute("""
        DROP TRIGGER IF EXISTS trg_flow_version_immutable ON flow_versions;
        CREATE TRIGGER trg_flow_version_immutable
        BEFORE UPDATE ON flow_versions
        FOR EACH ROW
        EXECUTE FUNCTION prevent_published_flow_version_modification();
    """)


def downgrade() -> None:
    """Remove immutability trigger."""
    op.execute("DROP TRIGGER IF EXISTS trg_flow_version_immutable ON flow_versions")
    op.execute("DROP FUNCTION IF EXISTS prevent_published_flow_version_modification()")
