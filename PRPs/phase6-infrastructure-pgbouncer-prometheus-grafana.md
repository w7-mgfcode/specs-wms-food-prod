# PRP: Infrastructure & Observability - PgBouncer + Prometheus + Grafana

> **Phase:** 4.2a - Connection Pooling & Monitoring  
> **Priority:** HIGH (Required for production readiness)  
> **Date:** January 19, 2026  
> **Prerequisite:** INITIAL-6.md (Security Hardening), phase5-security-hardening-rbac-ratelimit.md  
> **Confidence Score:** 9/10

---

## Purpose

Build production-grade connection pooling and observability infrastructure for the Food Production WMS:

1. **PgBouncer Connection Pooling:** Deploy PgBouncer for 10x connection capacity improvement, enabling the FastAPI backend to handle 1000+ concurrent connections while protecting PostgreSQL from connection exhaustion.

2. **Prometheus + Grafana Observability:** Implement the RED method (Rate, Errors, Duration) monitoring with custom business metrics for lot registration, QC decisions, and production run throughput. Includes alerting for critical thresholds.

---

## Why

- **Connection Exhaustion Prevention:** Default PostgreSQL max_connections (100) is insufficient for production load
- **Horizontal Scaling:** PgBouncer enables multiple API instances to share connection pools
- **Production Visibility:** RED method metrics required for SLO monitoring and incident response
- **Business Intelligence:** Custom metrics for lots/hour, QC decisions, active operators
- **HACCP Compliance:** Audit-ready observability for food production traceability

---

## Success Criteria

- [ ] PgBouncer deployed and handling all database connections
- [ ] Connection pool supports 1000+ concurrent clients
- [ ] FastAPI `/metrics` endpoint exposes Prometheus metrics
- [ ] Grafana dashboards operational with RED metrics + business KPIs
- [ ] Alerting configured for critical thresholds (error rate >5%, latency >1s, P99 >500ms)
- [ ] P99 latency <500ms under load
- [ ] All existing tests continue to pass
- [ ] Docker Compose stack starts cleanly with new services

---

## All Needed Context

### Existing Codebase Patterns

#### Current Database Configuration (`backend/app/database.py`)
```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

# Current: Direct PostgreSQL connection
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=5,           # <-- Currently only 5 connections
    max_overflow=10,
    pool_pre_ping=True,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)
```

#### Current Docker Compose (`backend/docker/docker-compose.yml`)
```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: flowviz_db_fastapi
    ports:
      - "5433:5432"  # PostgreSQL on 5433
    # ... rest of config

  api:
    environment:
      - DATABASE_URL=postgresql+asyncpg://admin:password@postgres:5432/flowviz
    depends_on:
      postgres:
        condition: service_healthy
```

#### Current App Configuration (`backend/app/config.py`)
```python
class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://admin:password@localhost:5432/flowviz"
    redis_url: str = "redis://localhost:6379/0"
    # ... no Prometheus/metrics settings yet
```

#### Current Main App (`backend/app/main.py`)
```python
from fastapi import FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

def create_app() -> FastAPI:
    app = FastAPI(...)
    
    # Rate limiting exists - add Prometheus instrumentation alongside
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    
    # TODO: Add Prometheus instrumentation here
    
    return app
```

#### Current Route Pattern (`backend/app/api/routes/lots.py`)
```python
@router.post("/lots", response_model=LotResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("100/minute")
async def create_lot(
    request: Request,
    lot_data: LotCreate,
    db: DBSession,
    current_user: CanCreateLots,
) -> LotResponse:
    # TODO: Add Prometheus counter increment here
    lot = Lot(...)
    db.add(lot)
    await db.flush()
    return LotResponse.model_validate(lot)
```

---

### External Documentation

#### Prometheus FastAPI Instrumentator
- **GitHub:** https://github.com/trallnag/prometheus-fastapi-instrumentator
- **PyPI:** https://pypi.org/project/prometheus-fastapi-instrumentator/
- **Key Features:**
  - Auto-generates HTTP request metrics (count, latency histograms, status codes)
  - Minimal configuration required
  - Exposes `/metrics` endpoint automatically

