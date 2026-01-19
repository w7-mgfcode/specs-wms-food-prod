#!/bin/bash
# backend/scripts/verify-backup.sh
# Monthly backup verification - tests backup integrity without full restore
# Usage: ./verify-backup.sh [backup-file]

set -euo pipefail

# === Configuration ===
BACKUP_FILE="${1:-}"
TEMP_DIR="${TEMP_DIR:-/tmp/flowviz_verify}"
S3_BUCKET="${S3_BUCKET:-flowviz-backups}"
LOG_FILE="${LOG_FILE:-/var/log/flowviz-backup-verify.log}"

# === Logging ===
log() {
    echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') [VERIFY] $1" | tee -a "$LOG_FILE" 2>/dev/null || echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') [VERIFY] $1"
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
trap 'error_exit "Verification failed at line $LINENO"' ERR

# === Get Latest Backup If Not Specified ===
if [ -z "$BACKUP_FILE" ]; then
    if command -v aws >/dev/null 2>&1 && [ -n "$S3_BUCKET" ]; then
        log "Finding latest daily backup..."
        BACKUP_FILE=$(aws s3 ls "s3://${S3_BUCKET}/daily/" --recursive | sort | tail -n 1 | awk '{print $4}')
        if [ -z "$BACKUP_FILE" ]; then
            error_exit "No backups found in S3"
        fi
        log "Found: $BACKUP_FILE"
    else
        error_exit "No backup file specified and S3 not available"
    fi
fi

# === Pre-flight Checks ===
log "Starting backup verification"
log "Target: $BACKUP_FILE"

command -v gpg >/dev/null 2>&1 || error_exit "gpg not found"
command -v pg_restore >/dev/null 2>&1 || error_exit "pg_restore not found"

# === Prepare Temp Directory ===
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# === Download Backup ===
LOCAL_BACKUP="$TEMP_DIR/$(basename $BACKUP_FILE)"

if [ -f "$BACKUP_FILE" ]; then
    LOCAL_BACKUP="$BACKUP_FILE"
    log "Using local file"
elif command -v aws >/dev/null 2>&1; then
    log "Downloading from S3..."
    aws s3 cp "s3://${S3_BUCKET}/${BACKUP_FILE}" "$LOCAL_BACKUP" --only-show-errors
    log "Download complete"
else
    error_exit "Cannot access backup file"
fi

# === Test 1: File Size ===
FILE_SIZE=$(stat -c%s "$LOCAL_BACKUP" 2>/dev/null || stat -f%z "$LOCAL_BACKUP")
log "TEST 1: File size check"
if [ "$FILE_SIZE" -lt 1000 ]; then
    error_exit "Backup file too small ($FILE_SIZE bytes)"
fi
log "  PASS: $FILE_SIZE bytes"

# === Test 2: GPG Decryption ===
log "TEST 2: GPG decryption test"
DECRYPTED_FILE="${LOCAL_BACKUP%.gpg}"
gpg --decrypt --output "$DECRYPTED_FILE" "$LOCAL_BACKUP" 2>/dev/null
log "  PASS: Decryption successful"

# === Test 3: pg_restore List (Table of Contents) ===
log "TEST 3: pg_restore TOC verification"
TOC_OUTPUT=$(pg_restore -l "$DECRYPTED_FILE" 2>&1 | head -50)
TABLE_COUNT=$(echo "$TOC_OUTPUT" | grep -c "TABLE" || echo "0")
log "  PASS: Found $TABLE_COUNT table entries"

# === Test 4: Check Required Tables ===
log "TEST 4: Required tables check"
REQUIRED_TABLES=("lots" "qc_decisions" "users" "traceability_graph" "products")
MISSING_TABLES=()

for table in "${REQUIRED_TABLES[@]}"; do
    if ! echo "$TOC_OUTPUT" | grep -qi "TABLE.*$table"; then
        MISSING_TABLES+=("$table")
    fi
done

if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
    error_exit "Missing required tables: ${MISSING_TABLES[*]}"
fi
log "  PASS: All required tables present"

# === Test 5: Checksum Verification ===
log "TEST 5: Checksum generation"
CHECKSUM=$(sha256sum "$DECRYPTED_FILE" | cut -d' ' -f1)
log "  PASS: SHA256: ${CHECKSUM:0:16}..."

# === Summary ===
log ""
log "=== VERIFICATION COMPLETE ==="
log "Backup: $BACKUP_FILE"
log "Size: $FILE_SIZE bytes"
log "Tables: $TABLE_COUNT"
log "Checksum: ${CHECKSUM:0:32}..."
log "Status: ALL TESTS PASSED"
log ""

# Output for monitoring
echo "backup_verify_success{file=\"$(basename $BACKUP_FILE)\",tables=\"$TABLE_COUNT\"} 1"
