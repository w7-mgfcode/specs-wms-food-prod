#!/bin/bash
# backend/scripts/backup.sh
# Automated PostgreSQL backup with encryption and S3 upload
# Usage: ./backup.sh [daily|weekly]

set -euo pipefail

# === Configuration ===
BACKUP_TYPE="${1:-daily}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
DB_NAME="${DB_NAME:-flowviz}"
DB_USER="${DB_USER:-admin}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
S3_BUCKET="${S3_BUCKET:-flowviz-backups}"
GPG_RECIPIENT="${GPG_RECIPIENT:-backup@flowviz.com}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
LOG_FILE="${LOG_FILE:-/var/log/flowviz-backup.log}"

# === Logging ===
log() {
    echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') [$BACKUP_TYPE] $1" | tee -a "$LOG_FILE" 2>/dev/null || echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') [$BACKUP_TYPE] $1"
}

error_exit() {
    log "ERROR: $1"
    exit 1
}

# === Error Handling ===
trap 'error_exit "Backup failed at line $LINENO"' ERR

# === Pre-flight Checks ===
log "Starting $BACKUP_TYPE backup of $DB_NAME"

# Check required tools
command -v pg_dump >/dev/null 2>&1 || error_exit "pg_dump not found"
command -v gpg >/dev/null 2>&1 || error_exit "gpg not found"

# Check GPG key exists
gpg --list-keys "$GPG_RECIPIENT" >/dev/null 2>&1 || error_exit "GPG key not found: $GPG_RECIPIENT"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# === Database Backup ===
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${BACKUP_TYPE}_${TIMESTAMP}.dump"
log "Creating database dump: $BACKUP_FILE"

PGPASSWORD="${PGPASSWORD:-password}" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -Fc \
    -Z 9 \
    -f "$BACKUP_FILE" \
    "$DB_NAME"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "Database dump complete: $BACKUP_SIZE"

# === Encryption ===
log "Encrypting backup with GPG..."
gpg --encrypt \
    --recipient "$GPG_RECIPIENT" \
    --trust-model always \
    --output "${BACKUP_FILE}.gpg" \
    "$BACKUP_FILE"

# Remove unencrypted file immediately
rm -f "$BACKUP_FILE"
log "Encryption complete, unencrypted file removed"

# === S3 Upload (if bucket configured) ===
if [ -n "$S3_BUCKET" ] && command -v aws >/dev/null 2>&1; then
    S3_PATH="s3://${S3_BUCKET}/${BACKUP_TYPE}/$(basename ${BACKUP_FILE}.gpg)"
    log "Uploading to S3: $S3_PATH"

    aws s3 cp "${BACKUP_FILE}.gpg" "$S3_PATH" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256 \
        --only-show-errors

    # === Verify Upload ===
    log "Verifying S3 upload..."
    if aws s3 ls "$S3_PATH" >/dev/null 2>&1; then
        S3_SIZE=$(aws s3 ls "$S3_PATH" | awk '{print $3}')
        log "S3 upload verified: $S3_SIZE bytes"
    else
        error_exit "S3 upload verification failed"
    fi
else
    log "S3 upload skipped (S3_BUCKET not set or aws CLI not available)"
fi

# === Local Cleanup ===
log "Cleaning local backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "*.dump.gpg" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true

# === Summary ===
log "Backup completed successfully"
log "  Local: ${BACKUP_FILE}.gpg"
if [ -n "$S3_BUCKET" ] && command -v aws >/dev/null 2>&1; then
    log "  S3: $S3_PATH"
fi
log "  Size: $BACKUP_SIZE (compressed)"

# Output for monitoring
echo "backup_success{type=\"$BACKUP_TYPE\",size=\"$BACKUP_SIZE\"} 1"
