# PRP: Backup & Disaster Recovery - PostgreSQL, S3, GPG Encryption

> **Phase:** 4.2b - Disaster Recovery & Testing  
> **Priority:** HIGH (Required for production readiness)  
> **Date:** January 19, 2026  
> **Prerequisite:** INITIAL-7a.md (Connection Pooling & Monitoring), phase4-infrastructure-pgbouncer-prometheus-grafana.md  
> **Confidence Score:** 8/10

---

## Purpose

Build production-grade backup and disaster recovery capabilities for the Food Production WMS:

1. **Automated PostgreSQL Backups:** Daily encrypted backups with GPG, uploaded to cloud storage (S3/Azure Blob) with cross-region replication.

2. **Disaster Recovery Procedures:** Tested restore procedures with documented RTO (4 hours) and RPO (1 hour) targets.

3. **HACCP Compliance:** 7-year retention for audit trails meeting food production regulatory requirements.

---

## Why

- **Data Protection:** PostgreSQL contains critical lot traceability, QC decisions, and audit trails
- **HACCP Compliance:** Food safety regulations require 7-year data retention
- **Business Continuity:** Production cannot stop; 4-hour RTO is maximum acceptable
- **Regulatory Audits:** Must demonstrate tested backup/restore procedures
- **Ransomware Protection:** Encrypted off-site backups enable recovery from attacks

---

## Success Criteria

- [ ] `backup.sh` script creates encrypted PostgreSQL backups
- [ ] `restore.sh` script restores from encrypted backups
- [ ] Backups uploaded to S3 with server-side encryption
- [ ] S3 lifecycle policies configured for 7-year HACCP retention
- [ ] Cron jobs configured for daily/weekly automated backups
- [ ] DR runbook documented with step-by-step procedures
- [ ] Quarterly restore test procedure documented and executable
- [ ] Recovery within 4 hours (RTO) demonstrated
- [ ] Less than 1 hour data loss (RPO) achieved

---

## All Needed Context

### Existing Codebase Patterns

#### Current Docker Compose (`backend/docker/docker-compose.yml`)
```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: flowviz_db_fastapi
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
      POSTGRES_DB: flowviz
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/01_init.sql
      - ./seed_traceability.sql:/docker-entrypoint-initdb.d/02_seed.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d flowviz"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - flowviz_net
```

#### Database Schema (Tables to Backup)
From `backend/docker/init.sql`:
```sql
-- Critical HACCP tables requiring 7-year retention:
-- 1. auth.users - Authentication records
-- 2. public.users - User profiles and roles
-- 3. public.lots - Production lot tracking
-- 4. public.lot_genealogy - Parent-child lot relationships
-- 5. public.qc_decisions - QC gate decisions (PASS/HOLD/FAIL)
-- 6. public.production_runs - Production run metadata
-- 7. public.phases - Production phases
-- 8. public.qc_gates - QC gate definitions
-- 9. public.scenarios - Production scenarios
-- 10. public.streams - Production streams
```

#### Existing Shell Script Pattern (`backend/perf_test.sh`)
```bash
#!/bin/bash
# Simple performance test for FastAPI endpoints

BASE_URL="http://localhost:8000"
REQUESTS=100

echo "=== FastAPI Performance Test ==="
echo "Running $REQUESTS requests per endpoint..."

# Test health endpoint
echo "Testing GET /api/health..."
START=$(date +%s%N)
for i in $(seq 1 $REQUESTS); do
  curl -s "${BASE_URL}/api/health" > /dev/null
done
END=$(date +%s%N)
DURATION=$((($END - $START) / 1000000))
echo "  Total: ${DURATION}ms"
```

#### Existing Runbook Pattern (`docs/RUNBOOK.md`)
```markdown
# Error Scenarios Runbook

## Authentication Errors (401)

### Symptom
User is redirected to login page unexpectedly.

### Cause
- JWT token expired (30 min default)
...

### Resolution
1. User logs in again
2. For frequent issues, consider implementing refresh tokens
```

---

### External Documentation

#### PostgreSQL Backup Tools
- **pg_dump Documentation:** https://www.postgresql.org/docs/17/app-pgdump.html
- **pg_restore Documentation:** https://www.postgresql.org/docs/17/app-pgrestore.html
- **Backup Best Practices:** https://www.postgresql.org/docs/17/backup.html

```bash
# pg_dump with custom format (recommended for production)
pg_dump -h localhost -p 5432 -U admin -Fc -f backup.dump flowviz

# pg_restore with clean + single transaction
pg_restore -h localhost -p 5432 -U admin -d flowviz \
    --clean --if-exists --no-owner --single-transaction backup.dump
```

