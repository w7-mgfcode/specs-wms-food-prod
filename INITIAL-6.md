# Phase 5 & 6: Production Readiness & Scale INITIAL Spec

> **Strategic Assessment:** Enterprise Architecture & Security Roadmap  
> **Date:** January 19, 2026  
> **Version:** 1.0  
> **Status:** SPECIFICATION (Post-Research)  
> **Phases:** 1-ANALYZE ✓, 2-BRAINSTORM ✓, 3-RESEARCH ✓, 4-SYNTHESIS ✓, 5-SPECIFICATION (This Document)

---

## FEATURE:

Build a production-ready, secure, and scalable Food Production WMS capable of operating in challenging factory floor environments with offline capability, comprehensive security controls, and enterprise-grade observability. The system must support 10k lots/day throughput, survive network outages without data loss, enforce role-based access control at the API layer, and maintain immutable audit trails for HACCP compliance.

This specification consolidates findings from comprehensive strategic analysis across security assessment, architecture evaluation, research validation, and synthesis into an actionable execution roadmap with immediate 2-week action items.

---

## EXECUTIVE SUMMARY (From Strategic Assessment)

### Current State (Phase 3 Complete)
- **Stack:** React 19, FastAPI (Python 3.13+), PostgreSQL 17, Valkey 8.1+
- **Migration:** Node/Express → FastAPI (strangler pattern, 60% complete)
- **Features:** First Flow UI, buffer lanes, 7 QC gates, lot genealogy tracking
- **Environment:** Development only (Docker Compose)

### Critical Findings
1. **Security Gaps (HIGH RISK):** No RBAC enforcement in backend, weak default secrets, no rate limiting
2. **Operational Vulnerability:** In-memory JWT + no offline mode = production downtime during network failures
3. **Compliance Exposure:** HACCP audit trails exist but backup/DR strategy unverified
4. **Type Safety Risk:** Manual frontend/backend type synchronization creates drift potential

### Strategic Direction (Validated via Research)
- **Phase 4 (Q1 2026, Weeks 1-10):** Security hardening + production pilot
- **Phase 5 (Q2 2026, Weeks 11-22):** Offline-first + type safety + scale
- **Phase 6 (Q3-Q4 2026, Conditional):** Multi-site + FDA compliance + IoT

---

## PHASE 4: PRODUCTION HARDENING (Immediate Priority)

### Week 1-2: Security Hardening

#### P4: RBAC Middleware Implementation
**Objective:** Enforce role-based access control at FastAPI endpoint level

**Implementation:**
```python
# backend/app/api/deps.py
from fastapi import Depends, HTTPException, Header, status
from app.services.auth import decode_access_token

async def require_role(*allowed_roles: str):
    """FastAPI dependency for role-based access control."""
    async def role_checker(
        authorization: str = Header(..., alias="Authorization"),
    ) -> dict:
        if not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header format",
            )
        
        token = authorization.replace("Bearer ", "")
        payload = decode_access_token(token)
        
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
        
        user_role = payload.get("role")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(allowed_roles)}",
                headers={"X-Required-Roles": ", ".join(allowed_roles)},
            )
        
        # Add audit log entry
        # await audit_log_access(payload["sub"], request.url.path)
        
        return payload
    
    return role_checker


# Usage in routes
@router.delete("/production-runs/{run_id}")
async def delete_production_run(
    run_id: str,
    current_user: dict = Depends(require_role("ADMIN", "MANAGER")),
    db: AsyncSession = Depends(get_db),
):
    """Only ADMIN and MANAGER can delete production runs."""
    # Implementation
    pass

@router.post("/lots")
async def create_lot(
    lot: LotCreate,
    current_user: dict = Depends(require_role("ADMIN", "MANAGER", "OPERATOR")),
    db: AsyncSession = Depends(get_db),
):
    """VIEWER role cannot create lots."""
    # Implementation
    pass
```

