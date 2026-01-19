# Infrastructure & Observability: Backup & Disaster Recovery

> **Phase:** 4.2b - Disaster Recovery & Testing  
> **Sprint:** Week 6-7  
> **Priority:** HIGH (Required for production readiness)  
> **Date:** January 19, 2026  
> **Version:** 1.0  
> **Prerequisite:** INITIAL-7a.md (Connection Pooling & Monitoring)

---

## FEATURE:

Build production-grade backup and disaster recovery capabilities for the Food Production WMS:

1. **Automated PostgreSQL Backups:** Daily encrypted backups with GPG, uploaded to cloud storage (S3/Azure Blob) with cross-region replication.

2. **Disaster Recovery Procedures:** Tested restore procedures with documented RTO (4 hours) and RPO (1 hour) targets.

3. **HACCP Compliance:** 7-year retention for audit trails meeting food production regulatory requirements.

**Success Criteria:**
- Backup/restore tested successfully with documented procedure
- Zero data loss during PostgreSQL failure scenarios
- Recovery within 4 hours (RTO), <1 hour data loss (RPO)
- 7-year backup retention for HACCP compliance

---

## TOOLS:

- **pg_dump -Fc**: PostgreSQL backup command with custom format (compressed). Supports parallel restore, selective table restore, and is the recommended format for production backups.

- **pg_restore -c -1**: PostgreSQL restore command. `-c` cleans (drops) database objects before recreating, `-1` runs in single transaction for atomicity.

- **aws s3 cp**: AWS CLI command for uploading encrypted backups to S3. Supports multipart upload for large files and cross-region replication.

- **GPG encryption**: Backup encryption at rest with dedicated key pair for security compliance.

---

## DEPENDENCIES:

### Infrastructure Services
- **PostgreSQL 17:** Primary database (existing)
- **S3 or Azure Blob:** Backup storage (new)
- **GPG:** Backup encryption (system tool)
- **AWS CLI:** S3 upload/download operations

### System Requirements
```bash
# Required packages
apt-get install -y gnupg awscli postgresql-client
```

---

## SYSTEM PROMPT(S):

### Backup & Disaster Recovery Prompt
```
You are implementing backup and disaster recovery for a Food Production WMS with HACCP compliance.

**Backup Strategy:**
- Encrypt all backups at rest (GPG with dedicated key)
- Test restore procedure quarterly (compliance requirement)
- Maintain 7-year retention for HACCP audit trails
- Store backups in different region than primary database

**Recovery Objectives:**
- RTO (Recovery Time Objective): 4 hours maximum
- RPO (Recovery Point Objective): 1 hour maximum data loss

**Testing Requirements:**
- Execute restore procedure in staging environment quarterly
- Validate data integrity after each restore test
- Document results for compliance audits
```

### DR Playbook
```
When PostgreSQL fails:

1. Assess impact: Check if read replicas available
2. Notify stakeholders: Contact on-call team
3. Download latest backup from S3
4. Decrypt and restore to standby server
5. Update DNS/connection strings
6. Verify data integrity with validation queries
7. Resume operations
8. Post-incident review within 24 hours
```

---

## IMPLEMENTATION:

### Backup Script
```bash
#!/bin/bash
# backend/scripts/backup.sh
# Automated PostgreSQL backup with encryption and S3 upload

set -euo pipefail

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="${DB_NAME:-flowviz}"
DB_USER="${DB_USER:-admin}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
S3_BUCKET="${S3_BUCKET:-flowviz-backups}"
GPG_RECIPIENT="${GPG_RECIPIENT:-backup@flowviz.com}"
RETENTION_DAYS=7
LOG_FILE="/var/log/flowviz-backup.log"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Error handling
trap 'log "ERROR: Backup failed at line $LINENO"' ERR

log "Starting backup of $DB_NAME"

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Full backup with custom format (compressed)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.dump"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -Fc -f "$BACKUP_FILE" "$DB_NAME"
log "Database dump complete: $(du -h $BACKUP_FILE | cut -f1)"

# Encrypt backup with GPG
gpg --encrypt --recipient "$GPG_RECIPIENT" --output "${BACKUP_FILE}.gpg" "$BACKUP_FILE"
rm "$BACKUP_FILE"  # Remove unencrypted file
log "Encryption complete"

# Upload to S3 with server-side encryption
aws s3 cp "${BACKUP_FILE}.gpg" "s3://${S3_BUCKET}/daily/" \
    --storage-class STANDARD_IA \
    --server-side-encryption AES256
log "Uploaded to S3: s3://${S3_BUCKET}/daily/$(basename ${BACKUP_FILE}.gpg)"

# Verify upload
if aws s3 ls "s3://${S3_BUCKET}/daily/$(basename ${BACKUP_FILE}.gpg)" > /dev/null 2>&1; then
    log "S3 upload verified"
else
    log "ERROR: S3 upload verification failed"
    exit 1
fi

# Clean local backups older than retention period
find "$BACKUP_DIR" -name "*.dump.gpg" -mtime +${RETENTION_DAYS} -delete
log "Cleaned local backups older than ${RETENTION_DAYS} days"

log "Backup completed successfully"
```