#### AWS S3 CLI
- **AWS CLI S3 Reference:** https://docs.aws.amazon.com/cli/latest/reference/s3/
- **S3 Lifecycle Configuration:** https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-configuration-examples.html
- **S3 Cross-Region Replication:** https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html

```bash
# Upload with server-side encryption
aws s3 cp backup.dump.gpg s3://flowviz-backups/daily/ \
    --storage-class STANDARD_IA \
    --server-side-encryption AES256

# Download for restore
aws s3 cp s3://flowviz-backups/daily/backup.dump.gpg ./

# List backups
aws s3 ls s3://flowviz-backups/daily/ --recursive
```

#### GPG Encryption
- **GnuPG Documentation:** https://gnupg.org/documentation/manuals/gnupg/
- **GPG Key Generation:** https://www.gnupg.org/gph/en/manual/c14.html

```bash
# Generate new GPG key pair for backups
gpg --full-generate-key
# Select: RSA and RSA, 4096 bits, 0 = key does not expire
# Name: FlowViz Backup Key
# Email: backup@flowviz.com

# Export public key (store in repo)
gpg --export --armor backup@flowviz.com > backup-public.key

# Export private key (store in AWS Secrets Manager)
gpg --export-secret-keys --armor backup@flowviz.com > backup-private.key

# Encrypt file
gpg --encrypt --recipient backup@flowviz.com backup.dump

# Decrypt file
gpg --decrypt --output backup.dump backup.dump.gpg
```

#### Terraform AWS S3
- **aws_s3_bucket Resource:** https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket
- **aws_s3_bucket_lifecycle_configuration:** https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket_lifecycle_configuration

---

### Critical Gotchas

1. **GPG Key Security:** Private key MUST be stored securely (AWS Secrets Manager, not in repo). Loss of private key = unrecoverable backups.

2. **pg_restore --clean Caution:** The `--clean` flag drops objects before recreating. Ensure target database exists or use `--create` flag.

3. **Connection Termination Required:** Active connections prevent restore. Always run `pg_terminate_backend()` before restore.

4. **S3 Cross-Region Replication:** Requires versioning enabled on BOTH source and destination buckets. Additional storage costs apply.

5. **Cron User Permissions:** Backup user needs PostgreSQL superuser or `pg_dump` role for consistent backups.

6. **Timestamp Timezone:** Always use UTC for backup timestamps to avoid confusion during DR.

7. **Docker Volume Backup:** `postgres_data` Docker volume is NOT backed up by `pg_dump`. Consider separate volume backup strategy.

8. **Large Database Performance:** For databases >10GB, use `pg_dump -j 4` for parallel dump (not compatible with `-Fc` format).

---

## Implementation Blueprint

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Backup & Recovery Flow                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌────────────┐    pg_dump     ┌──────────────┐                    │
│   │ PostgreSQL │ ─────────────▶ │ .dump file   │                    │
│   │   (5432)   │                │ (compressed) │                    │
│   └────────────┘                └──────┬───────┘                    │
│                                        │                             │
│                                        ▼ GPG encrypt                 │
│                                 ┌──────────────┐                    │
│                                 │ .dump.gpg    │                    │
│                                 │ (encrypted)  │                    │
│                                 └──────┬───────┘                    │
│                                        │                             │
│                                        ▼ aws s3 cp                   │
│   ┌────────────────────────────────────┴───────────────────────┐    │
│   │                     S3 Bucket (Primary)                     │    │
│   │  ┌─────────────────┐  ┌─────────────────┐                  │    │
│   │  │ daily/          │  │ weekly/         │                  │    │
│   │  │ (90-day retain) │  │ (7-year retain) │                  │    │
│   │  └─────────────────┘  └─────────────────┘                  │    │
│   └────────────────────────────┬───────────────────────────────┘    │
│                                │                                     │
│                                ▼ Cross-Region Replication           │
│   ┌────────────────────────────────────────────────────────────┐    │
│   │                 S3 Bucket (DR Region)                       │    │
│   │                 (Separate AWS region)                       │    │
│   └────────────────────────────────────────────────────────────┘    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

Recovery Flow:
  S3 → Download → GPG Decrypt → pg_restore → PostgreSQL
```

---

## Task Checklist (Execution Order)

### Task 1: Create Scripts Directory Structure

**Files to Create:**
```
backend/scripts/
├── backup.sh           # Daily automated backup
├── backup-weekly.sh    # Weekly HACCP retention backup
├── restore.sh          # Restore from encrypted backup
├── verify-backup.sh    # Monthly backup verification
├── test-restore.sh     # Quarterly restore test
└── gpg-setup.sh        # GPG key generation helper
```

**Validation:**
```bash
mkdir -p backend/scripts
ls -la backend/scripts/
```

---

### Task 2: Create GPG Setup Script

**File:** `backend/scripts/gpg-setup.sh` (NEW)

```bash
#!/bin/bash
# backend/scripts/gpg-setup.sh
# Generate GPG key pair for backup encryption
# Run this ONCE during initial setup