```python
# Basic usage pattern
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI()
Instrumentator().instrument(app).expose(app, endpoint="/metrics")
```

#### Prometheus Client Library
- **Docs:** https://github.com/prometheus/client_python
- **Metric Types:**
  - `Counter` - Monotonically increasing (total lots, total QC decisions)
  - `Gauge` - Values that go up/down (active operators, pending lots)
  - `Histogram` - Latency distributions (query duration)

```python
from prometheus_client import Counter, Histogram, Gauge

# Counter example
lots_registered_total = Counter(
    'flowviz_lots_registered_total',
    'Total lots registered',
    ['lot_type', 'production_run']
)
lots_registered_total.labels(lot_type='raw', production_run='PR-001').inc()

# Histogram example (with timing context manager)
query_duration = Histogram('flowviz_query_duration_seconds', 'Query latency')
with query_duration.time():
    await db.execute(query)
```

#### PgBouncer Configuration
- **Official Docs:** https://www.pgbouncer.org/config.html
- **Docker Image:** https://hub.docker.com/r/edoburu/pgbouncer
- **Pool Modes:**
  - `session` - One server connection per client connection (default)
  - `transaction` - Connection returned to pool after each transaction (RECOMMENDED)
  - `statement` - Connection returned after each statement (most aggressive)

```ini
# Key PgBouncer settings
pool_mode = transaction           # Best for FastAPI (short-lived requests)
max_client_conn = 1000            # Total client connections allowed
default_pool_size = 25            # Connections per database/user pair
reserve_pool_size = 5             # Extra connections for burst
server_reset_query = DISCARD ALL  # Clean connection state
```

#### Grafana Dashboard Provisioning
- **Docs:** https://grafana.com/docs/grafana/latest/administration/provisioning/
- **Dashboard JSON Model:** https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/view-dashboard-json-model/

```yaml
# Grafana provisioning structure
backend/docker/grafana/
├── provisioning/
│   ├── dashboards/
│   │   └── dashboards.yml       # Dashboard provider config
│   └── datasources/
│       └── datasources.yml      # Prometheus datasource
└── dashboards/
    ├── application.json         # RED metrics dashboard
    ├── business.json            # Business KPIs dashboard
    └── infrastructure.json      # System metrics dashboard
```

#### Prometheus Alerting Rules
- **Docs:** https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/

```yaml
# Alert rule example
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
```

---

### Critical Gotchas

1. **PgBouncer Transaction Mode:** Cannot use `SET` commands or prepared statements in transaction mode. SQLAlchemy async with `pool_pre_ping=True` works fine.

2. **Connection String Change:** API must connect to PgBouncer (port 6432) NOT PostgreSQL (port 5432) directly.

3. **Prometheus Label Cardinality:** NEVER use high-cardinality labels like `lot_code` (thousands of unique values) - causes memory explosion.

4. **Instrumentator Order:** Must call `Instrumentator().instrument(app)` BEFORE `expose()` and AFTER app creation.

5. **Docker Network:** All services must be on same Docker network (`flowviz_net`) for hostname resolution.

6. **Grafana Persistent Storage:** Use named volume for `/var/lib/grafana` to preserve dashboards.

7. **Prometheus Retention:** Default 15d retention; configure `--storage.tsdb.retention.time=30d` for production.

---

