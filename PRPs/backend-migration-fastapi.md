# Backend Migration PRP: Node/Express → FastAPI

## Purpose

Migrate the existing Node/Express backend (`flow-viz-react/server/`) to a production-ready **FastAPI** backend using the **strangler pattern** for safe, incremental migration with API parity validation.

## Core Principles

1. **API Parity First**: Every endpoint must return identical response shapes before/after migration
2. **Safe Refactor Workflow**: Baseline → Characterize → Refactor → Validate → Cleanup → Final
3. **Docker-First**: Side-by-side validation with both backends running simultaneously
4. **Fail Fast**: Strict validation at every milestone with characterization tests

---

## Goal

Create a production-ready FastAPI backend that:
- Replaces the Node/Express server with 100% API parity
- Uses async SQLAlchemy 2.0 with PostgreSQL 17.x
- Implements JWT authentication with bcrypt password hashing
- Integrates Valkey (Redis-compatible) for caching
- Uses Celery for background tasks (traceability calculations)
- Supports the existing frontend without changes

## Why

- **Performance**: FastAPI + async SQLAlchemy provides superior throughput for I/O-bound operations
- **Type Safety**: Pydantic v2 provides runtime validation matching frontend Zod schemas
- **Maintainability**: Python ecosystem better suited for data processing in food production domain
- **Modern Stack**: Aligns with industry best practices for async Python APIs

## What

### Migration Scope

**Current Node/Express API Surface (from `server/index.js`):**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check with timestamp |
| `/api/login` | POST | Email-based authentication (returns user + mock token) |
| `/api/traceability/:lotCode` | GET | Lot genealogy (central lot + parents + children) |
| `/api/lots` | POST | Create new lot (dynamic field insertion) |
| `/api/qc-decisions` | POST | Record QC decision (dynamic field insertion) |

### Success Criteria

- [ ] All 5 endpoints return identical JSON response shapes
- [ ] Characterization tests pass for all endpoints (baseline snapshots match)
- [ ] Docker Compose runs FastAPI + PostgreSQL 17 + Valkey cleanly
- [ ] Authentication uses bcrypt + JWT (not mock tokens)
- [ ] Celery worker processes background traceability jobs
- [ ] Zero frontend changes required for cutover

---

## All Needed Context

### Documentation & References

```yaml
# MUST READ - Core Documentation
- url: https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
  why: Official FastAPI JWT authentication pattern
  content: OAuth2 with password flow, bcrypt hashing, JWT tokens

- url: https://leapcell.io/blog/building-high-performance-async-apis-with-fastapi-sqlalchemy-2-0-and-asyncpg
  why: High-performance async patterns
  content: create_async_engine, AsyncSession, async_sessionmaker

- url: https://berkkaraal.com/blog/2024/09/19/setup-fastapi-project-with-async-sqlalchemy-2-alembic-postgresql-and-docker/
  why: Complete project setup tutorial
  content: Docker, Alembic, async SQLAlchemy 2.0, PostgreSQL

- url: https://testdriven.io/blog/fastapi-sqlmodel/
  why: Alembic async migration patterns
  content: env.py configuration for async, auto-generation

- url: https://alembic.sqlalchemy.org/en/latest/cookbook.html
  why: Official Alembic cookbook for async
  content: async_engine_from_config, run_async_migrations

- url: https://aiven.io/developer/python-valkey-redis-migration
  why: Valkey Python client migration guide
  content: valkey-py drop-in replacement for redis-py

- url: https://github.com/celery/celery/issues/9092
  why: Celery + Valkey compatibility status
  content: Use redis:// URL scheme with Valkey server (workaround)

# Codebase References
- path: flow-viz-react/server/index.js
  why: Current API implementation to match

- path: flow-viz-react/docker/init.sql
  why: Database schema to reflect in SQLAlchemy models

- path: flow-viz-react/src/types/database.types.ts
  why: TypeScript types to align Pydantic schemas with
```

### Current Database Schema (from `docker/init.sql`)

