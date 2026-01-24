#!/bin/bash
# backend/scripts/restore.sh
# PostgreSQL restore from encrypted S3 backup
# Usage: ./restore.sh <backup-filename.dump.gpg> [target_database]

set -euo pipefail

# === Usage Check ===
if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup-file.dump.gpg> [target_database]"
    echo ""
    echo "Examples:"
    echo "  $0 flowviz_daily_20260119_020000.dump.gpg"
    echo "  $0 flowviz_daily_20260119_020000.dump.gpg flowviz_restore_test"
    echo "  $0 /path/to/local/backup.dump.gpg flowviz"
    echo ""
    echo "List available backups:"
    echo "  aws s3 ls s3://flowviz-backups/daily/ --recursive"
    exit 1
fi

# === Configuration ===
BACKUP_FILE="$1"
TARGET_DB="${2:-flowviz}"
TEMP_DIR="${TEMP_DIR:-/tmp/flowviz_restore}"
S3_BUCKET="${S3_BUCKET:-flowviz-backups}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-admin}"

# === Logging ===
log() {
    echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') [RESTORE] $1"
}

error_exit() {
    log "ERROR: $1"
    exit 1
}

# === Error Handling ===
cleanup() {
    log "Cleaning up temporary files..."
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT
trap 'error_exit "Restore failed at line $LINENO"' ERR

# === Pre-flight Checks ===
log "Starting restore of $BACKUP_FILE to $TARGET_DB"

command -v pg_restore >/dev/null 2>&1 || error_exit "pg_restore not found"
command -v gpg >/dev/null 2>&1 || error_exit "gpg not found"
command -v psql >/dev/null 2>&1 || error_exit "psql not found"

# === Prepare Temp Directory ===
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# === Get Backup File ===
LOCAL_BACKUP=""

# Check if it's a local path
if [ -f "$BACKUP_FILE" ]; then
    LOCAL_BACKUP="$BACKUP_FILE"
    log "Using local backup file: $LOCAL_BACKUP"
else
    # Try to download from S3
    LOCAL_BACKUP="$TEMP_DIR/$(basename $BACKUP_FILE)"
    
    if command -v aws >/dev/null 2>&1 && [ -n "$S3_BUCKET" ]; then
        log "Downloading from S3..."
        
        # Try daily first, then weekly
        if aws s3 cp "s3://${S3_BUCKET}/daily/$(basename $BACKUP_FILE)" "$LOCAL_BACKUP" 2>/dev/null; then
            log "Downloaded from daily/"
        elif aws s3 cp "s3://${S3_BUCKET}/weekly/$(basename $BACKUP_FILE)" "$LOCAL_BACKUP" 2>/dev/null; then
            log "Downloaded from weekly/"
        else
            error_exit "Backup not found in S3: $BACKUP_FILE"
        fi
    else
        error_exit "Backup file not found: $BACKUP_FILE"
    fi
fi

# === Decrypt Backup ===
DECRYPTED_FILE="${LOCAL_BACKUP%.gpg}"
if [ "$DECRYPTED_FILE" = "$LOCAL_BACKUP" ]; then
    # File doesn't end with .gpg, assume it's already decrypted
    DECRYPTED_FILE="$LOCAL_BACKUP"
    log "File appears to be unencrypted, skipping decryption"
else
    log "Decrypting backup..."
    gpg --decrypt --output "$DECRYPTED_FILE" "$LOCAL_BACKUP"
    log "Decryption complete"
fi

# === Terminate Existing Connections ===
log "Terminating connections to $TARGET_DB..."

PGPASSWORD="${PGPASSWORD:-password}" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TARGET_DB' AND pid <> pg_backend_pid();" \
    2>/dev/null || log "No active connections to terminate"

# === Restore Database ===
log "Restoring database (this may take several minutes)..."

PGPASSWORD="${PGPASSWORD:-password}" pg_restore \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$TARGET_DB" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --single-transaction \
    --exit-on-error \
    "$DECRYPTED_FILE"

log "Database restore complete"

# === Verify Restore ===
log "Verifying restore..."

VERIFICATION=$(PGPASSWORD="${PGPASSWORD:-password}" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$TARGET_DB" \
    -t \
    -c "SELECT 
        (SELECT COUNT(*) FROM public.lots) as lots,
        (SELECT COUNT(*) FROM public.qc_decisions) as qc_decisions,
        (SELECT COUNT(*) FROM public.users) as users;" 2>/dev/null || echo "Verification query failed")

log "Verification counts: $VERIFICATION"

# === Get Latest Record ===
LATEST_LOT=$(PGPASSWORD="${PGPASSWORD:-password}" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$TARGET_DB" \
    -t \
    -c "SELECT lot_code, created_at FROM public.lots ORDER BY created_at DESC LIMIT 1;" \
    2>/dev/null || echo "No lots found")

log "Latest lot: $LATEST_LOT"

# === Summary ===
log "=== RESTORE COMPLETE ==="
log "Target database: $TARGET_DB"
log "Source backup: $BACKUP_FILE"
log "Verification: $VERIFICATION"
log ""
log "Next steps:"
log "1. Verify application connectivity"
log "2. Check critical data integrity"
log "3. Update DNS/connection strings if needed"
log "4. Document incident for compliance"