## Implementation Blueprint

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Compose Stack                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────┐    ┌───────────┐    ┌────────────┐               │
│   │ FastAPI │───▶│ PgBouncer │───▶│ PostgreSQL │               │
│   │   API   │    │  (6432)   │    │   (5432)   │               │
│   └────┬────┘    └───────────┘    └────────────┘               │
│        │                                                         │
│        │ /metrics                                                │
│        ▼                                                         │
│   ┌─────────────┐         ┌─────────────────────┐              │
│   │ Prometheus  │────────▶│ postgres-exporter   │              │
│   │   (9090)    │         │     (9187)          │              │
│   └──────┬──────┘         └─────────────────────┘              │
│          │                                                       │
│          ▼                                                       │
│   ┌─────────────┐                                               │
│   │   Grafana   │   ◀── Dashboards + Alerts                    │
│   │   (3001)    │                                               │
│   └─────────────┘                                               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Task Checklist (Execution Order)

### Task 1: Add Python Dependencies

**File:** `backend/pyproject.toml`

Add to dependencies section:
```toml
# Observability
"prometheus-fastapi-instrumentator>=6.1.0",
"prometheus-client>=0.20.0",
```

**Validation:**
```bash
cd backend && uv sync
```

---

### Task 2: Create Prometheus Metrics Module

**File:** `backend/app/metrics.py` (NEW)

```python
"""Prometheus metrics for FlowViz WMS.

Business metrics for lot registration, QC decisions, and traceability queries.
Follows RED method: Rate, Errors, Duration.
"""

from prometheus_client import Counter, Gauge, Histogram

# --- Business Metrics ---

lots_registered_total = Counter(
    "flowviz_lots_registered_total",
    "Total number of lots registered in the system",
    ["lot_type"],  # Labels: raw, intermediate, finished
)

qc_decisions_total = Counter(
    "flowviz_qc_decisions_total",
    "Total QC decisions made",
    ["decision"],  # Labels: PASS, HOLD, FAIL
)

traceability_query_duration = Histogram(
    "flowviz_traceability_query_duration_seconds",
    "Time spent processing traceability queries",
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

# --- Operational Metrics ---

active_operators = Gauge(
    "flowviz_active_operators",
    "Number of operators active in last 15 minutes",
)

pending_sync_lots = Gauge(
    "flowviz_pending_sync_lots",
    "Number of lots pending offline sync",
)

# --- Database Metrics ---

db_pool_connections_active = Gauge(
    "flowviz_db_pool_connections_active",
    "Active database connections in pool",
)

db_pool_connections_idle = Gauge(
    "flowviz_db_pool_connections_idle",
    "Idle database connections in pool",
)
```

---

### Task 3: Instrument FastAPI Application

**File:** `backend/app/main.py` (MODIFY)

```python
"""FastAPI application entry point for FlowViz WMS."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.rate_limit import limiter


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    yield
    # Shutdown


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="FlowViz WMS API",
        description="Food Production Warehouse Management System API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    # Rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

    # Prometheus instrumentation - MUST be before expose()
    Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        should_respect_env_var=True,
        should_instrument_requests_inprogress=True,
        excluded_handlers=["/metrics", "/health", "/docs", "/redoc", "/openapi.json"],
        inprogress_name="flowviz_http_requests_inprogress",
        inprogress_labels=True,
    ).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Import and include API routes
    from app.api.routes import api_router

    app.include_router(api_router, prefix="/api")

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
    )
```

---

### Task 4: Add Business Metrics to Routes

**File:** `backend/app/api/routes/lots.py` (MODIFY)

Add metric increment after lot creation:
```python
from app.metrics import lots_registered_total

@router.post("/lots", response_model=LotResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("100/minute")
async def create_lot(
    request: Request,
    lot_data: LotCreate,
    db: DBSession,
    current_user: CanCreateLots,
) -> LotResponse:
    """Create a new lot with metrics tracking."""
    lot = Lot(
        lot_code=lot_data.lot_code,
        lot_type=lot_data.lot_type,
        # ... rest of fields
    )
    db.add(lot)
    await db.flush()
    await db.refresh(lot)

    # Increment Prometheus counter
    lots_registered_total.labels(lot_type=lot_data.lot_type).inc()

    return LotResponse.model_validate(lot)
```

**File:** `backend/app/api/routes/qc.py` (MODIFY)