```sql
-- Core Tables (9 total)
auth.users          -- Mock Supabase auth (id, email, encrypted_password)
public.users        -- User profiles (id, email, full_name, role, created_at, last_login)
public.scenarios    -- Production scenarios (id, name JSONB, version, config JSONB, i18n JSONB)
public.streams      -- Production streams A/B/C (id, scenario_id, stream_key, name, color, sort_order)
public.qc_gates     -- QC checkpoints (id, scenario_id, gate_number, name, gate_type, is_ccp, checklist)
public.phases       -- Production phases (id, scenario_id, stream_id, qc_gate_id, phase_number, name, description)
public.production_runs  -- Active runs (id, run_code, scenario_id, operator_id, status, daily_target_kg, started_at, ended_at, summary)
public.lots         -- Lot tracking (id, lot_code, lot_type, production_run_id, phase_id, operator_id, weight_kg, temperature_c, metadata, created_at)
public.lot_genealogy    -- Parent/child links (id, parent_lot_id, child_lot_id, quantity_used_kg, linked_at)
public.qc_decisions -- QC records (id, lot_id, qc_gate_id, operator_id, decision, notes, temperature_c, digital_signature, decided_at)

-- Enums
role: 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'OPERATOR' | 'VIEWER'
lot_type: 'RAW' | 'DEB' | 'BULK' | 'MIX' | 'SKW' | 'FRZ' | 'FG'
status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
gate_type: 'CHECKPOINT' | 'BLOCKING' | 'INFO'
decision: 'PASS' | 'HOLD' | 'FAIL'
```

### Known Gotchas & Library Quirks

```python
# CRITICAL: asyncpg version compatibility
# Pin asyncpg < 0.29.0 for SQLAlchemy 2.0.x compatibility
# See: https://github.com/MagicStack/asyncpg/issues/1137

# CRITICAL: Celery + Valkey workaround
# Use redis:// URL scheme, NOT valkey:// (transport not registered)
# BROKER_URL = "redis://valkey:6379/0"  # Points to Valkey container

# CRITICAL: Alembic async migrations
# Alembic itself runs migrations synchronously
# Use asyncio.run() wrapper in env.py, not async def upgrade()

# CRITICAL: Pydantic v2 ORM mode change
# Use model_config = ConfigDict(from_attributes=True) instead of orm_mode=True

# CRITICAL: SQLAlchemy 2.0 session handling
# Always use `async with session.begin():` for transaction management
# Never use session.commit() explicitly with this pattern

# GOTCHA: JSONB columns in PostgreSQL
# Use SQLAlchemy's JSON type, map to dict in Pydantic
# from sqlalchemy.dialects.postgresql import JSONB

# GOTCHA: Decimal handling
# PostgreSQL DECIMAL → Python Decimal → Pydantic condecimal
# from decimal import Decimal
# from pydantic import condecimal
```

---

## Implementation Blueprint

### Target Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry point
│   ├── config.py               # Pydantic Settings configuration
│   ├── database.py             # Async SQLAlchemy engine/session
│   ├── models/                 # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── lot.py
│   │   ├── qc.py
│   │   └── production.py
│   ├── schemas/                # Pydantic request/response schemas
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── lot.py
│   │   ├── qc.py
│   │   └── traceability.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py             # Dependency injection (get_db, get_current_user)
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── health.py
│   │       ├── auth.py
│   │       ├── lots.py
│   │       ├── qc.py
│   │       └── traceability.py
│   ├── services/               # Business logic layer
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── lot.py
│   │   └── traceability.py
│   └── tasks/                  # Celery background tasks
│       ├── __init__.py
│       └── traceability.py
├── alembic/
│   ├── env.py                  # Async migration configuration
│   ├── versions/               # Migration files
│   └── alembic.ini
├── tests/
│   ├── __init__.py
│   ├── conftest.py             # Pytest fixtures
│   ├── characterization/       # Golden output tests
│   │   ├── test_health.py
│   │   ├── test_auth.py
│   │   ├── test_lots.py
│   │   ├── test_qc.py
│   │   └── test_traceability.py
│   └── snapshots/              # Golden output JSON files
│       ├── health_response.json
│       ├── login_response.json
│       └── ...
├── docker/
│   ├── Dockerfile              # Python 3.13 slim image
│   └── docker-compose.yml      # FastAPI + Postgres 17 + Valkey
├── pyproject.toml              # Dependencies and tool config
├── requirements.txt            # Pinned dependencies (export from uv)
└── .env.example                # Environment template
```

### Task Breakdown

```yaml
# Milestone 0: Foundations
Task M0.1 - Project Scaffolding:
  CREATE: pyproject.toml with dependencies
  CREATE: backend/app/__init__.py, main.py
  CREATE: docker/Dockerfile, docker-compose.yml
  VALIDATE: docker compose up --build runs cleanly