**Permission Matrix:**
| Endpoint | ADMIN | MANAGER | AUDITOR | OPERATOR | VIEWER |
|----------|-------|---------|---------|----------|--------|
| GET /lots | ✓ | ✓ | ✓ | ✓ | ✓ |
| POST /lots | ✓ | ✓ | ✗ | ✓ | ✗ |
| DELETE /lots | ✓ | ✗ | ✗ | ✗ | ✗ |
| POST /qc-decisions | ✓ | ✓ | ✓ | ✓ | ✗ |
| DELETE /production-runs | ✓ | ✓ | ✗ | ✗ | ✗ |
| GET /traceability/* | ✓ | ✓ | ✓ | ✓ | ✓ |

**Testing:**
```python
# backend/tests/test_rbac.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_operator_cannot_delete_runs(client: AsyncClient):
    """OPERATOR role should get 403 when attempting to delete."""
    # Login as OPERATOR
    login_resp = await client.post("/api/login", json={"email": "operator@test.com"})
    token = login_resp.json()["access_token"]
    
    # Attempt delete
    resp = await client.delete(
        "/api/v1/production-runs/test-run-id",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert resp.status_code == 403
    assert "Requires one of: ADMIN, MANAGER" in resp.json()["detail"]

@pytest.mark.asyncio
async def test_viewer_cannot_create_lots(client: AsyncClient):
    """VIEWER role should get 403 when attempting to create lots."""
    # Similar test pattern
    pass
```

**Deliverables:**
- [ ] `backend/app/api/deps.py`: RBAC dependency injection
- [ ] Update all routes in `backend/app/api/routes/` with role decorators
- [ ] Test coverage: `backend/tests/test_rbac.py` (100% endpoint coverage)
- [ ] ADR: `docs/decisions/0003-rbac-enforcement.md`

**Effort:** 5 days (1 backend engineer)

---

#### S3: Rate Limiting Implementation
**Objective:** Prevent brute-force attacks and API abuse

**Implementation:**
```python
# backend/app/main.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# Initialize limiter with Valkey backend
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.redis_url,
    strategy="fixed-window-elastic-expiry",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# In routes
from app.main import limiter

@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, credentials: LoginRequest):
    """Rate limit: 10 attempts per minute to prevent brute-force."""
    pass

@router.post("/lots")
@limiter.limit("100/minute")
async def create_lot(request: Request, lot: LotCreate):
    """Rate limit: 100 lot registrations per minute per IP."""
    pass
```

**Rate Limit Configuration:**
| Endpoint | Limit | Rationale |
|----------|-------|-----------|
| POST /login | 10/minute | Prevent brute-force attacks |
| POST /lots | 100/minute | Normal operation (1-2/sec) |
| POST /qc-decisions | 100/minute | Normal operation |
| GET /traceability/* | 50/minute | Prevent expensive query abuse |
| DELETE /* | 20/minute | Destructive operations |

**Deliverables:**
- [ ] Install SlowAPI: `pip install slowapi`
- [ ] Configure in `backend/app/main.py`
- [ ] Apply to all endpoints
- [ ] Test: `backend/tests/test_rate_limiting.py`

**Effort:** 3 days (1 backend engineer)

---

### Week 3-4: Infrastructure Foundation

#### S1: Secrets Management Migration
**Objective:** Move from environment variables to AWS Secrets Manager (or Vault)

**Option A: AWS Secrets Manager (if AWS deployment)**
```python
# backend/app/config.py
import boto3
from botocore.exceptions import ClientError
from functools import lru_cache
import json

@lru_cache
def get_secret(secret_name: str, region: str = "us-east-1") -> dict:
    """Fetch secret from AWS Secrets Manager (cached for performance)."""
    try:
        client = boto3.client('secretsmanager', region_name=region)
        response = client.get_secret_value(SecretId=secret_name)
        return json.loads(response['SecretString'])
    except ClientError as e:
        if settings.environment == "production":
            raise  # Fail hard in production
        else:
            # Fallback to env vars in dev
            return {}

class Settings(BaseSettings):
    environment: str = "development"
    
    @property
    def secret_key(self) -> str:
        if self.is_production:
            secrets = get_secret("flowviz/api")
            return secrets["secret_key"]
        return self._dev_secret_key
    
    @property
    def database_url(self) -> str:
        if self.is_production:
            secrets = get_secret("flowviz/database")
            return secrets["url"]
        return self._dev_database_url
    
    # Dev-only fallbacks
    _dev_secret_key: str = "INSECURE-DEV-ONLY-CHANGE-ME"
    _dev_database_url: str = "postgresql+asyncpg://admin:password@localhost:5432/flowviz"
```

**Option B: HashiCorp Vault (if on-premise or multi-cloud)**
```python
import hvac

@lru_cache
def get_vault_client() -> hvac.Client:
    client = hvac.Client(url=settings.vault_url)
    client.auth.approle.login(
        role_id=os.getenv("VAULT_ROLE_ID"),
        secret_id=os.getenv("VAULT_SECRET_ID"),
    )
    return client

def get_secret(path: str) -> dict:
    client = get_vault_client()
    secret = client.secrets.kv.v2.read_secret_version(path=path)
    return secret['data']['data']
```

**Secrets to Migrate:**
1. `SECRET_KEY` (JWT signing)
2. `DATABASE_URL` (PostgreSQL credentials)
3. `REDIS_URL` (Valkey credentials)
4. `SMTP_PASSWORD` (email notifications, if applicable)

**Deliverables:**
- [ ] Decision: AWS Secrets Manager vs Vault (based on deployment target)
- [ ] Update `backend/app/config.py`
- [ ] Create secrets in AWS/Vault (use Terraform/CloudFormation)
- [ ] Update deployment docs: `docs/SETUP.md`
- [ ] Test secret rotation (quarterly requirement)

**Effort:** 8 days (1 DevOps/backend engineer)

---

#### Infrastructure: PgBouncer Deployment
**Objective:** 10x connection capacity improvement (free performance win)

**Docker Compose Addition:**
```yaml
# backend/docker/docker-compose.yml
services:
  pgbouncer:
    image: edoburu/pgbouncer:1.21-p0
    container_name: flowviz_pgbouncer
    environment:
      - DATABASE_URL=postgres://admin:password@postgres:5432/flowviz
      - POOL_MODE=transaction
      - MAX_CLIENT_CONN=1000
      - DEFAULT_POOL_SIZE=25
      - RESERVE_POOL_SIZE=5
    ports:
      - "6432:5432"
    depends_on:
      - postgres
    networks:
      - flowviz_net

  # Update API service to use PgBouncer
  api:
    environment:
      - DATABASE_URL=postgresql+asyncpg://admin:password@pgbouncer:5432/flowviz
```

**Connection Pool Configuration:**
```python
# backend/app/database.py
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=25,  # Matches PgBouncer DEFAULT_POOL_SIZE
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600,  # Recycle connections every hour
)
```

**Deliverables:**
- [ ] Add PgBouncer to `docker-compose.yml`
- [ ] Update `DATABASE_URL` to point to PgBouncer
- [ ] Test: verify 1000+ concurrent connections supported
- [ ] Document in `docs/architecture.md`

**Effort:** 2 days (1 DevOps engineer)

---

### Week 5-7: Observability & Reliability

#### O1: Prometheus + Grafana Deployment
**Objective:** RED method monitoring (Rate, Errors, Duration) + business metrics

**Prometheus Metrics (FastAPI):**
```python
# backend/app/main.py
from prometheus_fastapi_instrumentator import Instrumentator

app = create_app()

# Instrument FastAPI with Prometheus
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# Custom business metrics
from prometheus_client import Counter, Histogram, Gauge

lots_registered_total = Counter(
    'lots_registered_total',
    'Total lots registered',
    ['lot_type', 'production_run']
)

qc_decisions_total = Counter(
    'qc_decisions_total',
    'Total QC decisions',
    ['decision', 'gate_number']
)

traceability_query_duration = Histogram(
    'traceability_query_duration_seconds',
    'Time spent processing traceability queries',
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
)

active_operators = Gauge(
    'active_operators',
    'Number of active operators (logged in last 15 min)'
)
```

**Docker Compose Services:**
```yaml
# backend/docker/docker-compose.yml
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: flowviz_prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - flowviz_net

  grafana:
    image: grafana/grafana:latest
    container_name: flowviz_grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources
    ports:
      - "3000:3000"
    depends_on:
      - prometheus
    networks:
      - flowviz_net

volumes:
  prometheus_data:
  grafana_data:
```

**Prometheus Configuration:**
```yaml
# backend/docker/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'fastapi'
    static_configs:
      - targets: ['api:8000']
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
```

**Grafana Dashboards:**
1. **Application Dashboard** (RED metrics)
   - Request rate (req/sec)
   - Error rate (%)
   - P50/P95/P99 latency
   - Top 10 slowest endpoints

2. **Business Dashboard**
   - Lots registered/hour (by type)
   - QC decisions (PASS/HOLD/FAIL rates)
   - Active operators
   - Production run throughput

3. **Infrastructure Dashboard**
   - CPU/Memory/Disk usage
   - Database connections
   - Cache hit rate
   - Network I/O

**Alerting Rules:**
```yaml
# backend/docker/prometheus-alerts.yml
groups:
  - name: critical
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} (>5%)"

      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical

      - alert: SlowTraceabilityQueries
        expr: histogram_quantile(0.95, traceability_query_duration_seconds) > 1
        for: 5m
        labels:
          severity: warning
```

**Deliverables:**
- [ ] Deploy Prometheus + Grafana in `docker-compose.yml`
- [ ] Instrument FastAPI with Prometheus metrics
- [ ] Create 3 Grafana dashboards (Application, Business, Infrastructure)
- [ ] Configure alerting rules
- [ ] Document: `docs/observability.md`

**Effort:** 10 days (1 DevOps engineer)

---

#### O2: Backup & Disaster Recovery
**Objective:** Automated PostgreSQL backups with tested restore procedure

**Backup Script:**
```bash
#!/bin/bash
# backend/scripts/backup.sh

set -e

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="flowviz"
DB_USER="admin"
DB_HOST="localhost"
DB_PORT="5433"

# Full backup with compression
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -Fc -f "$BACKUP_DIR/flowviz_$TIMESTAMP.dump" $DB_NAME

# Encrypt backup
gpg --encrypt --recipient backup@flowviz.com "$BACKUP_DIR/flowviz_$TIMESTAMP.dump"

# Upload to S3 (or Azure Blob)
aws s3 cp "$BACKUP_DIR/flowviz_$TIMESTAMP.dump.gpg" s3://flowviz-backups/

# Clean local backups older than 7 days
find $BACKUP_DIR -name "*.dump.gpg" -mtime +7 -delete

# Log success
echo "$(date): Backup completed successfully" >> /var/log/flowviz-backup.log
```

**Cron Schedule:**
```
# Daily backup at 2 AM UTC
0 2 * * * /opt/flowviz/scripts/backup.sh

# Weekly full backup retention (keep for 7 years for compliance)
0 3 * * 0 /opt/flowviz/scripts/backup-weekly.sh
```

**Restore Procedure:**
```bash
#!/bin/bash
# backend/scripts/restore.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file.dump.gpg>"
  exit 1
fi

# Download from S3
aws s3 cp "s3://flowviz-backups/$BACKUP_FILE" /tmp/

# Decrypt
gpg --decrypt "/tmp/$BACKUP_FILE" > "/tmp/restore.dump"

# Restore (terminates connections first)
psql -U admin -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'flowviz';"
pg_restore -h localhost -p 5433 -U admin -d flowviz -c -1 "/tmp/restore.dump"

# Verify record counts
psql -U admin -d flowviz -c "SELECT COUNT(*) FROM lots; SELECT COUNT(*) FROM qc_decisions;"

echo "Restore completed. Please validate data integrity."
```

**Quarterly Restore Test:**
```bash
# Test restore to separate database
createdb -U admin flowviz_restore_test
pg_restore -U admin -d flowviz_restore_test latest_backup.dump
# Run validation queries
# Drop test database
dropdb -U admin flowviz_restore_test
```

**Deliverables:**
- [ ] Backup script: `backend/scripts/backup.sh`
- [ ] Restore script: `backend/scripts/restore.sh`
- [ ] Cron job configuration
- [ ] S3 bucket (or Azure Blob) with lifecycle policy (7-year retention)
- [ ] Restore test procedure: `docs/runbooks/disaster-recovery.md`
- [ ] Test restore quarterly (calendar reminder)

**Effort:** 8 days (1 DevOps engineer)

---

### Week 8-9: Production Deployment

**Cloud Provider Selection Decision Required:**

#### Option A: AWS Deployment (Recommended)
```
VPC Setup:
├── Public Subnet (ALB, NAT Gateway)
├── Private Subnet (EC2 instances, RDS, ElastiCache)
└── Data Subnet (RDS PostgreSQL)

Services:
- EC2 (t3.medium): FastAPI + Celery ($35/month)
- RDS PostgreSQL (db.t3.medium): Primary database ($80/month)
- ElastiCache (Redis): Valkey replacement ($40/month)
- S3: Backups ($10/month for 7-year retention)
- ALB: Load balancer ($25/month)
- Secrets Manager: JWT secret, DB credentials ($1/month)
- CloudWatch: Logs + metrics ($20/month)

Total: ~$210/month
```

#### Option B: On-Premise VM Deployment
```
Hardware:
- 2x Ubuntu 22.04 VMs (16GB RAM, 4 vCPU each)
- 1x PostgreSQL server (32GB RAM, 8 vCPU, 2TB SSD)
- Reverse proxy (Nginx)

Software:
- Docker + Docker Compose
- Let's Encrypt (free TLS)
- Prometheus + Grafana (self-hosted)
- HashiCorp Vault (self-hosted)

Cost: Hardware only (no recurring cloud costs)
Complexity: Requires in-house ops expertise
```

**Load Testing (Week 9):**
```python
# backend/tests/load_test.py
import asyncio
import httpx
import time
from statistics import mean, median

async def create_lot(client: httpx.AsyncClient, token: str, lot_num: int):
    """Simulate lot registration."""
    start = time.time()
    resp = await client.post(
        "http://localhost:8000/api/v1/lots",
        json={
            "lot_code": f"TEST-{lot_num:08d}-LOAD-0001",
            "lot_type": "RAW",
            "weight_kg": 100.5,
            "temperature_c": 4.2,
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    duration = time.time() - start
    return resp.status_code, duration

async def load_test(total_requests: int = 20000, concurrency: int = 100):
    """Simulate 20k lots/day = ~1 lot every 4 seconds during 8-hour shift."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Login first
        login_resp = await client.post(
            "http://localhost:8000/api/login",
            json={"email": "load-test@flowviz.com"}
        )
        token = login_resp.json()["access_token"]
        
        # Run concurrent lot registrations
        results = []
        for batch in range(0, total_requests, concurrency):
            tasks = [
                create_lot(client, token, i)
                for i in range(batch, min(batch + concurrency, total_requests))
            ]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            results.extend(batch_results)
            
            # Rate limiting: 100 requests/batch with 5-second pause
            await asyncio.sleep(5)
        
        # Analyze results
        durations = [r[1] for r in results if isinstance(r, tuple) and r[0] == 201]
        errors = [r for r in results if not isinstance(r, tuple) or r[0] != 201]
        
        print(f"Total requests: {total_requests}")
        print(f"Successful: {len(durations)}")
        print(f"Failed: {len(errors)}")
        print(f"P50 latency: {median(durations):.3f}s")
        print(f"P95 latency: {sorted(durations)[int(len(durations) * 0.95)]:.3f}s")
        print(f"P99 latency: {sorted(durations)[int(len(durations) * 0.99)]:.3f}s")

if __name__ == "__main__":
    asyncio.run(load_test())
```

**Success Criteria:**
- [ ] 20k lots/day sustained (2x production target)
- [ ] P99 latency <500ms for lot registration
- [ ] P99 latency <500ms for traceability queries
- [ ] Error rate <0.1%
- [ ] Zero memory leaks (memory stable over 1-hour test)

**Deliverables:**
- [ ] Cloud provider decision documented
- [ ] Infrastructure provisioned (Terraform/CloudFormation scripts)
- [ ] SSL certificates configured (Let's Encrypt)
- [ ] Load testing results: `docs/parity/load-test-results.md`
- [ ] Production deployment checklist: `docs/deployment-checklist.md`

**Effort:** 10 days (1 DevOps + 1 Backend engineer)

---

### Week 10: Production Pilot Launch

**Pre-Launch Checklist:**
- [ ] Security: Penetration test completed (zero HIGH findings)
- [ ] Performance: Load test passed (20k lots/day)
- [ ] Reliability: Backup restore tested successfully
- [ ] Observability: Grafana dashboards operational
- [ ] Training: Operators completed 2-hour training session
- [ ] Rollback: Blue-green deployment configured
- [ ] Incident Response: Runbooks published in `docs/runbooks/`

**Shadow Mode (Days 1-3):**
- Run FastAPI and Node/Express in parallel
- Log requests to both systems
- Compare responses for parity
- Operators use new system, old system on standby

**Go-Live (Day 4):**
- Single production shift (8am-4pm)
- Engineering team on-call
- Real-time monitoring via Grafana
- Incident response ready

**Post-Launch Review (Day 5):**
- Analyze metrics: uptime, latency, error rate
- Collect operator feedback
- Document lessons learned
- Plan Phase 5 kickoff

---

## PHASE 5: SCALE & INTELLIGENCE (Q2 2026)

### Week 11-14: Offline-First Architecture (P1)

**Objective:** Service Workers + IndexedDB for offline lot registration + QC decisions

**Service Worker Implementation:**
```typescript
// flow-viz-react/public/service-worker.ts
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// Precache assets
precacheAndRoute(self.__WB_MANIFEST);

// Background sync for offline lot registrations
const bgSyncPlugin = new BackgroundSyncPlugin('lot-queue', {
  maxRetentionTime: 24 * 60, // Retry for 24 hours
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request.clone());
      } catch (error) {
        await queue.unshiftRequest(entry);
        throw error;
      }
    }
  },
});

// API caching strategy
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/v1/lots'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [bgSyncPlugin],
    networkTimeoutSeconds: 5,
  })
);

// Static assets
registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style',
  new StaleWhileRevalidate({ cacheName: 'static-cache' })
);
```

**IndexedDB Schema:**
```typescript
// flow-viz-react/src/lib/db.ts
import Dexie, { Table } from 'dexie';

export interface PendingLot {
  id: string;
  lot_code: string;
  lot_type: string;
  weight_kg: number;
  temperature_c: number;
  created_at: string;
  synced: boolean;
  retry_count: number;
}

export interface PendingQCDecision {
  id: string;
  lot_id: string;
  gate_id: string;
  decision: 'PASS' | 'HOLD' | 'FAIL';
  notes?: string;
  created_at: string;
  synced: boolean;
}

class FlowVizDB extends Dexie {
  pending_lots!: Table<PendingLot, string>;
  pending_qc_decisions!: Table<PendingQCDecision, string>;

  constructor() {
    super('flowviz');
    this.version(1).stores({
      pending_lots: 'id, synced, created_at',
      pending_qc_decisions: 'id, synced, created_at',
    });
  }
}

export const db = new FlowVizDB();
```

**React Query Offline Integration:**
```typescript
// flow-viz-react/src/lib/api/lots.ts
import { useMutation, useQuery } from '@tanstack/react-query';
import { db } from '../db';

export const useCreateLot = () => {
  return useMutation({
    mutationFn: async (lot: LotCreate) => {
      try {
        // Try network first
        const response = await fetch('/api/v1/lots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lot),
        });
        
        if (!response.ok) throw new Error('Network request failed');
        return await response.json();
      } catch (error) {
        // Save to IndexedDB for later sync
        const pendingLot = {
          id: crypto.randomUUID(),
          ...lot,
          created_at: new Date().toISOString(),
          synced: false,
          retry_count: 0,
        };
        
        await db.pending_lots.add(pendingLot);
        
        // Return optimistic response
        return { ...pendingLot, offline: true };
      }
    },
    onSuccess: (data) => {
      if (!data.offline) {
        // Network success: invalidate cache
        queryClient.invalidateQueries({ queryKey: ['lots'] });
      }
    },
  });
};

// Background sync hook
export const useSyncOfflineData = () => {
  const syncLots = async () => {
    const pending = await db.pending_lots.where('synced').equals(false).toArray();
    
    for (const lot of pending) {
      try {
        const response = await fetch('/api/v1/lots', {
          method: 'POST',
          body: JSON.stringify(lot),
        });
        
        if (response.ok) {
          await db.pending_lots.update(lot.id, { synced: true });
        } else {
          await db.pending_lots.update(lot.id, { 
            retry_count: lot.retry_count + 1 
          });
        }
      } catch (error) {
        console.error('Sync failed for lot:', lot.id, error);
      }
    }
  };
  
  useEffect(() => {
    const interval = setInterval(syncLots, 30000); // Every 30 seconds
    window.addEventListener('online', syncLots);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', syncLots);
    };
  }, []);
};
```

**Testing Offline Scenarios:**
```typescript
// flow-viz-react/src/tests/offline.test.ts
import { render, screen, fireEvent } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { LotRegistrationForm } from '../components/LotRegistrationForm';

const server = setupServer(
  rest.post('/api/v1/lots', (req, res, ctx) => {
    return res(ctx.status(201), ctx.json({ id: '123', lot_code: 'TEST-001' }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('saves lot to IndexedDB when offline', async () => {
  // Simulate offline
  server.use(
    rest.post('/api/v1/lots', (req, res) => {
      return res.networkError('Failed to connect');
    })
  );
  
  render(<LotRegistrationForm />);
  
  fireEvent.change(screen.getByLabelText('Lot Code'), {
    target: { value: 'TEST-001' },
  });
  fireEvent.change(screen.getByLabelText('Weight (kg)'), {
    target: { value: '100' },
  });
  fireEvent.click(screen.getByText('Register Lot'));
  
  // Verify saved to IndexedDB
  const pending = await db.pending_lots.toArray();
  expect(pending).toHaveLength(1);
  expect(pending[0].lot_code).toBe('TEST-001');
  expect(pending[0].synced).toBe(false);
});

test('syncs lots when back online', async () => {
  // Add pending lot
  await db.pending_lots.add({
    id: 'offline-1',
    lot_code: 'OFFLINE-001',
    synced: false,
    retry_count: 0,
  });
  
  render(<App />);
  
  // Trigger sync
  fireEvent.click(screen.getByText('Sync Offline Data'));
  
  // Wait for sync
  await waitFor(() => {
    expect(screen.getByText('Sync complete')).toBeInTheDocument();
  });
  
  // Verify synced
  const lot = await db.pending_lots.get('offline-1');
  expect(lot.synced).toBe(true);
});
```

**Deliverables:**
- [ ] Service Worker: `flow-viz-react/public/service-worker.ts`
- [ ] IndexedDB setup: `flow-viz-react/src/lib/db.ts`
- [ ] Offline-aware hooks: Update `flow-viz-react/src/lib/api/`
- [ ] Sync UI indicator: Show pending count, sync status
- [ ] E2E tests: `flow-viz-react/src/tests/offline.e2e.ts`
- [ ] Documentation: `docs/offline-mode.md`

**Effort:** 12 days (1-2 frontend engineers)

---

### Week 15-18: Type-Safe API Client (P5)

**Objective:** Auto-generate TypeScript client from FastAPI OpenAPI spec using Orval

**OpenAPI Schema Stabilization:**
```python
# backend/app/main.py
app = FastAPI(
    title="FlowViz WMS API",
    version="1.0.0",
    description="Food Production Warehouse Management System",
    openapi_tags=[
        {"name": "lots", "description": "Lot registration and retrieval"},
        {"name": "qc", "description": "Quality control decisions"},
        {"name": "traceability", "description": "Lot genealogy and recall"},
        {"name": "production", "description": "Production run management"},
        {"name": "auth", "description": "Authentication"},
    ],
)

# Export OpenAPI spec
@app.get("/openapi.json", include_in_schema=False)
async def get_openapi_spec():
    return app.openapi()
```

**Orval Configuration:**
```typescript
// flow-viz-react/orval.config.ts
import { defineConfig } from 'orval';

export default defineConfig({
  flowviz: {
    input: 'http://localhost:8000/openapi.json',
    output: {
      target: './src/lib/api/generated.ts',
      client: 'react-query',
      mode: 'tags-split',
      override: {
        mutator: {
          path: './src/lib/api/client.ts',
          name: 'customClient',
        },
      },
    },
    hooks: {
      afterAllFilesWrite: 'prettier --write',
    },
  },
});
```

**Custom Client (with Auth):**
```typescript
// flow-viz-react/src/lib/api/client.ts
import Axios, { AxiosRequestConfig } from 'axios';

export const AXIOS_INSTANCE = Axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// Add auth token to requests
AXIOS_INSTANCE.interceptors.request.use((config) => {
  const token = getAuthToken(); // From auth store
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const customClient = <T>(
  config: AxiosRequestConfig,
): Promise<T> => {
  const source = Axios.CancelToken.source();
  const promise = AXIOS_INSTANCE({
    ...config,
    cancelToken: source.token,
  }).then(({ data }) => data);

  // @ts-ignore
  promise.cancel = () => {
    source.cancel('Query was cancelled');
  };

  return promise;
};
```

**CI Pipeline Integration:**
```yaml
# .github/workflows/frontend-codegen.yml
name: Frontend Codegen

on:
  push:
    branches: [main, develop]
    paths:
      - 'backend/app/schemas/**'
      - 'backend/app/api/routes/**'

jobs:
  codegen:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Start FastAPI backend
        run: |
          cd backend
          docker-compose up -d
          sleep 10  # Wait for API to start
      
      - name: Generate TypeScript client
        run: |
          cd flow-viz-react
          npm install
          npm run codegen
      
      - name: Commit generated code
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add flow-viz-react/src/lib/api/generated.ts
          git commit -m "chore: regenerate API client" || echo "No changes"
          git push
```

**Usage in Components:**
```typescript
// flow-viz-react/src/components/LotList.tsx
import { useGetApiV1Lots } from '../lib/api/generated';

export const LotList = () => {
  const { data, isLoading, error } = useGetApiV1Lots({
    query: {
      staleTime: 30000, // 30 seconds
    },
  });
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <ul>
      {data?.map((lot) => (
        <li key={lot.id}>{lot.lot_code}</li>
      ))}
    </ul>
  );
};
```

**Deliverables:**
- [ ] Install Orval: `npm install -D orval`
- [ ] Configuration: `flow-viz-react/orval.config.ts`
- [ ] CI pipeline: `.github/workflows/frontend-codegen.yml`
- [ ] Update all API calls to use generated client
- [ ] Remove manual TypeScript types
- [ ] Documentation: `docs/api-client-generation.md`

**Effort:** 8 days (1-2 frontend engineers)

---

## DEPENDENCIES

### Infrastructure
- **Cloud Provider:** AWS (recommended) or on-premise VMs
- **Secrets Management:** AWS Secrets Manager or HashiCorp Vault
- **Monitoring:** Prometheus + Grafana + Alertmanager
- **Load Balancer:** AWS ALB or Nginx reverse proxy

### Backend Services
- **PostgreSQL 17:** Primary database with PgBouncer connection pooling
- **Valkey 8.1+:** Cache + Celery task queue + rate limiting storage
- **FastAPI 0.125+:** Python 3.13 web framework
- **SQLAlchemy 2.0:** Async ORM
- **Celery 5.4+:** Background task processing

### Frontend Services
- **React 19:** UI framework
- **Vite 6:** Build tool
- **TypeScript 5.7:** Type safety
- **React Query v5:** Server state management with offline support
- **Workbox:** Service Worker toolkit for offline capability
- **Dexie.js:** IndexedDB wrapper

### Security Tools
- **SlowAPI:** Rate limiting for FastAPI
- **Bcrypt:** Password hashing
- **Python-jose:** JWT token generation/validation
- **Bandit:** Python SAST scanner
- **Trivy:** Container vulnerability scanner
- **Gitleaks:** Secret detection

---

## SYSTEM PROMPT (For AI-Assisted Development)

You are a senior software engineer implementing a production-ready Food Production WMS with the following priorities:

**Security First:**
- All API endpoints must have RBAC enforcement using FastAPI dependencies
- Secrets NEVER in code or environment variables (use Secrets Manager)
- Rate limiting on all endpoints (use SlowAPI)
- Audit logs for all data modifications (immutable tables)

**Offline Capability:**
- Use Service Workers + IndexedDB for offline lot registration
- Implement optimistic UI updates
- Background sync when network restored
- Never lose data during network outages

**Type Safety:**
- Use Orval to generate TypeScript client from OpenAPI spec
- No manual type definitions
- CI pipeline regenerates client on schema changes

**Observability:**
- Instrument all endpoints with Prometheus metrics
- Create Grafana dashboards for RED metrics + business KPIs
- Configure alerts for critical thresholds
- Log structured JSON for easy parsing

**Testing:**
- Unit tests for business logic (>80% coverage)
- Integration tests for API endpoints (characterization tests)
- E2E tests for critical flows (Playwright)
- Load testing at 2x capacity (20k lots/day)

**Documentation:**
- ADRs for all architectural decisions
- Runbooks for operational procedures
- API documentation auto-generated from OpenAPI
- Update docs with every PR

When implementing features, always consider:
1. How does this work offline?
2. What role can access this?
3. How do we monitor this?
4. What happens if this fails?
5. Is this HACCP compliant?

---

## EXAMPLES

### Security Examples
- `backend/app/api/deps.py` - RBAC dependency injection
- `backend/app/services/auth.py` - JWT token handling
- `backend/tests/test_rbac.py` - Permission testing

### Offline Examples
- `flow-viz-react/public/service-worker.ts` - Service Worker setup
- `flow-viz-react/src/lib/db.ts` - IndexedDB schema
- `flow-viz-react/src/tests/offline.test.ts` - Offline testing

### Observability Examples
- `backend/app/main.py` - Prometheus instrumentation
- `backend/docker/prometheus.yml` - Scrape configuration
- `backend/docker/grafana/dashboards/` - Dashboard JSON

---

## DOCUMENTATION

### Internal Documentation
- `CLAUDE.md` - AI coding guidance (674 lines)
- `README.md` - Project overview
- `CONTRIBUTING.md` - Phase-based workflow
- `docs/architecture.md` - System design (315 lines)
- `docs/decisions/` - Architecture Decision Records
- `docs/parity/performance.md` - Performance baselines
- `docs/SETUP.md` - Development environment setup

### External Documentation
- FastAPI: https://fastapi.tiangolo.com/
- React Query: https://tanstack.com/query/latest
- Workbox: https://developer.chrome.com/docs/workbox
- Prometheus: https://prometheus.io/docs/
- PostgreSQL: https://www.postgresql.org/docs/17/

---

## OTHER CONSIDERATIONS

### Immediate Action Items (Next 2 Weeks)

**Week 1 (Jan 20-26, 2026):**
- [ ] Day 1-2: RBAC middleware implementation (`backend/app/api/deps.py`)
- [ ] Day 3: Apply RBAC to all routes (`backend/app/api/routes/`)
- [ ] Day 4-5: Rate limiting setup (SlowAPI + Valkey)

**Week 2 (Jan 27 - Feb 2, 2026):**
- [ ] Day 1-2: Secrets management decision (AWS vs Vault)
- [ ] Day 3-4: Secrets migration (`backend/app/config.py`)
- [ ] Day 5: PgBouncer deployment (`docker-compose.yml`)

### Critical Decisions (Require Stakeholder Input)

| Decision | Options | Deadline | Impact |
|----------|---------|----------|--------|
| **Cloud Provider** | AWS, Azure, GCP, On-Premise | Week 1 | Determines secrets management tool |
| **FDA 21 CFR Part 11** | Required or Optional | Week 3 | Adds 6-8 weeks for tamper-evident logs |
| **Wi-Fi Reliability** | Measure for 2 weeks | Week 5 | Determines offline priority |
| **Site #2 Timeline** | <6 months or >12 months | Week 10 | Multi-site architecture decision |
| **IoT Vendor** | List scale/sensor models | Week 10 | Protocol support (MQTT, Modbus, RS-232) |

### Risk Mitigation

**Risk: Timeline Pressure (Pilot deadline <6 weeks)**
- **Fallback:** Minimal MVP (security only, no offline/codegen)
- **Trigger:** Regulatory audit scheduled before Q2 2026

**Risk: Team Capacity Reduced (<3 engineers)**
- **Fallback:** Defer offline mode to Phase 6
- **Trigger:** Engineer turnover or sick leave

**Risk: Budget Constraint (<$500/month)**
- **Fallback:** On-premise VM deployment (no cloud costs)
- **Trigger:** CFO budget review

### Success Metrics (Phase 4 Complete)

**Technical:**
- [ ] API uptime: 99.5% during pilot week
- [ ] P99 latency: <500ms for all endpoints
- [ ] Security: Zero HIGH-risk findings in pen-test
- [ ] Load test: 20k lots/day sustained

**Business:**
- [ ] Operator satisfaction: <10 bugs/week reported
- [ ] Lot registration time: <60 seconds (down from 90)
- [ ] Mock recall speed: <4 hours (regulatory requirement)

**Operational:**
- [ ] Deployment frequency: 1x/week (automated)
- [ ] MTTR: <1 hour (incident response)
- [ ] Documentation: 95% complete (ADRs + runbooks)

---

## CONCLUSION

This specification provides a comprehensive, actionable roadmap for Phases 4-6 based on rigorous strategic analysis. The immediate priority is **security hardening** (RBAC, secrets, rate limiting) before production launch, followed by **offline capability** and **type safety** in Phase 5.

**Key Success Factors:**
1. Execute Phase 4 security items before ANY production deployment
2. Make cloud provider decision by Week 1 (impacts secrets management)
3. Measure Wi-Fi reliability by Week 5 (determines offline priority)
4. Load test at 2x capacity (20k lots/day) before go-live
5. Quarterly backup restore tests (compliance requirement)

**Next Steps:**
1. Review this spec with engineering team (1-hour meeting)
2. Assign owners to Week 1-2 action items
3. Schedule cloud provider decision meeting (stakeholders)
4. Begin RBAC middleware implementation (Day 1)
5. Create Phase 4 epic in project management tool

---

**Document Version:** 1.0  
**Last Updated:** January 19, 2026  
**Approved By:** [Pending]  
**Next Review:** End of Phase 4 (Week 10)
