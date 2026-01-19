# Infrastructure & Observability: PgBouncer + Prometheus + Grafana

> **Phase:** 4.2a - Connection Pooling & Monitoring  
> **Sprint:** Week 3-5  
> **Priority:** HIGH (Required for production readiness)  
> **Date:** January 19, 2026  
> **Version:** 1.0  
> **Prerequisite:** INITIAL-6.md (Security Hardening)

---

## FEATURE:

Build production-grade connection pooling and observability infrastructure for the Food Production WMS:

1. **PgBouncer Connection Pooling:** Deploy PgBouncer for 10x connection capacity improvement, enabling the FastAPI backend to handle 1000+ concurrent connections while protecting PostgreSQL from connection exhaustion.

2. **Prometheus + Grafana Observability:** Implement the RED method (Rate, Errors, Duration) monitoring with custom business metrics for lot registration, QC decisions, and production run throughput. Includes alerting for critical thresholds.

**Success Criteria:**
- Connection pool supports 1000+ concurrent clients
- Grafana dashboards operational with RED metrics + business KPIs
- Alerting configured for critical thresholds (error rate >5%, latency >1s)
- P99 latency <500ms under load

---

## TOOLS:

- **Instrumentator().instrument(app).expose(app, endpoint="/metrics")**: Prometheus FastAPI instrumentation. Auto-generates HTTP request metrics (count, latency histograms, status codes).

- **Counter(name, description, labels)**: Prometheus counter for monotonically increasing values. Use for `lots_registered_total`, `qc_decisions_total`, `login_attempts_total`.

- **Histogram(name, description, buckets)**: Prometheus histogram for latency distributions. Use for `traceability_query_duration_seconds` with buckets [0.1, 0.25, 0.5, 1.0, 2.5, 5.0].

- **Gauge(name, description)**: Prometheus gauge for values that go up or down. Use for `active_operators`, `pending_lots_offline`, `connection_pool_size`.

---

## DEPENDENCIES:

### Docker Images
```yaml
services:
  pgbouncer:
    image: edoburu/pgbouncer:1.21-p0
  
  prometheus:
    image: prom/prometheus:v2.50.0
  
  grafana:
    image: grafana/grafana:10.3.1
  
  node-exporter:
    image: prom/node-exporter:v1.7.0
  
  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:v0.15.0
```

### Python Packages
```toml
# backend/pyproject.toml additions
[project.dependencies]
prometheus-fastapi-instrumentator = "^6.1.0"
prometheus-client = "^0.20.0"
```

---

## SYSTEM PROMPT(S):

### Connection Pooling & Observability Prompt
```
You are implementing production infrastructure for a Food Production WMS with HACCP compliance.

**Connection Pooling (PgBouncer):**
- Use transaction pooling mode for short-lived connections
- Set pool_size to match expected concurrent API workers
- Configure reserve_pool for burst handling
- Enable server_reset_query to clean connection state
- Monitor pool saturation via metrics

**Observability (Prometheus + Grafana):**
- Follow RED method: Rate, Errors, Duration for every service
- Add business metrics: lots/hour, QC decisions, active operators
- Use meaningful labels but avoid high cardinality (no lot_code labels)
- Set up alerts for SLO violations (99.5% availability, P99 <500ms)
- Dashboard hierarchy: Infrastructure → Application → Business
```

### Monitoring Playbook
```
When responding to alerts:

HIGH ERROR RATE (>5% for 2 minutes):
1. Check Grafana → Application Dashboard → Error Rate panel
2. Identify affected endpoints via Top Errors panel
3. Check recent deployments via git log
4. Review application logs for stack traces
5. Escalate to on-call if unresolved in 15 minutes

DATABASE CONNECTION ISSUES:
1. Check PgBouncer metrics: active connections, waiting clients
2. Verify PostgreSQL is responding: pg_isready -h localhost -p 5432
3. Check for long-running queries: SELECT * FROM pg_stat_activity
4. Restart PgBouncer if pool is corrupted: docker restart flowviz_pgbouncer
```

---

## IMPLEMENTATION:

### PgBouncer Connection Pooling

**Objective:** 10x connection capacity improvement for horizontal scaling

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
      - RESERVE_POOL_TIMEOUT=3
      - SERVER_RESET_QUERY=DISCARD ALL
      - LOG_CONNECTIONS=1
      - LOG_DISCONNECTIONS=1
      - STATS_PERIOD=60
    ports:
      - "6432:5432"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - flowviz_net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "pg_isready", "-h", "localhost", "-p", "5432"]
      interval: 10s
      timeout: 5s
      retries: 3

  api:
    environment:
      # Point to PgBouncer instead of direct PostgreSQL
      - DATABASE_URL=postgresql+asyncpg://admin:password@pgbouncer:5432/flowviz
    depends_on:
      pgbouncer:
        condition: service_healthy
```

**SQLAlchemy Configuration:**
```python
# backend/app/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=25,           # Matches PgBouncer DEFAULT_POOL_SIZE
    max_overflow=10,        # Extra connections during burst
    pool_pre_ping=True,     # Verify connection health before use
    pool_recycle=3600,      # Recycle connections every hour
    pool_timeout=30,        # Wait up to 30s for available connection
)

async_session_maker = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def get_db() -> AsyncSession:
    """FastAPI dependency for database sessions."""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()
```

**PgBouncer Monitoring:**
```sql
-- Connect to PgBouncer admin console
-- psql -h localhost -p 6432 -U admin pgbouncer

SHOW POOLS;    -- Pool statistics
SHOW CLIENTS;  -- Client connections
SHOW SERVERS;  -- Server connections  
SHOW STATS;    -- Aggregated stats
```

---

### Prometheus + Grafana Observability

**Objective:** RED method monitoring + business metrics + alerting

**FastAPI Instrumentation:**
```python
# backend/app/main.py
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Counter, Histogram, Gauge