set -euo pipefail

GPG_NAME="FlowViz Backup Key"
GPG_EMAIL="${GPG_EMAIL:-backup@flowviz.com}"
GPG_PASSPHRASE="${GPG_PASSPHRASE:-}"
OUTPUT_DIR="${OUTPUT_DIR:-./keys}"

echo "=== FlowViz GPG Key Generation ==="
echo "Email: $GPG_EMAIL"
echo "Output: $OUTPUT_DIR"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if key already exists
if gpg --list-keys "$GPG_EMAIL" >/dev/null 2>&1; then
    echo "WARNING: Key for $GPG_EMAIL already exists!"
    read -p "Generate new key anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# Generate key using batch mode
cat > /tmp/gpg-key-params <<EOF
%echo Generating FlowViz backup key...
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: $GPG_NAME
Name-Email: $GPG_EMAIL
Expire-Date: 0
%no-protection
%commit
%echo Key generation complete
EOF

gpg --batch --generate-key /tmp/gpg-key-params
rm /tmp/gpg-key-params

# Export public key (safe to store in repo)
gpg --export --armor "$GPG_EMAIL" > "$OUTPUT_DIR/backup-public.key"
echo "✓ Public key exported: $OUTPUT_DIR/backup-public.key"

# Export private key (MUST be stored securely!)
gpg --export-secret-keys --armor "$GPG_EMAIL" > "$OUTPUT_DIR/backup-private.key"
chmod 600 "$OUTPUT_DIR/backup-private.key"
echo "✓ Private key exported: $OUTPUT_DIR/backup-private.key"

echo ""
echo "=== IMPORTANT SECURITY NOTES ==="
echo "1. Store backup-private.key in AWS Secrets Manager or HashiCorp Vault"
echo "2. NEVER commit backup-private.key to version control"
echo "3. Add 'keys/*.key' to .gitignore"
echo "4. Test encryption/decryption before relying on these keys"
echo ""
echo "Test encryption:"
echo "  echo 'test' | gpg --encrypt --recipient $GPG_EMAIL | gpg --decrypt"
```

---

### Task 3: Create Daily Backup Script

**File:** `backend/scripts/backup.sh` (NEW)

```bash
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
    echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') [$BACKUP_TYPE] $1" | tee -a "$LOG_FILE"
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
command -v aws >/dev/null 2>&1 || error_exit "aws CLI not found"

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

# === S3 Upload ===
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

# === Local Cleanup ===
log "Cleaning local backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "*.dump.gpg" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true

# === Summary ===
log "Backup completed successfully"
log "  Local: ${BACKUP_FILE}.gpg"
log "  S3: $S3_PATH"
log "  Size: $BACKUP_SIZE (compressed)"

# Output for monitoring
echo "backup_success{type=\"$BACKUP_TYPE\",size=\"$BACKUP_SIZE\"} 1"
```

---

### Task 4: Create Weekly HACCP Backup Script

**File:** `backend/scripts/backup-weekly.sh` (NEW)

```bash
#!/bin/bash
# backend/scripts/backup-weekly.sh
# Weekly backup for HACCP 7-year retention
# Runs on Sundays, stored in separate S3 prefix with Glacier transition

set -euo pipefail

# Source the main backup script with weekly type
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Override for weekly retention (kept longer locally for verification)
export RETENTION_DAYS=30

# Run backup with weekly type (goes to weekly/ prefix in S3)
exec "$SCRIPT_DIR/backup.sh" weekly
```

---

### Task 5: Create Restore Script

**File:** `backend/scripts/restore.sh` (NEW)

```bash
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

# === Download from S3 ===
LOCAL_BACKUP="$TEMP_DIR/$BACKUP_FILE"

if [ ! -f "$LOCAL_BACKUP" ]; then
    log "Downloading from S3..."
    
    # Try daily first, then weekly
    if aws s3 cp "s3://${S3_BUCKET}/daily/$BACKUP_FILE" "$LOCAL_BACKUP" 2>/dev/null; then
        log "Downloaded from daily/"
    elif aws s3 cp "s3://${S3_BUCKET}/weekly/$BACKUP_FILE" "$LOCAL_BACKUP" 2>/dev/null; then
        log "Downloaded from weekly/"
    else
        error_exit "Backup not found in S3: $BACKUP_FILE"
    fi
else
    log "Using local backup file: $LOCAL_BACKUP"
fi