### Restore Script
```bash
#!/bin/bash
# backend/scripts/restore.sh
# PostgreSQL restore from encrypted S3 backup

set -euo pipefail

# Usage check
if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup-file.dump.gpg> [target_database]"
    echo "Example: $0 flowviz_20260119_020000.dump.gpg flowviz_restore_test"
    exit 1
fi

BACKUP_FILE=$1
TARGET_DB="${2:-flowviz}"
TEMP_DIR="/tmp/flowviz_restore"
S3_BUCKET="${S3_BUCKET:-flowviz-backups}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-admin}"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log "Starting restore of $BACKUP_FILE to $TARGET_DB"

# Create temp directory
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Download from S3 if not local
if [ ! -f "$BACKUP_FILE" ]; then
    log "Downloading from S3..."
    aws s3 cp "s3://${S3_BUCKET}/daily/$BACKUP_FILE" "$TEMP_DIR/"
fi

# Decrypt backup
log "Decrypting backup..."
DECRYPTED_FILE="${BACKUP_FILE%.gpg}"
gpg --decrypt --output "$DECRYPTED_FILE" "$BACKUP_FILE"

# Terminate existing connections
log "Terminating connections to $TARGET_DB..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TARGET_DB' AND pid <> pg_backend_pid();" \
    || true

# Restore database
log "Restoring database..."
pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET_DB" \
    --clean --if-exists --no-owner --no-privileges --single-transaction \
    "$DECRYPTED_FILE"

# Verify restore
log "Verifying restore..."
LOTS_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET_DB" -t -c "SELECT COUNT(*) FROM lots;")
QC_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET_DB" -t -c "SELECT COUNT(*) FROM qc_decisions;")

log "Verification: Lots=$LOTS_COUNT, QC Decisions=$QC_COUNT"

# Cleanup
rm -f "$DECRYPTED_FILE"
log "Restore completed successfully"
```

### Cron Configuration
```bash
# /etc/cron.d/flowviz-backup

# Daily backup at 2 AM UTC
0 2 * * * flowviz /opt/flowviz/scripts/backup.sh >> /var/log/flowviz-backup.log 2>&1

# Weekly backup (Sundays at 3 AM - 7-year retention for HACCP)
0 3 * * 0 flowviz /opt/flowviz/scripts/backup-weekly.sh >> /var/log/flowviz-backup.log 2>&1

# Monthly backup verification (1st of month at 4 AM)
0 4 1 * * flowviz /opt/flowviz/scripts/verify-backup.sh >> /var/log/flowviz-backup.log 2>&1
```

### S3 Lifecycle Policy (Terraform)
```hcl
# infrastructure/backup-storage.tf
resource "aws_s3_bucket" "backups" {
  bucket = "flowviz-backups"
}

resource "aws_s3_bucket_lifecycle_configuration" "backup_lifecycle" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "daily-backups"
    status = "Enabled"
    filter { prefix = "daily/" }

    transition {
      days          = 30
      storage_class = "GLACIER"
    }
    expiration { days = 90 }
  }

  rule {
    id     = "weekly-backups"
    status = "Enabled"
    filter { prefix = "weekly/" }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }
    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }
    # 7-year retention for HACCP compliance
    expiration { days = 2557 }
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration { status = "Enabled" }
}

# Cross-region replication for DR
resource "aws_s3_bucket_replication_configuration" "backups_dr" {
  bucket = aws_s3_bucket.backups.id
  role   = aws_iam_role.replication.arn

  rule {
    id     = "replicate-to-dr-region"
    status = "Enabled"
    destination {
      bucket        = aws_s3_bucket.backups_dr.arn
      storage_class = "STANDARD_IA"
    }
  }
}
```

---

## TESTING:

### PgBouncer Load Test
```python
# backend/tests/test_connection_pool.py
import asyncio
import httpx
import time

async def test_connection_pool_capacity():
    """Verify PgBouncer handles 1000+ concurrent connections."""
    concurrent = 1000
    url = "http://localhost:8000/api/v1/health"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        start = time.time()
        tasks = [client.get(url) for _ in range(concurrent)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        duration = time.time() - start
        
        successes = sum(1 for r in results if isinstance(r, httpx.Response) and r.status_code == 200)
        
        print(f"Concurrent: {concurrent}, Successes: {successes}, Duration: {duration:.2f}s")
        assert successes >= concurrent * 0.99

if __name__ == "__main__":
    asyncio.run(test_connection_pool_capacity())
```

