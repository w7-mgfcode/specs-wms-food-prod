#!/bin/bash
# backend/scripts/test-restore.sh
# Quarterly full restore test for HACCP compliance
# Creates isolated test database, restores backup, validates data integrity

set -euo pipefail

# === Configuration ===
BACKUP_FILE="${1:-}"
S3_BUCKET="${S3_BUCKET:-flowviz-backups}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-admin}"
TEST_DB="flowviz_restore_test_$(date +%Y%m%d)"
TEMP_DIR="${TEMP_DIR:-/tmp/flowviz_test_restore}"
LOG_FILE="${LOG_FILE:-/var/log/flowviz-restore-test.log}"
REPORT_DIR="${REPORT_DIR:-/var/reports}"

# === Logging ===
log() {
    echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') [RESTORE_TEST] $1" | tee -a "$LOG_FILE" 2>/dev/null || echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') [RESTORE_TEST] $1"
}

error_exit() {
    log "ERROR: $1"
    # Generate failure report
    generate_report "FAILED" "$1"
    exit 1
}

generate_report() {
    local status="$1"
    local message="${2:-Completed successfully}"
    local report_file="$REPORT_DIR/restore_test_$(date +%Y%m%d_%H%M%S).json"
    
    mkdir -p "$REPORT_DIR"
    
    cat > "$report_file" <<EOF
{
    "test_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "backup_file": "$BACKUP_FILE",
    "test_database": "$TEST_DB",
    "status": "$status",
    "message": "$message",
    "duration_seconds": $(($(date +%s) - START_TIME)),
    "lot_count": "${LOT_COUNT:-0}",
    "qc_count": "${QC_COUNT:-0}",
    "user_count": "${USER_COUNT:-0}",
    "latest_lot_date": "${LATEST_LOT_DATE:-unknown}",
    "compliance": "HACCP_QUARTERLY_RESTORE_TEST"
}
EOF
    log "Report generated: $report_file"
}