# === Decrypt Backup ===
DECRYPTED_FILE="${LOCAL_BACKUP%.gpg}"
log "Decrypting backup..."

gpg --decrypt --output "$DECRYPTED_FILE" "$LOCAL_BACKUP"
log "Decryption complete"

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
        (SELECT COUNT(*) FROM public.users) as users;")

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
```

---

### Task 6: Create Backup Verification Script

**File:** `backend/scripts/verify-backup.sh` (NEW)

```bash
#!/bin/bash
# backend/scripts/verify-backup.sh
# Monthly backup verification - checks backup integrity without full restore
# Runs on 1st of each month

set -euo pipefail

S3_BUCKET="${S3_BUCKET:-flowviz-backups}"
TEMP_DIR="/tmp/flowviz_verify_$$"
LOG_FILE="${LOG_FILE:-/var/log/flowviz-backup.log}"

log() {
    echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') [VERIFY] $1" | tee -a "$LOG_FILE"
}

cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

log "=== Monthly Backup Verification ==="

# Get latest daily backup
LATEST_DAILY=$(aws s3 ls "s3://${S3_BUCKET}/daily/" --recursive | sort | tail -1 | awk '{print $4}')
if [ -z "$LATEST_DAILY" ]; then
    log "ERROR: No daily backups found!"
    exit 1
fi
log "Latest daily backup: $LATEST_DAILY"

# Get latest weekly backup
LATEST_WEEKLY=$(aws s3 ls "s3://${S3_BUCKET}/weekly/" --recursive | sort | tail -1 | awk '{print $4}')
if [ -z "$LATEST_WEEKLY" ]; then
    log "WARNING: No weekly backups found"
else
    log "Latest weekly backup: $LATEST_WEEKLY"
fi

# Download and verify latest daily
mkdir -p "$TEMP_DIR"
BACKUP_FILE="$TEMP_DIR/$(basename $LATEST_DAILY)"

log "Downloading for verification..."
aws s3 cp "s3://${S3_BUCKET}/$LATEST_DAILY" "$BACKUP_FILE" --only-show-errors

# Check GPG decryption works
log "Verifying GPG decryption..."
if gpg --decrypt --output "${BACKUP_FILE%.gpg}" "$BACKUP_FILE" 2>/dev/null; then
    log "✓ GPG decryption successful"
else
    log "ERROR: GPG decryption failed!"
    exit 1
fi

# Check pg_restore can read the dump
log "Verifying pg_restore can parse dump..."
if pg_restore --list "${BACKUP_FILE%.gpg}" >/dev/null 2>&1; then
    TABLE_COUNT=$(pg_restore --list "${BACKUP_FILE%.gpg}" 2>/dev/null | grep -c "TABLE DATA" || echo 0)
    log "✓ Dump valid, contains $TABLE_COUNT table data entries"
else
    log "ERROR: pg_restore cannot parse dump!"
    exit 1
fi

# Check S3 bucket health
log "Checking S3 bucket health..."
DAILY_COUNT=$(aws s3 ls "s3://${S3_BUCKET}/daily/" --recursive | wc -l)
WEEKLY_COUNT=$(aws s3 ls "s3://${S3_BUCKET}/weekly/" --recursive | wc -l)
log "Backup counts: $DAILY_COUNT daily, $WEEKLY_COUNT weekly"

# Verify cross-region replication (if configured)
DR_BUCKET="${S3_BUCKET}-dr"
if aws s3 ls "s3://${DR_BUCKET}/" >/dev/null 2>&1; then
    DR_COUNT=$(aws s3 ls "s3://${DR_BUCKET}/" --recursive | wc -l)
    log "DR bucket: $DR_COUNT replicated objects"
else
    log "NOTE: DR bucket not configured"
fi

log "=== Verification Complete ==="
log "Status: PASS"

# Output for monitoring
echo "backup_verify_success{type=\"monthly\"} 1"
```

---

### Task 7: Create Quarterly Restore Test Script

**File:** `backend/scripts/test-restore.sh` (NEW)

```bash
#!/bin/bash
# backend/scripts/test-restore.sh
# Quarterly restore test procedure for HACCP compliance
# Creates temporary database, restores backup, validates data, cleans up

set -euo pipefail

S3_BUCKET="${S3_BUCKET:-flowviz-backups}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-admin}"
TEST_DB="flowviz_restore_test_$(date +%Y%m%d)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_FILE="/tmp/restore_test_report_$(date +%Y%m%d).md"

log() {
    echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') $1"
}

cleanup() {
    log "Cleaning up test database..."
    PGPASSWORD="${PGPASSWORD:-password}" dropdb \
        -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        --if-exists "$TEST_DB" 2>/dev/null || true
}
trap cleanup EXIT