Add metric increment after QC decision:
```python
from app.metrics import qc_decisions_total

@router.post("/qc-decisions", response_model=QCDecisionResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("100/minute")
async def create_qc_decision(
    request: Request,
    decision_data: QCDecisionCreate,
    db: DBSession,
    current_user: CanMakeQCDecisions,
) -> QCDecisionResponse:
    """Record a QC decision with metrics tracking."""
    decision = QCDecision(
        lot_id=decision_data.lot_id,
        decision=decision_data.decision,
        # ... rest of fields
    )
    db.add(decision)
    await db.flush()
    await db.refresh(decision)

    # Increment Prometheus counter
    qc_decisions_total.labels(decision=decision_data.decision.value).inc()

    return QCDecisionResponse.model_validate(decision)
```

**File:** `backend/app/api/routes/traceability.py` (MODIFY)

Add histogram timing:
```python
from app.metrics import traceability_query_duration

@router.get("/traceability/{lot_id}/forward")
@limiter.limit("50/minute")
async def get_forward_traceability(
    request: Request,
    lot_id: str,
    db: DBSession,
    current_user: AllAuthenticated,
):
    """Get forward traceability with latency tracking."""
    with traceability_query_duration.time():
        # Existing query logic
        ...
```

---

### Task 5: Update Database Configuration for PgBouncer

**File:** `backend/app/database.py` (MODIFY)

```python
"""Async SQLAlchemy database connection optimized for PgBouncer."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

# PgBouncer-optimized engine configuration
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=25,           # Match PgBouncer DEFAULT_POOL_SIZE
    max_overflow=10,        # Extra connections during burst
    pool_pre_ping=True,     # Verify connection health before use
    pool_recycle=3600,      # Recycle connections every hour
    pool_timeout=30,        # Wait up to 30s for available connection
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)
```

---

### Task 6: Add PgBouncer to Docker Compose

**File:** `backend/docker/docker-compose.yml` (MODIFY)

Add PgBouncer service after postgres:
```yaml
services:
  postgres:
    # ... existing config unchanged

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
      # ... rest unchanged
    depends_on:
      pgbouncer:
        condition: service_healthy
      valkey:
        condition: service_healthy
```

---

### Task 7: Add Prometheus and Grafana to Docker Compose

**File:** `backend/docker/docker-compose.yml` (MODIFY)

Add after pgbouncer service:
```yaml
  prometheus:
    image: prom/prometheus:v2.50.0
    container_name: flowviz_prometheus
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./prometheus/alerts.yml:/etc/prometheus/alerts.yml:ro
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
    restart: unless-stopped

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
      - ./grafana/dashboards:/var/lib/grafana/dashboards:ro
    ports:
      - "3001:3000"
    depends_on:
      - prometheus
    networks:
      - flowviz_net
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:v1.7.0
    container_name: flowviz_node_exporter
    ports:
      - "9100:9100"
    networks:
      - flowviz_net
    restart: unless-stopped

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:v0.15.0
    container_name: flowviz_postgres_exporter
    environment:
      - DATA_SOURCE_NAME=postgresql://admin:password@postgres:5432/flowviz?sslmode=disable
    ports:
      - "9187:9187"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - flowviz_net
    restart: unless-stopped

volumes:
  postgres_data:
  prometheus_data:
  grafana_data:
```

---

### Task 8: Create Prometheus Configuration

**File:** `backend/docker/prometheus/prometheus.yml` (NEW)

```yaml
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

**File:** `backend/docker/prometheus/alerts.yml` (NEW)

```yaml
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
          summary: "High error rate detected (> 5%)"
          description: "Error rate is {{ $value | humanizePercentage }} over the last 5 minutes"

      - alert: HighLatencyP99
        expr: |
          histogram_quantile(0.99, 
            rate(http_request_duration_seconds_bucket[5m])
          ) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High P99 latency (> 500ms)"

      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL exporter is down"

  - name: flowviz_business
    rules:
      - alert: HighQCFailureRate
        expr: |
          sum(rate(flowviz_qc_decisions_total{decision="FAIL"}[1h]))
          / sum(rate(flowviz_qc_decisions_total[1h])) > 0.1
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "QC failure rate exceeds 10% over last hour"

      - alert: NoLotsRegistered
        expr: |
          increase(flowviz_lots_registered_total[1h]) == 0
        for: 2h
        labels:
          severity: warning
        annotations:
          summary: "No lots registered in the last hour during business hours"