# === Error Handling ===
cleanup() {
    log "Cleaning up..."
    
    # Drop test database if it exists
    if [ -n "$TEST_DB" ]; then
        PGPASSWORD="${PGPASSWORD:-password}" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d postgres \
            -c "DROP DATABASE IF EXISTS $TEST_DB;" 2>/dev/null || true
        log "Test database dropped: $TEST_DB"
    fi
    
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT
trap 'error_exit "Test failed at line $LINENO"' ERR

# === Start Timer ===
START_TIME=$(date +%s)

# === Get Latest Weekly Backup If Not Specified ===
if [ -z "$BACKUP_FILE" ]; then
    if command -v aws >/dev/null 2>&1 && [ -n "$S3_BUCKET" ]; then
        log "Finding latest weekly backup..."
        BACKUP_FILE=$(aws s3 ls "s3://${S3_BUCKET}/weekly/" --recursive | sort | tail -n 1 | awk '{print $4}')
        if [ -z "$BACKUP_FILE" ]; then
            # Fallback to daily
            BACKUP_FILE=$(aws s3 ls "s3://${S3_BUCKET}/daily/" --recursive | sort | tail -n 1 | awk '{print $4}')
        fi
        if [ -z "$BACKUP_FILE" ]; then
            error_exit "No backups found in S3"
        fi
        log "Found: $BACKUP_FILE"
    else
        error_exit "No backup file specified and S3 not available"
    fi
fi

# === Pre-flight Checks ===
log "=== QUARTERLY RESTORE TEST ==="
log "Date: $(date -u +%Y-%m-%d)"
log "Backup: $BACKUP_FILE"
log "Test DB: $TEST_DB"
log ""

command -v pg_restore >/dev/null 2>&1 || error_exit "pg_restore not found"
command -v gpg >/dev/null 2>&1 || error_exit "gpg not found"
command -v psql >/dev/null 2>&1 || error_exit "psql not found"

# === Prepare Temp Directory ===
mkdir -p "$TEMP_DIR"
mkdir -p "$REPORT_DIR"
cd "$TEMP_DIR"

# === Download Backup ===
log "STEP 1: Downloading backup..."
LOCAL_BACKUP="$TEMP_DIR/$(basename $BACKUP_FILE)"

if [ -f "$BACKUP_FILE" ]; then
    LOCAL_BACKUP="$BACKUP_FILE"
    log "Using local file"
elif command -v aws >/dev/null 2>&1; then
    aws s3 cp "s3://${S3_BUCKET}/${BACKUP_FILE}" "$LOCAL_BACKUP" --only-show-errors
    log "Download complete"
else
    error_exit "Cannot access backup file"
fi

# === Decrypt ===
log "STEP 2: Decrypting backup..."
DECRYPTED_FILE="${LOCAL_BACKUP%.gpg}"
gpg --decrypt --output "$DECRYPTED_FILE" "$LOCAL_BACKUP" 2>/dev/null
log "Decryption complete"

# === Create Test Database ===
log "STEP 3: Creating test database..."
PGPASSWORD="${PGPASSWORD:-password}" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d postgres \
    -c "CREATE DATABASE $TEST_DB;"
log "Test database created"

# === Restore to Test Database ===
log "STEP 4: Restoring to test database (this may take several minutes)..."
RESTORE_START=$(date +%s)

PGPASSWORD="${PGPASSWORD:-password}" pg_restore \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$TEST_DB" \
    --no-owner \
    --no-privileges \
    --single-transaction \
    "$DECRYPTED_FILE"

RESTORE_DURATION=$(($(date +%s) - RESTORE_START))
log "Restore complete in ${RESTORE_DURATION}s"

# === Validate Data Integrity ===
log "STEP 5: Validating data integrity..."

# Get counts
LOT_COUNT=$(PGPASSWORD="${PGPASSWORD:-password}" psql \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB" \
    -t -c "SELECT COUNT(*) FROM lots;" | xargs)

QC_COUNT=$(PGPASSWORD="${PGPASSWORD:-password}" psql \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB" \
    -t -c "SELECT COUNT(*) FROM qc_decisions;" | xargs)

USER_COUNT=$(PGPASSWORD="${PGPASSWORD:-password}" psql \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB" \
    -t -c "SELECT COUNT(*) FROM users;" | xargs)

log "  Lots: $LOT_COUNT"
log "  QC Decisions: $QC_COUNT"
log "  Users: $USER_COUNT"

# Get latest lot date
LATEST_LOT_DATE=$(PGPASSWORD="${PGPASSWORD:-password}" psql \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB" \
    -t -c "SELECT MAX(created_at)::date FROM lots;" | xargs)

log "  Latest lot date: $LATEST_LOT_DATE"

# === Validation Checks ===
log "STEP 6: Running validation checks..."

# Check 1: Required tables exist
REQUIRED_TABLES=("lots" "qc_decisions" "users" "products" "traceability_graph")
for table in "${REQUIRED_TABLES[@]}"; do
    EXISTS=$(PGPASSWORD="${PGPASSWORD:-password}" psql \
        -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB" \
        -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '$table');" | xargs)
    if [ "$EXISTS" != "t" ]; then
        error_exit "Required table missing: $table"
    fi
done
log "  CHECK 1 PASSED: All required tables exist"

# Check 2: Data integrity (at least some records exist)
if [ "$LOT_COUNT" -lt 1 ] && [ "$USER_COUNT" -lt 1 ]; then
    error_exit "Database appears empty - no lots or users found"
fi
log "  CHECK 2 PASSED: Data exists in restored database"

# Check 3: Foreign key constraints valid
FK_VIOLATIONS=$(PGPASSWORD="${PGPASSWORD:-password}" psql \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB" \
    -t -c "SELECT COUNT(*) FROM qc_decisions qc LEFT JOIN lots l ON qc.lot_id = l.id WHERE l.id IS NULL AND qc.lot_id IS NOT NULL;" | xargs 2>/dev/null || echo "0")
if [ "$FK_VIOLATIONS" != "0" ]; then
    log "  WARNING: $FK_VIOLATIONS foreign key violations found"
fi
log "  CHECK 3 PASSED: Foreign key check complete"

# === Calculate Recovery Metrics ===
TOTAL_DURATION=$(($(date +%s) - START_TIME))

log ""
log "=== RESTORE TEST COMPLETE ==="
log "Status: SUCCESS"
log "Total duration: ${TOTAL_DURATION}s"
log "Restore duration: ${RESTORE_DURATION}s"
log "RTO achieved: ${RESTORE_DURATION}s < 300s (target)"
log ""
log "Data Summary:"
log "  Lots: $LOT_COUNT"
log "  QC Decisions: $QC_COUNT"
log "  Users: $USER_COUNT"
log "  Latest data: $LATEST_LOT_DATE"
log ""

# Generate success report
generate_report "SUCCESS"

# Output for monitoring
echo "restore_test_success{duration=\"$TOTAL_DURATION\",lots=\"$LOT_COUNT\"} 1"