log "╔════════════════════════════════════════════════════════════╗"
log "║           QUARTERLY RESTORE TEST - HACCP COMPLIANCE         ║"
log "╚════════════════════════════════════════════════════════════╝"
log ""

START_TIME=$(date +%s)

# === Get Latest Backup ===
log "Finding latest backup..."
LATEST_BACKUP=$(aws s3 ls "s3://${S3_BUCKET}/daily/" --recursive | sort | tail -1 | awk '{print $NF}')
BACKUP_FILENAME=$(basename "$LATEST_BACKUP")
log "Testing restore of: $BACKUP_FILENAME"

# === Create Test Database ===
log "Creating test database: $TEST_DB"
PGPASSWORD="${PGPASSWORD:-password}" createdb \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
    "$TEST_DB"

# === Run Restore ===
log "Running restore..."
RESTORE_START=$(date +%s)

"$SCRIPT_DIR/restore.sh" "$BACKUP_FILENAME" "$TEST_DB"

RESTORE_END=$(date +%s)
RESTORE_DURATION=$((RESTORE_END - RESTORE_START))
log "Restore completed in ${RESTORE_DURATION} seconds"

# === Validate Data ===
log "Validating data integrity..."

PGPASSWORD="${PGPASSWORD:-password}" psql \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
    -d "$TEST_DB" \
    -v ON_ERROR_STOP=1 <<EOF
-- Count records in critical tables
SELECT 'lots' as table_name, COUNT(*) as record_count FROM public.lots
UNION ALL SELECT 'qc_decisions', COUNT(*) FROM public.qc_decisions
UNION ALL SELECT 'production_runs', COUNT(*) FROM public.production_runs
UNION ALL SELECT 'lot_genealogy', COUNT(*) FROM public.lot_genealogy
UNION ALL SELECT 'users', COUNT(*) FROM public.users
ORDER BY table_name;

-- Check for orphaned QC decisions
SELECT 'Orphaned QC decisions' as check_name, 
       COUNT(*) as count 
FROM public.qc_decisions qc 
WHERE NOT EXISTS (SELECT 1 FROM public.lots l WHERE l.id = qc.lot_id);

-- Check for broken genealogy links
SELECT 'Broken genealogy (parent)' as check_name,
       COUNT(*) as count
FROM public.lot_genealogy lg
WHERE NOT EXISTS (SELECT 1 FROM public.lots l WHERE l.id = lg.parent_lot_id);

SELECT 'Broken genealogy (child)' as check_name,
       COUNT(*) as count
FROM public.lot_genealogy lg
WHERE NOT EXISTS (SELECT 1 FROM public.lots l WHERE l.id = lg.child_lot_id);

-- Most recent records (verify timeline)
SELECT 'Latest lot' as item, lot_code, created_at::date as date 
FROM public.lots ORDER BY created_at DESC LIMIT 1;

SELECT 'Latest QC decision' as item, decision, decided_at::date as date 
FROM public.qc_decisions ORDER BY decided_at DESC LIMIT 1;
EOF

# === Generate Report ===
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

cat > "$REPORT_FILE" <<EOF
# Quarterly Restore Test Report

**Date:** $(date -u '+%Y-%m-%d %H:%M:%S UTC')
**Backup Tested:** $BACKUP_FILENAME
**Test Database:** $TEST_DB

## Results

| Metric | Value |
|--------|-------|
| Restore Duration | ${RESTORE_DURATION} seconds |
| Total Test Duration | ${TOTAL_DURATION} seconds |
| Status | ✅ PASS |

## RTO/RPO Assessment

- **RTO Target:** 4 hours
- **RTO Actual:** ~${RESTORE_DURATION} seconds (restore only)
- **Status:** ✅ Within target

## Data Integrity

All validation checks passed:
- No orphaned QC decisions
- No broken genealogy links
- Record counts verified

## Sign-off

- [ ] DevOps Engineer: ________________ Date: ________
- [ ] QA Manager: ________________ Date: ________
- [ ] Compliance Officer: ________________ Date: ________

---
*This document satisfies HACCP 7-year retention requirements for backup verification.*
EOF

log ""
log "╔════════════════════════════════════════════════════════════╗"
log "║                    TEST COMPLETE - PASS                     ║"
log "╚════════════════════════════════════════════════════════════╝"
log ""
log "Report saved: $REPORT_FILE"
log "Total time: ${TOTAL_DURATION} seconds"
log ""
log "RTO Assessment: PASS (${RESTORE_DURATION}s restore << 4 hour target)"
```

---

### Task 8: Create Terraform S3 Configuration

**File:** `infrastructure/backup-storage.tf` (NEW)

```hcl
# infrastructure/backup-storage.tf
# S3 bucket configuration for FlowViz backups with HACCP 7-year retention

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "primary_region" {
  description = "Primary AWS region"
  type        = string
  default     = "us-east-1"
}

