# Disaster Recovery Runbook

**Document Version:** 1.0  
**Last Updated:** 2025-01-19  
**Classification:** HACCP Compliance Document

---

## 1. Overview

This runbook provides step-by-step procedures for recovering FlowViz systems in disaster scenarios. It covers data restoration, service recovery, and compliance documentation requirements.

### Recovery Objectives

| Metric | Target | Maximum |
|--------|--------|---------|
| **RTO** (Recovery Time Objective) | 15 minutes | 1 hour |
| **RPO** (Recovery Point Objective) | 2 hours | 24 hours |
| **Data Retention** | 7 years | - |

### Contact Information

| Role | Contact | Escalation |
|------|---------|------------|
| On-Call Engineer | ops@flowviz.com | PagerDuty |
| Database Admin | dba@flowviz.com | Phone |
| HACCP Compliance | compliance@flowviz.com | Email |
| AWS Support | - | Console |

---

## 2. Disaster Scenarios

### 2.1 Database Corruption
**Symptoms:** Application errors, data inconsistency, failed queries  
**Recovery:** Point-in-time restore from backup

### 2.2 Complete Instance Failure
**Symptoms:** Database unreachable, connection timeouts  
**Recovery:** Restore to new instance from backup

### 2.3 Accidental Data Deletion
**Symptoms:** Missing records, truncated tables  
**Recovery:** Point-in-time restore with data verification

### 2.4 Ransomware/Security Breach
**Symptoms:** Encrypted files, unauthorized access detected  
**Recovery:** Restore from isolated backup, rotate all credentials

### 2.5 Regional AWS Outage
**Symptoms:** Multiple service failures in primary region  
**Recovery:** Failover to DR region

---

## 3. Pre-Recovery Checklist

Before initiating recovery:

- [ ] **Assess the situation** - Confirm disaster type and scope
- [ ] **Notify stakeholders** - Alert team leads and management
- [ ] **Document timeline** - Start incident log with timestamps
- [ ] **Identify latest backup** - Check S3 for most recent valid backup
- [ ] **Prepare target environment** - Ensure target infrastructure is ready
- [ ] **Have credentials ready** - GPG private key, database passwords

---

## 4. Recovery Procedures

### 4.1 Restore from Daily Backup

**Use when:** Data loss within last 24 hours, database corruption

```bash
# 1. List available daily backups
aws s3 ls s3://flowviz-backups/daily/ --recursive | sort -r | head -10

# 2. Identify the backup to restore (before corruption)
BACKUP_FILE="daily/flowviz_daily_YYYYMMDD_HHMMSS.dump.gpg"

# 3. Run restore script
cd /opt/flowviz/backend/scripts
./restore.sh "$BACKUP_FILE" flowviz

# 4. Verify restore
psql -U admin -d flowviz -c "SELECT COUNT(*) FROM lots;"
psql -U admin -d flowviz -c "SELECT MAX(created_at) FROM lots;"

# 5. Restart application services
docker compose restart api
```

**Expected Duration:** 10-30 minutes depending on database size

---

### 4.2 Restore from Weekly Backup

**Use when:** HACCP audit requirement, older data recovery needed

```bash
# 1. List available weekly backups
aws s3 ls s3://flowviz-backups/weekly/ --recursive | sort -r | head -10

# 2. Weekly backups may be in Glacier, check storage class
aws s3api head-object \
    --bucket flowviz-backups \
    --key weekly/flowviz_weekly_YYYYMMDD.dump.gpg

# 3. If in Glacier, initiate restore (wait 12-48 hours for Deep Archive)
aws s3api restore-object \
    --bucket flowviz-backups \
    --key weekly/flowviz_weekly_YYYYMMDD.dump.gpg \
    --restore-request '{"Days":7,"GlacierJobParameters":{"Tier":"Standard"}}'

# 4. Check restore status
aws s3api head-object \
    --bucket flowviz-backups \
    --key weekly/flowviz_weekly_YYYYMMDD.dump.gpg \
    | grep Restore

# 5. Once restored, run restore script
./restore.sh weekly/flowviz_weekly_YYYYMMDD.dump.gpg flowviz
```

**Expected Duration:** 12-48 hours for Glacier retrieval + 30 minutes restore

---

### 4.3 Restore to New Instance

**Use when:** Complete instance failure, migration to new infrastructure

```bash
# 1. Provision new PostgreSQL instance
docker run -d \
    --name flowviz_db_new \
    -e POSTGRES_USER=admin \
    -e POSTGRES_PASSWORD=<secure_password> \
    -e POSTGRES_DB=flowviz \
    -p 5433:5432 \
    postgres:17

# 2. Wait for database to be ready
docker exec flowviz_db_new pg_isready -U admin

# 3. Create required extensions
docker exec flowviz_db_new psql -U admin -d flowviz -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# 4. Run restore to new instance
DB_HOST=localhost DB_PORT=5433 ./restore.sh <backup_file> flowviz

# 5. Update application connection strings
# Edit docker-compose.yml or environment variables

# 6. Test connectivity
curl http://localhost:8000/api/v1/health
```