app = create_app()

# Auto-instrument with Prometheus
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# Custom business metrics
lots_registered_total = Counter(
    'flowviz_lots_registered_total',
    'Total lots registered in the system',
    ['lot_type', 'production_run']
)

qc_decisions_total = Counter(
    'flowviz_qc_decisions_total',
    'Total QC decisions made',
    ['decision', 'gate_number']
)

traceability_query_duration = Histogram(
    'flowviz_traceability_query_duration_seconds',
    'Time spent processing traceability queries',
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

active_operators = Gauge(
    'flowviz_active_operators',
    'Number of operators active in last 15 minutes'
)

# Usage in routes
@router.post("/lots")
async def create_lot(lot: LotCreate, ...):
    lots_registered_total.labels(
        lot_type=lot.lot_type,
        production_run=lot.production_run_id or "none"
    ).inc()
    return created_lot

@router.get("/traceability/{lot_id}")
async def get_traceability(lot_id: str, ...):
    with traceability_query_duration.time():
        return genealogy
```

**Docker Compose Services:**
```yaml
# backend/docker/docker-compose.yml
services:
  prometheus:
    image: prom/prometheus:v2.50.0
    container_name: flowviz_prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./prometheus-alerts.yml:/etc/prometheus/alerts.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
      - '--web.enable-lifecycle'
    ports:
      - "9090:9090"
    networks:
      - flowviz_net

  grafana:
    image: grafana/grafana:10.3.1
    container_name: flowviz_grafana
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-admin}
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning/dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./grafana/provisioning/datasources:/etc/grafana/provisioning/datasources:ro
    ports:
      - "3001:3000"
    depends_on:
      - prometheus
    networks:
      - flowviz_net

  node-exporter:
    image: prom/node-exporter:v1.7.0
    container_name: flowviz_node_exporter
    ports:
      - "9100:9100"
    networks:
      - flowviz_net

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:v0.15.0
    container_name: flowviz_postgres_exporter
    environment:
      - DATA_SOURCE_NAME=postgresql://admin:password@postgres:5432/flowviz?sslmode=disable
    ports:
      - "9187:9187"
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

rule_files:
  - /etc/prometheus/alerts.yml

scrape_configs:
  - job_name: 'fastapi'
    static_configs:
      - targets: ['api:8000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
```

**Alerting Rules:**
```yaml
# backend/docker/prometheus-alerts.yml
groups:
  - name: flowviz_critical
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) 
          / sum(rate(http_requests_total[5m])) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical

      - alert: PgBouncerPoolExhausted
        expr: pgbouncer_pools_client_waiting > 10
        for: 2m
        labels:
          severity: warning

  - name: flowviz_performance
    rules:
      - alert: HighLatency
        expr: |
          histogram_quantile(0.99, 
            rate(http_request_duration_seconds_bucket[5m])
          ) > 0.5
        for: 5m
        labels:
          severity: warning

  - name: flowviz_business
    rules:
      - alert: HighQCFailureRate
        expr: |
          sum(rate(flowviz_qc_decisions_total{decision="FAIL"}[1h]))
          / sum(rate(flowviz_qc_decisions_total[1h])) > 0.1
        for: 1h
        labels:
          severity: warning
```

---

## EXAMPLES:

### Existing Project Examples
- `backend/app/database.py` - Current SQLAlchemy configuration
- `backend/docker/docker-compose.yml` - Docker service definitions

### Reference Implementations
- Prometheus FastAPI Instrumentator: https://github.com/trallnag/prometheus-fastapi-instrumentator
- PgBouncer Configuration: https://www.pgbouncer.org/config.html
- Grafana Dashboard Examples: https://grafana.com/grafana/dashboards/

---

## DOCUMENTATION:

- Prometheus: https://prometheus.io/docs/
- Grafana: https://grafana.com/docs/grafana/latest/
- PgBouncer: https://www.pgbouncer.org/

---

## OTHER CONSIDERATIONS:

### Action Items (Week 3-5)

**Week 3 (Feb 3-7, 2026):**
- [ ] Deploy PgBouncer to docker-compose.yml
- [ ] Update DATABASE_URL to use PgBouncer
- [ ] Load test connection pool at 1000 concurrent

**Week 4 (Feb 10-14, 2026):**
- [ ] Add Prometheus + Grafana to docker-compose.yml
- [ ] Instrument FastAPI with business metrics
- [ ] Create 3 Grafana dashboards (Application, Business, Infrastructure)

**Week 5 (Feb 17-21, 2026):**
- [ ] Configure alerting rules
- [ ] Set up alert notifications (email, Slack)
- [ ] Document observability in `docs/observability.md`

### Deliverables Checklist

- [ ] `backend/docker/docker-compose.yml` - PgBouncer + Prometheus + Grafana
- [ ] `backend/docker/prometheus.yml` - Prometheus scrape configuration
- [ ] `backend/docker/prometheus-alerts.yml` - Alerting rules
- [ ] `backend/docker/grafana/` - Dashboard provisioning files
- [ ] `backend/app/main.py` - Prometheus instrumentation
- [ ] `docs/observability.md` - Monitoring guide

**Effort Estimate:** 9 days (1 DevOps engineer + 0.5 backend engineer)

---

**Document Version:** 1.0  
**Phase:** 4.2a - Connection Pooling & Monitoring  
**Last Updated:** January 19, 2026  
**Previous Phase:** INITIAL-6.md (Security Hardening)  
**Next Part:** INITIAL-7b.md (Backup & Disaster Recovery)
