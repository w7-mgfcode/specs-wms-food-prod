"""Add triggers for audit append-only and temperature violation workflow.

Revision ID: 20260124_ph84_02
Revises: 20260124_ph84_01
Create Date: 2026-01-24

Phase 8.4 Migration 2: Audit and temperature triggers
- Audit append-only enforcement (prevent UPDATE/DELETE)
- Temperature violation auto-HOLD workflow
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260124_ph84_02"
down_revision: Union[str, None] = "20260124_ph84_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create audit append-only and temperature violation triggers."""
    # Audit append-only enforcement function
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_audit_modification()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'Audit events are append-only and cannot be modified or deleted';
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Trigger to prevent UPDATE on audit_events (separate for asyncpg)
    op.execute("DROP TRIGGER IF EXISTS trg_audit_no_update ON audit_events")
    op.execute("""
        CREATE TRIGGER trg_audit_no_update
        BEFORE UPDATE ON audit_events
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification()
    """)

    # Trigger to prevent DELETE on audit_events (separate for asyncpg)
    op.execute("DROP TRIGGER IF EXISTS trg_audit_no_delete ON audit_events")
    op.execute("""
        CREATE TRIGGER trg_audit_no_delete
        BEFORE DELETE ON audit_events
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification()
    """)

    # Temperature violation auto-HOLD workflow function
    op.execute("""
        CREATE OR REPLACE FUNCTION handle_temp_violation()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.is_violation = TRUE AND NEW.lot_id IS NOT NULL THEN
                -- Update lot status to HOLD
                UPDATE lots
                SET status = 'HOLD'
                WHERE id = NEW.lot_id AND status IN ('RELEASED', 'QUARANTINE', 'CREATED');

                -- Record audit event
                INSERT INTO audit_events (event_type, entity_type, entity_id, user_id, new_state, metadata)
                VALUES (
                    'TEMP_VIOLATION_HOLD',
                    'lot',
                    NEW.lot_id,
                    NEW.recorded_by,
                    jsonb_build_object('status', 'HOLD'),
                    jsonb_build_object(
                        'temperature_c', NEW.temperature_c,
                        'measurement_type', NEW.measurement_type,
                        'threshold_violated', true
                    )
                );
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Trigger for temperature violation auto-HOLD (separate for asyncpg)
    op.execute("DROP TRIGGER IF EXISTS trg_temp_violation_hold ON temperature_logs")
    op.execute("""
        CREATE TRIGGER trg_temp_violation_hold
        AFTER INSERT ON temperature_logs
        FOR EACH ROW EXECUTE FUNCTION handle_temp_violation()
    """)


def downgrade() -> None:
    """Remove audit and temperature triggers."""
    op.execute("DROP TRIGGER IF EXISTS trg_temp_violation_hold ON temperature_logs")
    op.execute("DROP FUNCTION IF EXISTS handle_temp_violation()")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_no_delete ON audit_events")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_no_update ON audit_events")
    op.execute("DROP FUNCTION IF EXISTS prevent_audit_modification()")