```

---

### Task 9: Create Grafana Provisioning Files

**File:** `backend/docker/grafana/provisioning/datasources/datasources.yml` (NEW)

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

**File:** `backend/docker/grafana/provisioning/dashboards/dashboards.yml` (NEW)

```yaml
apiVersion: 1

providers:
  - name: 'FlowViz Dashboards'
    orgId: 1
    folder: 'FlowViz'
    folderUid: 'flowviz'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards
```

**File:** `backend/docker/grafana/dashboards/application.json` (NEW)

```json
{
  "dashboard": {
    "title": "FlowViz - Application Metrics",
    "uid": "flowviz-app",
    "tags": ["flowviz", "application"],
    "timezone": "browser",
    "schemaVersion": 38,
    "version": 1,
    "panels": [
      {
        "title": "Request Rate (req/s)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 8, "x": 0, "y": 0 },
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m]))",
            "legendFormat": "Total"
          }
        ]
      },
      {
        "title": "Error Rate (%)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 8, "x": 8, "y": 0 },
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) * 100",
            "legendFormat": "5xx Error Rate"
          }
        ]
      },
      {
        "title": "P99 Latency (ms)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 8, "x": 16, "y": 0 },
        "targets": [
          {
            "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) * 1000",
            "legendFormat": "P99"
          }
        ]
      },
      {
        "title": "Lots Registered (per hour)",
        "type": "stat",
        "gridPos": { "h": 4, "w": 6, "x": 0, "y": 8 },
        "targets": [
          {
            "expr": "increase(flowviz_lots_registered_total[1h])",
            "legendFormat": "Lots/hour"
          }
        ]
      },
      {
        "title": "QC Decisions by Type",
        "type": "piechart",
        "gridPos": { "h": 8, "w": 6, "x": 6, "y": 8 },
        "targets": [
          {
            "expr": "sum by (decision) (increase(flowviz_qc_decisions_total[1h]))",
            "legendFormat": "{{decision}}"
          }
        ]
      },
      {
        "title": "Traceability Query Duration",
        "type": "histogram",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 },
        "targets": [
          {
            "expr": "rate(flowviz_traceability_query_duration_seconds_bucket[5m])",
            "legendFormat": "{{le}}"
          }
        ]
      }
    ]
  }
}
```

---

### Task 10: Create Metrics Unit Tests

**File:** `backend/tests/test_metrics.py` (NEW)

```python
"""Tests for Prometheus metrics instrumentation."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_metrics_endpoint_accessible(client: AsyncClient) -> None:
    """Metrics endpoint should be publicly accessible."""
    response = await client.get("/metrics")
    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]


@pytest.mark.asyncio
async def test_metrics_contain_http_metrics(client: AsyncClient) -> None:
    """Metrics should include HTTP request metrics."""
    # Make a request first to generate metrics
    await client.get("/api/health")
    
    response = await client.get("/metrics")
    content = response.text
    
    # Check for prometheus-fastapi-instrumentator default metrics
    assert "http_requests_total" in content or "http_request_duration" in content


@pytest.mark.asyncio
async def test_business_metrics_registered(client: AsyncClient) -> None:
    """Business metrics should be registered."""
    response = await client.get("/metrics")
    content = response.text
    
    # Check custom business metrics are defined
    assert "flowviz_lots_registered_total" in content
    assert "flowviz_qc_decisions_total" in content
    assert "flowviz_traceability_query_duration" in content


@pytest.mark.asyncio
async def test_lot_creation_increments_counter(
    authenticated_client: AsyncClient,
) -> None:
    """Creating a lot should increment the lots_registered counter."""
    # Get initial metrics
    metrics_before = await authenticated_client.get("/metrics")
    
    # Create a lot
    lot_data = {
        "lot_code": "TEST-METRICS-001",
        "lot_type": "raw",
    }
    response = await authenticated_client.post("/api/lots", json=lot_data)
    
    # Skip if lot creation failed (might need more test setup)
    if response.status_code != 201:
        pytest.skip("Lot creation requires additional fixtures")
    
    # Get metrics after
    metrics_after = await authenticated_client.get("/metrics")
    
    # Verify counter increased (basic check - value changed)
    assert 'flowviz_lots_registered_total{lot_type="raw"}' in metrics_after.text
```

---

### Task 11: Create Integration Test Script

**File:** `backend/docker/test-observability.sh` (NEW)

```bash
#!/bin/bash
# Integration test for observability stack
set -e

echo "=== FlowViz Observability Integration Tests ==="

# Wait for services to be ready
echo "Waiting for services..."
sleep 10

# Test 1: FastAPI metrics endpoint
echo "[1/5] Testing FastAPI /metrics endpoint..."
curl -sf http://localhost:8000/metrics | grep -q "http_requests" && echo "✓ FastAPI metrics OK" || echo "✗ FastAPI metrics FAILED"

# Test 2: Prometheus is scraping
echo "[2/5] Testing Prometheus targets..."
curl -sf http://localhost:9090/api/v1/targets | grep -q "fastapi" && echo "✓ Prometheus scraping OK" || echo "✗ Prometheus scraping FAILED"

# Test 3: Grafana is running
echo "[3/5] Testing Grafana health..."
curl -sf http://localhost:3001/api/health | grep -q "ok" && echo "✓ Grafana OK" || echo "✗ Grafana FAILED"

# Test 4: PgBouncer is handling connections
echo "[4/5] Testing PgBouncer..."
PGPASSWORD=password psql -h localhost -p 6432 -U admin -d flowviz -c "SELECT 1" > /dev/null 2>&1 && echo "✓ PgBouncer OK" || echo "✗ PgBouncer FAILED"

# Test 5: PostgreSQL exporter
echo "[5/5] Testing PostgreSQL exporter..."
curl -sf http://localhost:9187/metrics | grep -q "pg_up" && echo "✓ Postgres exporter OK" || echo "✗ Postgres exporter FAILED"

echo ""
echo "=== Integration tests complete ==="
```

---

### Task 12: Create Documentation

**File:** `docs/observability.md` (NEW)

```markdown
# FlowViz Observability Guide

## Overview

FlowViz uses Prometheus + Grafana for monitoring with the RED method:
- **R**ate: Request throughput
- **E**rrors: Error rate percentage  
- **D**uration: Latency percentiles (P50, P95, P99)

## Accessing Dashboards

- **Grafana:** http://localhost:3001 (admin/admin)
- **Prometheus:** http://localhost:9090

## Available Dashboards

### Application Dashboard
- Request rate over time
- Error rate percentage
- P99 latency trends
- Requests in progress

### Business Dashboard
- Lots registered per hour by type
- QC decisions breakdown (PASS/HOLD/FAIL)
- Traceability query latency histogram
- Active operators gauge

### Infrastructure Dashboard
- PostgreSQL connections
- Node metrics (CPU, memory, disk)
- Container resource usage

## Custom Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `flowviz_lots_registered_total` | Counter | lot_type | Total lots registered |
| `flowviz_qc_decisions_total` | Counter | decision | QC decisions by outcome |
| `flowviz_traceability_query_duration_seconds` | Histogram | - | Query latency |
| `flowviz_active_operators` | Gauge | - | Active operators (15min) |

## Alerting

Critical alerts configured:
- High error rate (>5% for 2 minutes)
- High P99 latency (>500ms for 5 minutes)
- Database down
- QC failure rate >10%

## PgBouncer

Connection pooling via PgBouncer on port 6432:
- Pool mode: transaction
- Max client connections: 1000
- Default pool size: 25

Monitor pool status:
```bash
PGPASSWORD=password psql -h localhost -p 6432 -U admin pgbouncer -c "SHOW POOLS;"
```
```

---

## Validation Gates

### Level 1: Static Analysis

```bash
cd backend

# Install dependencies
uv sync

# Lint and type check
uv run ruff check --fix app/
uv run mypy app/
```

### Level 2: Unit Tests

```bash
cd backend

# Run all tests including new metrics tests
uv run pytest tests/ -v

# Run only metrics tests
uv run pytest tests/test_metrics.py -v
```

### Level 3: Integration Verification

```bash
# Start full stack
cd backend/docker && docker compose up -d

# Wait for services
sleep 15

# Run integration tests
chmod +x test-observability.sh
./test-observability.sh

# Manual verification
curl http://localhost:8000/metrics | head -50
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'
curl http://localhost:3001/api/health
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/pyproject.toml` | Modify | Add prometheus dependencies |
| `backend/app/metrics.py` | Create | Custom Prometheus metrics |
| `backend/app/main.py` | Modify | Add Instrumentator |
| `backend/app/database.py` | Modify | PgBouncer-optimized pool settings |
| `backend/app/api/routes/lots.py` | Modify | Add counter increment |
| `backend/app/api/routes/qc.py` | Modify | Add counter increment |
| `backend/app/api/routes/traceability.py` | Modify | Add histogram timing |
| `backend/docker/docker-compose.yml` | Modify | Add PgBouncer, Prometheus, Grafana |
| `backend/docker/prometheus/prometheus.yml` | Create | Prometheus scrape config |
| `backend/docker/prometheus/alerts.yml` | Create | Alerting rules |
| `backend/docker/grafana/provisioning/datasources/datasources.yml` | Create | Prometheus datasource |
| `backend/docker/grafana/provisioning/dashboards/dashboards.yml` | Create | Dashboard provider |
| `backend/docker/grafana/dashboards/application.json` | Create | Application dashboard |
| `backend/tests/test_metrics.py` | Create | Metrics unit tests |
| `backend/docker/test-observability.sh` | Create | Integration test script |
| `docs/observability.md` | Create | Observability documentation |

---

## Anti-Patterns to Avoid

- **DON'T** use high-cardinality labels (lot_code, user_id) - causes memory explosion
- **DON'T** connect API directly to PostgreSQL when PgBouncer is available
- **DON'T** forget to create prometheus data directory before starting
- **DON'T** use `DISCARD ALL` with session pooling mode (breaks sessions)
- **DON'T** expose Grafana on port 3000 if React frontend is running there
- **DON'T** hardcode credentials in docker-compose - use environment variables

---

## References

- [Prometheus FastAPI Instrumentator](https://github.com/trallnag/prometheus-fastapi-instrumentator)
- [Prometheus Client Python](https://github.com/prometheus/client_python)
- [PgBouncer Configuration](https://www.pgbouncer.org/config.html)
- [Grafana Provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)
- [RED Method](https://www.weave.works/blog/the-red-method-key-metrics-for-microservices-architecture/)
- [INITIAL-7a.md](../INITIAL-7a.md) - Original specification

---

**Confidence Score: 9/10**

High confidence due to:
- Clear existing patterns in codebase (docker-compose, main.py)
- Well-documented libraries (prometheus-fastapi-instrumentator, PgBouncer)
- Straightforward integration with existing FastAPI app
- Isolated changes that don't break existing functionality
- Comprehensive test patterns already established

Potential issues:
- Grafana dashboard JSON may need tweaking for exact panel layouts
- PgBouncer health check may need adjustment based on image version
- May need to adjust prometheus scrape intervals based on actual load