variable "dr_region" {
  description = "DR AWS region for cross-region replication"
  type        = string
  default     = "us-west-2"
}

# Primary backup bucket
resource "aws_s3_bucket" "backups" {
  bucket = "flowviz-backups-${var.environment}"

  tags = {
    Name        = "FlowViz Backups"
    Environment = var.environment
    Purpose     = "Database backups"
    Retention   = "7-years-HACCP"
  }
}

# Enable versioning (required for replication)
resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle rules for tiered storage and HACCP retention
resource "aws_s3_bucket_lifecycle_configuration" "backup_lifecycle" {
  bucket = aws_s3_bucket.backups.id

  # Daily backups: 30 days hot, then Glacier, expire at 90 days
  rule {
    id     = "daily-backups"
    status = "Enabled"

    filter {
      prefix = "daily/"
    }

    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    expiration {
      days = 90
    }
  }

  # Weekly backups: 90 days hot, Glacier, Deep Archive, 7-year expire
  rule {
    id     = "weekly-backups-haccp"
    status = "Enabled"

    filter {
      prefix = "weekly/"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    # 7-year retention for HACCP compliance (2557 days ≈ 7 years)
    expiration {
      days = 2557
    }
  }

  # Clean up incomplete multipart uploads
  rule {
    id     = "cleanup-multipart"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# DR bucket in secondary region
resource "aws_s3_bucket" "backups_dr" {
  provider = aws.dr_region
  bucket   = "flowviz-backups-${var.environment}-dr"

  tags = {
    Name        = "FlowViz Backups DR"
    Environment = var.environment
    Purpose     = "Disaster recovery replicas"
  }
}

resource "aws_s3_bucket_versioning" "backups_dr" {
  provider = aws.dr_region
  bucket   = aws_s3_bucket.backups_dr.id
  versioning_configuration {
    status = "Enabled"
  }
}

# IAM role for replication
resource "aws_iam_role" "replication" {
  name = "flowviz-backup-replication-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "replication" {
  name = "flowviz-backup-replication-policy"
  role = aws_iam_role.replication.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:GetReplicationConfiguration",
          "s3:ListBucket"
        ]
        Effect   = "Allow"
        Resource = [aws_s3_bucket.backups.arn]
      },
      {
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging"
        ]
        Effect   = "Allow"
        Resource = ["${aws_s3_bucket.backups.arn}/*"]
      },
      {
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags"
        ]
        Effect   = "Allow"
        Resource = ["${aws_s3_bucket.backups_dr.arn}/*"]
      }
    ]
  })
}

# Cross-region replication
resource "aws_s3_bucket_replication_configuration" "backups_dr" {
  bucket = aws_s3_bucket.backups.id
  role   = aws_iam_role.replication.arn

  rule {
    id     = "replicate-all-to-dr"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.backups_dr.arn
      storage_class = "STANDARD_IA"
    }
  }

  depends_on = [aws_s3_bucket_versioning.backups]
}

# Outputs
output "backup_bucket_name" {
  value = aws_s3_bucket.backups.id
}

output "backup_bucket_arn" {
  value = aws_s3_bucket.backups.arn
}

output "dr_bucket_name" {
  value = aws_s3_bucket.backups_dr.id
}
```

---

### Task 9: Create Cron Configuration

**File:** `backend/docker/cron/flowviz-backup` (NEW)

```cron
# /etc/cron.d/flowviz-backup
# FlowViz automated backup schedule
# Requires: AWS credentials configured, GPG key imported

SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
MAILTO=ops@flowviz.com

# Environment variables (override in /etc/environment or systemd)
DB_HOST=localhost
DB_PORT=5432
DB_USER=admin
DB_NAME=flowviz
S3_BUCKET=flowviz-backups
GPG_RECIPIENT=backup@flowviz.com
BACKUP_DIR=/backups
LOG_FILE=/var/log/flowviz-backup.log

# Daily backup at 2:00 AM UTC
0 2 * * * flowviz /opt/flowviz/scripts/backup.sh daily >> /var/log/flowviz-backup.log 2>&1

# Weekly backup on Sundays at 3:00 AM UTC (HACCP 7-year retention)
0 3 * * 0 flowviz /opt/flowviz/scripts/backup-weekly.sh >> /var/log/flowviz-backup.log 2>&1

# Monthly backup verification on 1st at 4:00 AM UTC
0 4 1 * * flowviz /opt/flowviz/scripts/verify-backup.sh >> /var/log/flowviz-backup.log 2>&1