Task M0.2 - Configuration:
  CREATE: app/config.py with pydantic-settings
  PATTERN: Load from .env, validate required vars
  VARS: DATABASE_URL, SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_MINUTES

Task M0.3 - Health Endpoint:
  CREATE: app/api/routes/health.py
  RESPONSE: {"status": "ok", "timestamp": "<ISO8601>"}
  VALIDATE: Matches Node/Express response shape exactly

# Milestone 1: Data Layer
Task M1.1 - Database Connection:
  CREATE: app/database.py
  PATTERN: create_async_engine, async_sessionmaker
  DEPS: asyncpg < 0.29.0, sqlalchemy[asyncio]

Task M1.2 - SQLAlchemy Models:
  CREATE: app/models/*.py
  REFLECT: Match docker/init.sql schema exactly
  PATTERN: Use mapped_column, Mapped type hints

Task M1.3 - Alembic Setup:
  INIT: alembic init alembic
  MODIFY: alembic/env.py for async support
  MIGRATE: alembic revision --autogenerate -m "initial"
  VALIDATE: alembic upgrade head runs without errors

# Milestone 2: Authentication
Task M2.1 - Auth Schemas:
  CREATE: app/schemas/user.py
  MODELS: UserLogin, UserResponse, Token
  PATTERN: Match Node/Express login response shape

Task M2.2 - Auth Service:
  CREATE: app/services/auth.py
  PATTERN: verify_password, create_access_token
  DEPS: bcrypt, python-jose[cryptography]

Task M2.3 - Login Endpoint:
  CREATE: app/api/routes/auth.py
  ENDPOINT: POST /api/login
  RESPONSE: {"user": {...}, "token": "<JWT>"}
  VALIDATE: Characterization test passes

# Milestone 3: API Parity
Task M3.1 - Lots Endpoint:
  CREATE: app/api/routes/lots.py
  ENDPOINT: POST /api/lots
  PATTERN: Dynamic field insertion (match Node behavior)
  VALIDATE: Characterization test passes

Task M3.2 - QC Decisions Endpoint:
  CREATE: app/api/routes/qc.py
  ENDPOINT: POST /api/qc-decisions
  PATTERN: Dynamic field insertion
  VALIDATE: Characterization test passes

Task M3.3 - Traceability Endpoint:
  CREATE: app/api/routes/traceability.py
  ENDPOINT: GET /api/traceability/{lot_code}
  RESPONSE: {"central": {...}, "parents": [...], "children": [...]}
  VALIDATE: Characterization test passes

# Milestone 4: Async + Cache
Task M4.1 - Valkey Integration:
  ADD: valkey service to docker-compose.yml
  CREATE: app/cache.py with valkey-py client
  PATTERN: Cache traceability queries (TTL 5 min)

Task M4.2 - Celery Setup:
  CREATE: app/tasks/__init__.py (celery app)
  CREATE: app/tasks/traceability.py
  BROKER: redis://valkey:6379/0 (Valkey with redis:// scheme)

Task M4.3 - Background Traceability:
  IMPLEMENT: Async deep genealogy calculation
  PATTERN: Celery task triggered on lot creation
  VALIDATE: Task executes and updates cache

# Milestone 5: Cutover
Task M5.1 - Proxy Configuration:
  MODIFY: nginx.conf to route /api to FastAPI
  PATTERN: Strangler pattern - gradual endpoint routing

Task M5.2 - Full Parity Validation:
  RUN: All characterization tests
  COMPARE: Response payloads Node vs FastAPI
  DOCUMENT: Any intentional differences

Task M5.3 - Cleanup:
  REMOVE: Node/Express server container from compose
  UPDATE: Documentation (SETUP.md, README.md)
  ARCHIVE: Old server code (don't delete, preserve history)
```

### Per-Task Implementation Patterns

#### M0.3 - Health Endpoint Pattern

```python
# app/api/routes/health.py
from datetime import datetime, timezone
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["health"])

@router.get("/health")
async def health_check() -> dict:
    """Health check endpoint - must match Node/Express response shape."""
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
```

#### M1.2 - SQLAlchemy Model Pattern

```python
# app/models/lot.py
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4
import enum

from sqlalchemy import ForeignKey, String, Numeric, DateTime, Enum
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LotType(str, enum.Enum):
    RAW = "RAW"
    DEB = "DEB"
    BULK = "BULK"
    MIX = "MIX"
    SKW = "SKW"
    FRZ = "FRZ"
    FG = "FG"


class Lot(Base):
    __tablename__ = "lots"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    lot_code: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    lot_type: Mapped[LotType] = mapped_column(Enum(LotType), nullable=True)
    production_run_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("production_runs.id"), nullable=True
    )
    phase_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("phases.id"), nullable=True
    )
    operator_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    weight_kg: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    temperature_c: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 1), nullable=True)
    metadata: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    # Relationships
    parent_links: Mapped[list["LotGenealogy"]] = relationship(
        "LotGenealogy", foreign_keys="LotGenealogy.child_lot_id", back_populates="child"
    )
    child_links: Mapped[list["LotGenealogy"]] = relationship(
        "LotGenealogy", foreign_keys="LotGenealogy.parent_lot_id", back_populates="parent"
    )
```

#### M2.2 - Auth Service Pattern

```python
# app/services/auth.py
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import jwt, JWTError

from app.config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a bcrypt hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8")
    )


def get_password_hash(password: str) -> str:
    """Generate bcrypt hash for a password."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
```

#### M3.3 - Traceability Endpoint Pattern

```python
# app/api/routes/traceability.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.lot import Lot, LotGenealogy
from app.schemas.traceability import TraceabilityResponse

router = APIRouter(prefix="/api", tags=["traceability"])


@router.get("/traceability/{lot_code}", response_model=TraceabilityResponse)
async def get_traceability(
    lot_code: str,
    db: AsyncSession = Depends(get_db)
) -> TraceabilityResponse:
    """
    Get lot traceability graph (central lot + parents + children).

    Response shape must match Node/Express:
    {
        "central": {...lot fields...},
        "parents": [...parent lots...],
        "children": [...child lots...]
    }
    """
    # 1. Get central lot
    stmt = select(Lot).where(Lot.lot_code == lot_code)
    result = await db.execute(stmt)
    central_lot = result.scalar_one_or_none()

    if not central_lot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lot not found"
        )

    # 2. Get parents (upstream)
    parents_stmt = (
        select(Lot)
        .join(LotGenealogy, LotGenealogy.parent_lot_id == Lot.id)
        .where(LotGenealogy.child_lot_id == central_lot.id)
    )
    parents_result = await db.execute(parents_stmt)
    parents = parents_result.scalars().all()

    # 3. Get children (downstream)
    children_stmt = (
        select(Lot)
        .join(LotGenealogy, LotGenealogy.child_lot_id == Lot.id)
        .where(LotGenealogy.parent_lot_id == central_lot.id)
    )
    children_result = await db.execute(children_stmt)
    children = children_result.scalars().all()

    return TraceabilityResponse(
        central=central_lot,
        parents=list(parents),
        children=list(children)
    )
```

---

## Validation Loop

### Level 1: Syntax & Style

```bash
# Run from backend/ directory
cd backend

# Linting and formatting (ruff is faster than flake8)
uv run ruff check . --fix
uv run ruff format .

# Type checking
uv run mypy app/ --strict

# Expected: No errors. If errors, fix before proceeding.
```

### Level 2: Unit Tests

```bash
# Run all tests with coverage
uv run pytest tests/ -v --cov=app --cov-report=term-missing

# Run only characterization tests
uv run pytest tests/characterization/ -v

# Expected: All tests pass, 80%+ coverage
```

### Level 3: Docker Integration

```bash
# Start all services
docker compose -f docker/docker-compose.yml up --build -d

# Check health endpoint
curl http://localhost:8000/api/health

# Check logs
docker compose -f docker/docker-compose.yml logs -f api

# Run migrations
docker compose exec api alembic upgrade head

# Expected: All services healthy, migrations apply cleanly
```

### Level 4: API Parity Validation

```bash
# Start both Node and FastAPI backends
# Node on port 3000, FastAPI on port 8000

# Capture Node baseline
curl http://localhost:3000/api/health > tests/snapshots/node_health.json
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@flowviz.com"}' > tests/snapshots/node_login.json

# Compare with FastAPI
curl http://localhost:8000/api/health > tests/snapshots/fastapi_health.json
diff tests/snapshots/node_health.json tests/snapshots/fastapi_health.json

# Expected: Identical structure (timestamps may differ, that's OK)
```

### Level 5: Characterization Test Pattern

```python
# tests/characterization/test_health.py
import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_health_response_shape():
    """Verify health endpoint matches expected shape."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/health")

    assert response.status_code == 200
    data = response.json()

    # Shape validation
    assert "status" in data
    assert "timestamp" in data
    assert data["status"] == "ok"

    # Timestamp is ISO8601
    from datetime import datetime
    datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))


@pytest.mark.asyncio
async def test_traceability_response_shape(db_session):
    """Verify traceability endpoint matches Node/Express shape."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/traceability/MIX-BATCH-88")

    assert response.status_code == 200
    data = response.json()

    # Must have exactly these keys (matching Node/Express)
    assert set(data.keys()) == {"central", "parents", "children"}
    assert isinstance(data["parents"], list)
    assert isinstance(data["children"], list)

    # Central lot must have expected fields
    central = data["central"]
    expected_fields = {"id", "lot_code", "lot_type", "weight_kg", "created_at"}
    assert expected_fields.issubset(set(central.keys()))
```

---

## Dependencies (pyproject.toml)

```toml
[project]
name = "flowviz-backend"
version = "1.0.0"
description = "FastAPI backend for FlowViz WMS"
requires-python = ">=3.13"
dependencies = [
    # Web framework
    "fastapi>=0.125.0",
    "uvicorn[standard]>=0.34.0",

    # Database
    "sqlalchemy[asyncio]>=2.0.36",
    "asyncpg>=0.28.0,<0.29.0",  # Pin for SQLAlchemy 2.0 compat
    "alembic>=1.14.0",

    # Validation
    "pydantic>=2.11.0",
    "pydantic-settings>=2.7.0",

    # Auth
    "bcrypt>=4.2.0",
    "python-jose[cryptography]>=3.3.0",

    # Cache & Tasks
    "valkey>=6.0.0",
    "celery[redis]>=5.4.0",  # Use redis bundle, point to Valkey

    # Utilities
    "httpx>=0.28.0",
    "python-multipart>=0.0.20",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3.0",
    "pytest-asyncio>=0.24.0",
    "pytest-cov>=6.0.0",
    "httpx>=0.28.0",
    "ruff>=0.8.0",
    "mypy>=1.14.0",
]

[tool.ruff]
target-version = "py313"
line-length = 100
select = ["E", "F", "I", "N", "W", "UP", "B", "C4", "SIM"]

[tool.mypy]
python_version = "3.13"
strict = true

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

---

## Docker Compose (docker/docker-compose.yml)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:17-alpine
    container_name: flowviz_db
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
      POSTGRES_DB: flowviz
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ../../flow-viz-react/docker/init.sql:/docker-entrypoint-initdb.d/init.sql
      - ../../flow-viz-react/docker/seed_traceability.sql:/docker-entrypoint-initdb.d/seed.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d flowviz"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - flowviz_net

  valkey:
    image: valkey/valkey:8.1-alpine
    container_name: flowviz_cache
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - flowviz_net

  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    container_name: flowviz_api_fastapi
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://admin:password@postgres:5432/flowviz
      - VALKEY_URL=redis://valkey:6379/0
      - SECRET_KEY=your-secret-key-change-in-production
      - JWT_ALGORITHM=HS256
      - JWT_EXPIRE_MINUTES=30
    depends_on:
      postgres:
        condition: service_healthy
      valkey:
        condition: service_healthy
    networks:
      - flowviz_net

  celery_worker:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    container_name: flowviz_celery
    command: celery -A app.tasks worker --loglevel=info
    environment:
      - DATABASE_URL=postgresql+asyncpg://admin:password@postgres:5432/flowviz
      - CELERY_BROKER_URL=redis://valkey:6379/0
      - CELERY_RESULT_BACKEND=redis://valkey:6379/0
    depends_on:
      - api
      - valkey
    networks:
      - flowviz_net

volumes:
  postgres_data:

networks:
  flowviz_net:
    driver: bridge
```

---

## Final Validation Checklist

### Milestone 0: Foundations
- [ ] `docker compose up --build` runs without errors
- [ ] `GET /api/health` returns `{"status": "ok", "timestamp": "..."}`
- [ ] Health response matches Node/Express shape exactly

### Milestone 1: Data Layer
- [ ] SQLAlchemy models reflect all 9 database tables
- [ ] `alembic upgrade head` runs without errors
- [ ] Database connection pool configured correctly

### Milestone 2: Authentication
- [ ] `POST /api/login` returns user + JWT token
- [ ] bcrypt password verification works
- [ ] JWT token contains user ID in payload

### Milestone 3: API Parity
- [ ] `POST /api/lots` creates lot and returns it
- [ ] `POST /api/qc-decisions` creates decision and returns it
- [ ] `GET /api/traceability/{lot_code}` returns genealogy graph
- [ ] All characterization tests pass

### Milestone 4: Async + Cache
- [ ] Valkey cache stores traceability results
- [ ] Celery worker processes background tasks
- [ ] Cache invalidation works on lot creation

### Milestone 5: Cutover
- [ ] All endpoints routed to FastAPI
- [ ] Node/Express container removed
- [ ] Documentation updated

---

## Anti-Patterns to Avoid

- ❌ Don't use `session.commit()` with `async with session.begin():` pattern
- ❌ Don't use `asyncpg >= 0.29.0` (compatibility issues with SQLAlchemy 2.0)
- ❌ Don't use `valkey://` URL scheme with Celery (use `redis://`)
- ❌ Don't hardcode secrets in code (use pydantic-settings)
- ❌ Don't skip characterization tests before each milestone
- ❌ Don't change response shapes without documenting the delta
- ❌ Don't use sync functions in async endpoints (blocks event loop)
- ❌ Don't forget to pin asyncpg version in pyproject.toml

---

## Confidence Score: 8/10

**High confidence due to:**
- Well-documented Node/Express API to match
- Clear database schema from init.sql
- Established patterns for FastAPI + async SQLAlchemy
- Comprehensive validation gates at each milestone

**Uncertainty factors:**
- Celery + Valkey integration requires workaround (redis:// scheme)
- asyncpg version pinning may need adjustment as SQLAlchemy evolves
- First-time Alembic async setup can be tricky

---

## Sources

- [FastAPI OAuth2 JWT Tutorial](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/)
- [Building High-Performance Async APIs with FastAPI, SQLAlchemy 2.0, and Asyncpg](https://leapcell.io/blog/building-high-performance-async-apis-with-fastapi-sqlalchemy-2-0-and-asyncpg)
- [Setup FastAPI Project with Async SQLAlchemy 2, Alembic, PostgreSQL and Docker](https://berkkaraal.com/blog/2024/09/19/setup-fastapi-project-with-async-sqlalchemy-2-alembic-postgresql-and-docker/)
- [FastAPI with Async SQLAlchemy, SQLModel, and Alembic](https://testdriven.io/blog/fastapi-sqlmodel/)
- [Alembic Cookbook - Async Migrations](https://alembic.sqlalchemy.org/en/latest/cookbook.html)
- [Migrating Python Applications from Redis to Valkey](https://aiven.io/developer/python-valkey-redis-migration)
- [Celery Valkey Support Issue](https://github.com/celery/celery/issues/9092)
- [valkey-py GitHub](https://github.com/valkey-io/valkey-py)