### Observability Verification
```bash
#!/bin/bash
# backend/tests/test_observability.sh

echo "Testing Prometheus scraping..."
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'

echo "Testing FastAPI metrics endpoint..."
curl -s http://localhost:8000/metrics | head -20

echo "Testing Grafana datasource..."
curl -s -u admin:admin http://localhost:3001/api/datasources | jq '.[].name'

echo "Checking for critical alerts..."
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | select(.state=="firing")'
```

### Backup Restore Test
```bash
#!/bin/bash
# backend/scripts/test-restore.sh
# Quarterly restore test procedure

set -euo pipefail

TEST_DB="flowviz_restore_test_$(date +%Y%m%d)"
LATEST_BACKUP=$(aws s3 ls s3://flowviz-backups/daily/ --recursive | sort | tail -1 | awk '{print $4}')

echo "=== QUARTERLY RESTORE TEST ==="
echo "Testing restore of: $LATEST_BACKUP"
echo "Target database: $TEST_DB"

# Create test database
createdb -U admin "$TEST_DB"

# Run restore
./restore.sh "$(basename $LATEST_BACKUP)" "$TEST_DB"

# Validate data
psql -U admin -d "$TEST_DB" <<EOF
SELECT 'lots' as table_name, COUNT(*) as count FROM lots
UNION ALL SELECT 'qc_decisions', COUNT(*) FROM qc_decisions
UNION ALL SELECT 'production_runs', COUNT(*) FROM production_runs;

SELECT 'Most recent lot:', lot_code, created_at FROM lots ORDER BY created_at DESC LIMIT 1;

SELECT 'Orphan QC decisions:', COUNT(*) FROM qc_decisions qc 
WHERE NOT EXISTS (SELECT 1 FROM lots l WHERE l.id = qc.lot_id);
EOF

# Cleanup
dropdb -U admin "$TEST_DB"

echo "=== RESTORE TEST COMPLETE ==="
```

---

## EXAMPLES:

### Existing Project Examples
- `backend/app/database.py` - Current SQLAlchemy configuration
- `backend/docker/docker-compose.yml` - Docker service definitions

### Reference Implementations
- PostgreSQL Backup Best Practices: https://www.postgresql.org/docs/17/backup.html
- AWS S3 Lifecycle Policies: https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-configuration-examples.html

---

## DOCUMENTATION:

### Internal Documentation (to be created)
- `docs/runbooks/disaster-recovery.md` - DR procedures
- `docs/runbooks/restore-test-log.md` - Quarterly test results
- `docs/architecture.md` - Update with infrastructure diagram

### External Documentation
- PostgreSQL Backup: https://www.postgresql.org/docs/17/backup.html
- AWS S3 CLI: https://docs.aws.amazon.com/cli/latest/reference/s3/
- GPG Encryption: https://gnupg.org/documentation/

---

## OTHER CONSIDERATIONS:

### Action Items (Week 6-7)

**Week 6 (Feb 24-28, 2026):**
- [ ] Day 1-2: Implement backup.sh script
- [ ] Day 3: Configure GPG encryption keys
- [ ] Day 4-5: Set up S3 bucket with lifecycle policy

**Week 7 (Mar 3-7, 2026):**
- [ ] Day 1-2: Implement restore.sh script
- [ ] Day 3: Test restore procedure in staging
- [ ] Day 4: Document DR procedure in runbook
- [ ] Day 5: Schedule cron jobs for automated backups

### Deliverables Checklist

- [ ] `backend/scripts/backup.sh` - Automated backup script
- [ ] `backend/scripts/restore.sh` - Restore procedure script
- [ ] `backend/scripts/test-restore.sh` - Quarterly test script
- [ ] `infrastructure/backup-storage.tf` - S3 Terraform config
- [ ] `docs/runbooks/disaster-recovery.md` - DR procedures

### Gotchas / Common Issues

1. **GPG Key Management:** Ensure backup GPG key is stored securely (not in repo). Use AWS Secrets Manager or similar.

2. **S3 Cross-Region Replication:** Requires versioning enabled on source bucket. Additional storage costs apply.

3. **pg_restore Permissions:** The `--no-owner --no-privileges` flags are critical when restoring to a different user/role.

4. **Connection Termination:** Always terminate active connections before restore, or restore will fail with lock errors.

5. **Time Zone Awareness:** Backup timestamps should use UTC to avoid confusion during DR.

**Effort Estimate:** 6 days (1 DevOps engineer)

---

**Document Version:** 1.0  
**Phase:** 4.2b - Backup & Disaster Recovery  
**Last Updated:** January 19, 2026  
**Previous Part:** INITIAL-7a.md (Connection Pooling & Monitoring)  
**Next Phase:** INITIAL-8.md (Production Deployment & Launch)