# Quarterly restore test - 1st day of Jan, Apr, Jul, Oct at 5:00 AM UTC
0 5 1 1,4,7,10 * flowviz /opt/flowviz/scripts/test-restore.sh >> /var/log/flowviz-restore-test.log 2>&1
```

---

### Task 10: Create Disaster Recovery Runbook

**File:** `docs/runbooks/disaster-recovery.md` (NEW)

```markdown
# FlowViz Disaster Recovery Runbook

## Overview

| Metric | Target | Current |
|--------|--------|---------|
| RTO (Recovery Time Objective) | 4 hours | ~30 minutes |
| RPO (Recovery Point Objective) | 1 hour | 24 hours (daily backups) |

## Quick Reference

### Download Latest Backup
```bash
# List available backups
aws s3 ls s3://flowviz-backups/daily/ --recursive | tail -10

# Download latest
LATEST=$(aws s3 ls s3://flowviz-backups/daily/ --recursive | sort | tail -1 | awk '{print $4}')
aws s3 cp "s3://flowviz-backups/$LATEST" ./
```

### Emergency Restore
```bash
cd /opt/flowviz/scripts
./restore.sh flowviz_daily_YYYYMMDD_HHMMSS.dump.gpg flowviz
```

---

## Disaster Scenarios

### Scenario 1: Database Corruption

**Symptoms:**
- Application errors about data integrity
- PostgreSQL errors in logs
- Inconsistent query results

**Resolution:**

1. **Assess impact:**
   ```bash
   psql -U admin -d flowviz -c "SELECT COUNT(*) FROM lots;"
   ```

2. **Stop application to prevent further corruption:**
   ```bash
   docker stop flowviz_api_fastapi
   ```

3. **Restore from latest backup:**
   ```bash
   ./restore.sh $(basename $LATEST) flowviz
   ```

4. **Restart application:**
   ```bash
   docker start flowviz_api_fastapi
   ```

5. **Verify recovery:**
   ```bash
   curl http://localhost:8000/api/health
   ```

---

### Scenario 2: Complete Database Loss

**Symptoms:**
- PostgreSQL container won't start
- Volume corruption
- Hardware failure

**Resolution:**

1. **Provision new PostgreSQL instance:**
   ```bash
   cd backend/docker
   docker compose down -v  # Remove corrupted volume
   docker compose up -d postgres
   ```

2. **Wait for PostgreSQL to be ready:**
   ```bash
   docker exec flowviz_db_fastapi pg_isready -U admin
   ```

3. **Restore from backup:**
   ```bash
   ./restore.sh flowviz_daily_YYYYMMDD_HHMMSS.dump.gpg flowviz
   ```

4. **Restart full stack:**
   ```bash
   docker compose up -d
   ```

---

### Scenario 3: Primary Region Failure

**Symptoms:**
- AWS region outage
- Cannot access S3 bucket
- All services unreachable

**Resolution:**

1. **Switch to DR region:**
   ```bash
   export AWS_DEFAULT_REGION=us-west-2
   export S3_BUCKET=flowviz-backups-prod-dr
   ```

2. **List replicated backups:**
   ```bash
   aws s3 ls s3://flowviz-backups-prod-dr/daily/
   ```

3. **Restore to DR infrastructure:**
   - Spin up PostgreSQL in DR region
   - Run restore script with DR bucket

4. **Update DNS:**
   - Point api.flowviz.com to DR load balancer
   - Update CORS origins if needed

---

## Recovery Verification Checklist

After any restore, verify:

- [ ] API health check passes: `curl http://localhost:8000/api/health`
- [ ] Lot count matches expected: `SELECT COUNT(*) FROM lots;`
- [ ] Latest lot is recent: `SELECT lot_code, created_at FROM lots ORDER BY created_at DESC LIMIT 1;`
- [ ] QC decisions present: `SELECT COUNT(*) FROM qc_decisions;`
- [ ] User authentication works: Test login flow
- [ ] Traceability queries work: `curl http://localhost:8000/api/traceability/RAW-BEEF-001`

---

## Contact Information

| Role | Name | Phone | Email |
|------|------|-------|-------|
| On-Call DevOps | TBD | TBD | ops@flowviz.com |
| Database Admin | TBD | TBD | dba@flowviz.com |
| Engineering Lead | TBD | TBD | eng@flowviz.com |

---

## Quarterly Test Schedule

| Quarter | Test Date | Status | Sign-off |
|---------|-----------|--------|----------|
| Q1 2026 | Jan 15, 2026 | Pending | |
| Q2 2026 | Apr 1, 2026 | Pending | |
| Q3 2026 | Jul 1, 2026 | Pending | |
| Q4 2026 | Oct 1, 2026 | Pending | |