---

### 4.4 Cross-Region Failover

**Use when:** Regional AWS outage, DR scenario

```bash
# 1. Verify DR bucket has recent replicas
aws s3 ls s3://flowviz-backups-prod-us-west-2/daily/ \
    --region us-west-2 | sort -r | head -5

# 2. Provision infrastructure in DR region
cd infrastructure
terraform workspace select prod-dr
terraform apply -var="region=us-west-2"

# 3. Restore from DR bucket
S3_BUCKET=flowviz-backups-prod-us-west-2 \
    ./restore.sh daily/flowviz_daily_YYYYMMDD.dump.gpg flowviz

# 4. Update DNS to point to DR region
aws route53 change-resource-record-sets \
    --hosted-zone-id ZONE_ID \
    --change-batch file://dr-failover-dns.json

# 5. Verify service health
curl https://api.flowviz.com/health
```

---

## 5. Verification Procedures

After any restore, verify data integrity:

### 5.1 Basic Health Check

```bash
# Check table counts
psql -U admin -d flowviz -c "
    SELECT 
        'lots' as table_name, COUNT(*) FROM lots
    UNION ALL SELECT 
        'qc_decisions', COUNT(*) FROM qc_decisions
    UNION ALL SELECT 
        'users', COUNT(*) FROM users
    UNION ALL SELECT 
        'products', COUNT(*) FROM products;
"
```

### 5.2 HACCP Data Verification

```bash
# Verify traceability data
psql -U admin -d flowviz -c "
    SELECT 
        lot_code,
        created_at,
        updated_at
    FROM lots 
    ORDER BY created_at DESC 
    LIMIT 10;
"

# Verify QC records
psql -U admin -d flowviz -c "
    SELECT 
        decision_type,
        COUNT(*) 
    FROM qc_decisions 
    GROUP BY decision_type;
"
```

### 5.3 Application Connectivity Test

```bash
# Test API endpoints
curl -s http://localhost:8000/api/v1/health | jq
curl -s http://localhost:8000/api/v1/lots?limit=1 | jq
curl -s http://localhost:8000/api/v1/traceability/graph | jq
```

---

## 6. Post-Recovery Actions

### 6.1 Immediate (Within 1 Hour)

- [ ] Confirm all services operational
- [ ] Test critical user workflows
- [ ] Notify stakeholders of resolution
- [ ] Review any data gap (RPO impact)

### 6.2 Short-Term (Within 24 Hours)

- [ ] Complete incident report
- [ ] Review backup timing vs. incident
- [ ] Identify any lost transactions
- [ ] Update runbook if needed

### 6.3 Compliance (Within 7 Days)

- [ ] File HACCP incident report if food safety data affected
- [ ] Document any data gaps for regulatory review
- [ ] Review and update RTO/RPO targets if needed
- [ ] Schedule post-incident review meeting

---

## 7. HACCP Compliance Notes

### Data Retention Requirements

| Data Type | Retention Period | Storage Location |
|-----------|------------------|------------------|
| Lot tracking | 7 years | Weekly backups (Deep Archive) |
| QC decisions | 7 years | Weekly backups (Deep Archive) |
| Temperature logs | 7 years | Weekly backups (Deep Archive) |
| User audit logs | 3 years | Daily backups (Glacier) |

### Audit Trail Requirements

All recovery actions must be documented with:
- Timestamp (UTC)
- Operator name
- Backup file used
- Verification results
- Any data gaps identified

### Regulatory Contacts

For food safety incidents requiring regulatory notification:
- FDA: 1-866-300-4374
- State Department of Agriculture: [State-specific]

---

## 8. Troubleshooting

### GPG Decryption Fails

```bash
# Check if key is imported
gpg --list-keys backup@flowviz.com

# Import from Secrets Manager if missing
aws secretsmanager get-secret-value \
    --secret-id flowviz/backup/gpg-private-key \
    | jq -r '.SecretString' \
    | gpg --import
```

### pg_restore Errors

```bash
# If "database does not exist"
createdb -U admin flowviz

# If connection conflicts
psql -U admin -d postgres -c "
    SELECT pg_terminate_backend(pid) 
    FROM pg_stat_activity 
    WHERE datname = 'flowviz' AND pid <> pg_backend_pid();
"

# If permission errors
pg_restore --no-owner --no-privileges ...
```

### S3 Access Denied

```bash
# Check IAM role
aws sts get-caller-identity

# Verify bucket policy
aws s3api get-bucket-policy --bucket flowviz-backups
```

---

## 9. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-19 | DevOps | Initial version |

---

**End of Disaster Recovery Runbook**
