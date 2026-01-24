# FlowViz Backend (FastAPI)

FastAPI backend for the FlowViz Food Production WMS, migrated from Node/Express using the strangler pattern.

## Tech Stack

- **Python 3.13+**
- **FastAPI** - Web framework
- **SQLAlchemy 2.0** - Async ORM
- **PostgreSQL 17** - Database
- **PgBouncer** - Connection pooling (1000+ connections)
- **Alembic** - Migrations
- **Pydantic v2** - Validation
- **bcrypt + python-jose** - Authentication
- **Valkey/Redis** - Caching & rate limiting
- **Celery** - Background tasks
- **Prometheus** - Metrics collection (RED method)
- **Grafana** - Dashboards & alerting

## Quick Start

### Prerequisites

- Python 3.13+
- Docker & Docker Compose
- uv (recommended) or pip

### Development Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Create virtual environment and install dependencies
uv venv
source .venv/bin/activate  # Linux/Mac
# or: .venv\Scripts\activate  # Windows

uv pip install -e ".[dev]"

# 3. Copy environment file
cp .env.example .env

# 4. Start services with Docker
docker compose -f docker/docker-compose.yml up -d postgres valkey

# 5. Run migrations
alembic upgrade head

# 6. Start the development server
uvicorn app.main:app --reload --port 8000
```

### Docker Deployment

```bash
# Start all services (API + DB + Cache + Worker + Observability)
docker compose -f docker/docker-compose.yml up --build -d

# Check logs
docker compose -f docker/docker-compose.yml logs -f api

# Stop services
docker compose -f docker/docker-compose.yml down
```

### Observability Stack

```bash
# Verify all observability services are healthy
cd docker && ./test-observability.sh

# Access dashboards
# Grafana:    http://localhost:3001 (admin/admin)
# Prometheus: http://localhost:9090
# Metrics:    http://localhost:8000/metrics
```

| Service | Port | Description |
|---------|------|-------------|
| Grafana | 3001 | Dashboards & alerting |
| Prometheus | 9090 | Metrics collection |
| PgBouncer | 6432 | Connection pooling |
| Node Exporter | 9100 | Host metrics |
| Postgres Exporter | 9187 | Database metrics |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/login` | POST | User authentication |
| `/api/lots` | POST | Create new lot |
| `/api/qc-decisions` | POST | Record QC decision |
| `/api/traceability/{lot_code}` | GET | Get lot genealogy |
| `/metrics` | GET | Prometheus metrics (RED + custom) |

## Testing

```bash
# Phase 2: invoke-based suites
invoke quality
invoke test

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=term-missing

# Run characterization tests only
pytest tests/characterization/ -v
```

## Code Quality

```bash
# Linting and formatting
ruff check . --fix
ruff format .

# Type checking
mypy app/
```

## Project Structure

```plaintext
backend/
├── app/
│   ├── api/
│   │   ├── routes/          # API endpoints (RBAC + metrics)
│   │   └── deps.py          # Dependencies (auth, db, RBAC)
│   ├── models/              # SQLAlchemy models
│   ├── schemas/             # Pydantic schemas
│   ├── services/            # Business logic
│   ├── tasks/               # Celery background tasks
│   ├── config.py            # Settings
│   ├── database.py          # DB connection (PgBouncer optimized)
│   ├── cache.py             # Redis/Valkey client
│   ├── metrics.py           # Prometheus custom metrics
│   ├── rate_limit.py        # SlowAPI rate limiting
│   └── main.py              # FastAPI app + Instrumentator
├── alembic/                 # Database migrations
├── tests/                   # Test suite
├── docker/                  # Docker configs
│   ├── docker-compose.yml   # 9 services (incl. observability)
│   ├── prometheus/          # Prometheus config + alerts
│   ├── grafana/             # Dashboard provisioning
│   └── test-observability.sh
└── pyproject.toml           # Dependencies
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://...` |
| `SECRET_KEY` | JWT signing key | (required) |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `JWT_EXPIRE_MINUTES` | Token expiration | `30` |
| `REDIS_URL` | Valkey/Redis URL | `redis://localhost:6379/0` |
| `ENVIRONMENT` | Environment name | `development` |
| `DEBUG` | Enable debug mode | `true` |

## Prometheus Metrics

### Business Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `flowviz_lots_registered_total` | Counter | Lots registered by type |
| `flowviz_qc_decisions_total` | Counter | QC decisions by outcome |
| `flowviz_traceability_query_duration_seconds` | Histogram | Traceability query latency |
| `flowviz_db_pool_connections_active` | Gauge | Active DB connections |
| `flowviz_db_pool_connections_idle` | Gauge | Idle DB connections |

### HTTP Metrics (Auto-generated)

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Requests by method/path/status |
| `http_request_duration_seconds` | Histogram | Request latency (P50/P95/P99) |
| `flowviz_http_requests_inprogress` | Gauge | In-flight requests |

## API Parity

This backend maintains 100% response shape parity with the original Node/Express server. All endpoints return identical JSON structures to ensure zero frontend changes during cutover.

See [PRPs/backend-migration-fastapi.md](../PRPs/backend-migration-fastapi.md) for the full migration specification.

## Documentation

- [Observability Guide](../docs/observability.md) - Prometheus/Grafana setup
- [Disaster Recovery](../docs/runbooks/disaster-recovery.md) - Backup & restore procedures
- [Architecture](../docs/architecture.md) - System design overview