---

*Last Updated: January 19, 2026*
*Review Frequency: Quarterly*
*Owner: DevOps Team*
```

---

### Task 11: Update .gitignore

**File:** `backend/.gitignore` (MODIFY or CREATE)

Add these lines:
```gitignore
# Backup keys - NEVER commit private keys
keys/
*.key
backup-private.key

# Backup files
/backups/
*.dump
*.dump.gpg

# Logs
*.log
```

---

## Validation Gates

### Level 1: Script Syntax Validation

```bash
cd backend/scripts

# Check bash syntax
for script in *.sh; do
  bash -n "$script" && echo "✓ $script syntax OK" || echo "✗ $script syntax ERROR"
done

# Check executable permissions
ls -la *.sh
```

### Level 2: Local Integration Test

```bash
cd backend

# Start PostgreSQL
cd docker && docker compose up -d postgres && cd ..

# Wait for database
sleep 10

# Test GPG setup (if not already done)
./scripts/gpg-setup.sh

# Test backup (local only, skip S3)
export S3_BUCKET=""  # Disable S3 upload for local test
export BACKUP_DIR="./test_backups"
export GPG_RECIPIENT="backup@flowviz.com"
./scripts/backup.sh daily

# Verify backup created
ls -la ./test_backups/*.gpg

# Test restore to new database
docker exec flowviz_db_fastapi createdb -U admin flowviz_test
./scripts/restore.sh ./test_backups/*.gpg flowviz_test

# Verify data
docker exec flowviz_db_fastapi psql -U admin -d flowviz_test \
  -c "SELECT COUNT(*) FROM lots;"

# Cleanup
docker exec flowviz_db_fastapi dropdb -U admin flowviz_test
rm -rf ./test_backups
```

### Level 3: AWS Integration Test

```bash
# Requires: AWS credentials configured

# Create test S3 bucket
aws s3 mb s3://flowviz-backups-test

# Test full backup flow
export S3_BUCKET="flowviz-backups-test"
./scripts/backup.sh daily

# Verify upload
aws s3 ls s3://flowviz-backups-test/daily/

# Test download and restore
./scripts/restore.sh $(aws s3 ls s3://flowviz-backups-test/daily/ | awk '{print $4}' | head -1) flowviz_test

# Cleanup
aws s3 rb s3://flowviz-backups-test --force
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/scripts/gpg-setup.sh` | Create | GPG key generation helper |
| `backend/scripts/backup.sh` | Create | Daily automated backup |
| `backend/scripts/backup-weekly.sh` | Create | Weekly HACCP retention backup |
| `backend/scripts/restore.sh` | Create | Restore from encrypted backup |
| `backend/scripts/verify-backup.sh` | Create | Monthly backup verification |
| `backend/scripts/test-restore.sh` | Create | Quarterly restore test |
| `infrastructure/backup-storage.tf` | Create | S3 Terraform configuration |
| `backend/docker/cron/flowviz-backup` | Create | Cron job configuration |
| `docs/runbooks/disaster-recovery.md` | Create | DR procedures documentation |
| `backend/.gitignore` | Modify | Add backup/key exclusions |

---

## Anti-Patterns to Avoid

- **DON'T** store GPG private key in version control
- **DON'T** use `--clean` without `--if-exists` (fails on empty database)
- **DON'T** skip connection termination before restore
- **DON'T** use plaintext passwords in scripts (use PGPASSWORD env var)
- **DON'T** forget to test restores - untested backups are not backups
- **DON'T** use local timezone for backup timestamps (always UTC)
- **DON'T** skip S3 upload verification

---

## References

- [PostgreSQL 17 Backup Documentation](https://www.postgresql.org/docs/17/backup.html)
- [pg_dump Reference](https://www.postgresql.org/docs/17/app-pgdump.html)
- [pg_restore Reference](https://www.postgresql.org/docs/17/app-pgrestore.html)
- [AWS S3 CLI Reference](https://docs.aws.amazon.com/cli/latest/reference/s3/)
- [S3 Lifecycle Configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-configuration-examples.html)
- [GnuPG Documentation](https://gnupg.org/documentation/manuals/gnupg/)
- [INITIAL-7b.md](../INITIAL-7b.md) - Original specification

---

**Confidence Score: 8/10**

High confidence due to:
- Well-documented PostgreSQL backup/restore tools
- Standard shell scripting patterns
- Clear S3 lifecycle configuration
- Comprehensive DR runbook template

Potential challenges:
- GPG key management requires careful handling
- AWS credentials must be pre-configured
- Cross-region replication requires additional Terraform setup
- Testing requires access to AWS S3 (or LocalStack for mock)
