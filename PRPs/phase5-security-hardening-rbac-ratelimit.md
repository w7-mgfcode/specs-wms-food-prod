# PRP: Security Hardening Foundation - RBAC, Rate Limiting & Secrets Management

> **Phase:** 5.1 - Security Hardening
> **Priority:** CRITICAL (Must complete before production)
> **Date:** January 19, 2026
> **Confidence Score:** 8/10

---

## Purpose

Implement comprehensive security hardening for the Food Production WMS FlowViz backend, establishing the foundational security layer required before any production deployment. This PRP covers three critical security components:

1. **Role-Based Access Control (RBAC):** Enforce role-based permissions at the FastAPI API layer
2. **Rate Limiting:** Prevent brute-force attacks and API abuse with SlowAPI + Valkey
3. **Secrets Management:** Prepare infrastructure for enterprise-grade secrets (dev-ready)

---

## Why

- **HACCP Compliance:** Food traceability requires strict access controls for lot registration, QC decisions, and audit trail access
- **Production Readiness:** Zero secrets in code, environment variables, or docker-compose files
- **Security Best Practices:** Prevent brute-force attacks on login, protect high-value operations
- **5 Distinct Roles:** ADMIN, MANAGER, AUDITOR, OPERATOR, VIEWER with granular permissions

---

## Success Criteria

- [ ] All API endpoints protected with RBAC (100% coverage)
- [ ] Rate limiting active on all endpoints (zero brute-force vulnerability)
- [ ] Secrets management infrastructure prepared (dev fallback + production-ready config)
- [ ] All changes backward-compatible with existing frontend
- [ ] Comprehensive test suite for RBAC and rate limiting
- [ ] ADRs created for security architecture decisions

---

## All Needed Context

### Existing Codebase Patterns

#### Current Auth Implementation (`backend/app/services/auth.py`)
```python
# JWT token handling already exists
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(UTC) + (expires_delta or timedelta(minutes=settings.jwt_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)

def decode_access_token(token: str) -> dict | None:
    """Decode and verify a JWT access token."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None
```

#### Current Dependencies Pattern (`backend/app/api/deps.py`)
```python
# HTTPBearer security scheme exists
security = HTTPBearer(auto_error=False)

# DB session dependency pattern
async def get_db() -> AsyncGenerator[AsyncSession]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

# Current user dependency (returns User model)
async def get_current_user_required(user: Annotated[User | None, Depends(get_current_user)]) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, ...)
    return user

# Type aliases
DBSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUserRequired = Annotated[User, Depends(get_current_user_required)]
```

#### User Role Enum (`backend/app/models/user.py`)
```python
class UserRole(str, enum.Enum):
    """User roles matching database CHECK constraint."""
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    AUDITOR = "AUDITOR"
    OPERATOR = "OPERATOR"
    VIEWER = "VIEWER"
```

#### Current Route Pattern (`backend/app/api/routes/lots.py`)
```python
@router.post("/lots", response_model=LotResponse, status_code=status.HTTP_201_CREATED)
async def create_lot(lot_data: LotCreate, db: DBSession) -> LotResponse:
    """Create a new lot."""
    # No auth currently!
    lot = Lot(...)
    db.add(lot)
    await db.flush()
    return LotResponse.model_validate(lot)
```

#### Test Pattern (`backend/tests/conftest.py`)
```python
@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient]:
    async def override_get_db() -> AsyncGenerator[AsyncSession]:
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

### External Documentation

#### SlowAPI Rate Limiting
- **Official Docs:** https://slowapi.readthedocs.io/
- **GitHub:** https://github.com/laurentS/slowapi
- **Key Pattern:**
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address, storage_uri="redis://localhost:6379")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CRITICAL: Route decorator BEFORE rate limit decorator
@app.get("/home")
@limiter.limit("5/minute")
async def homepage(request: Request):  # request MUST be explicit parameter
    ...
```

#### FastAPI Security
- **OAuth2 + JWT:** https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
- **Dependencies:** https://fastapi.tiangolo.com/tutorial/dependencies/

### Critical Gotchas

1. **SlowAPI Decorator Order:** Route decorator must come BEFORE `@limiter.limit()`
2. **Request Parameter Required:** SlowAPI requires explicit `request: Request` parameter
3. **Valkey Compatibility:** Valkey is Redis-compatible, use same `redis://` URI scheme
4. **Token Payload:** Current JWT only has `sub` (user_id), need to add `role` claim
5. **HTTPBearer auto_error:** Currently `False`, RBAC should override to require auth

---

## Implementation Blueprint

### Task 1: Add SlowAPI Dependency

**File:** `backend/pyproject.toml`

```toml
# Add to dependencies section
"slowapi>=0.1.9",
```

**Validation:**
```bash
cd backend && uv sync
```

---

### Task 2: Implement RBAC Dependency

**File:** `backend/app/api/deps.py`

```python
# Add to existing deps.py

from app.models.user import UserRole

def require_roles(*allowed_roles: UserRole):
    """
    FastAPI dependency factory for role-based access control.

    Args:
        *allowed_roles: Variable number of UserRole enums that are permitted

    Returns:
        Dependency that validates JWT and checks role membership

    Raises:
        HTTPException 401: Invalid or expired token
        HTTPException 403: User role not in allowed_roles

    Usage:
        @router.delete("/production-runs/{run_id}")
        async def delete_run(
            run_id: str,
            current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
        ):
            ...
    """
    async def role_checker(
        user: Annotated[User, Depends(get_current_user_required)],
    ) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(r.value for r in allowed_roles)}",
                headers={"X-Required-Roles": ", ".join(r.value for r in allowed_roles)},
            )
        return user

    return role_checker


# Role-specific type aliases for common patterns
AdminOnly = Annotated[User, Depends(require_roles(UserRole.ADMIN))]
AdminOrManager = Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))]
CanCreateLots = Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR))]
CanMakeQCDecisions = Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AUDITOR, UserRole.OPERATOR))]
AllAuthenticated = Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AUDITOR, UserRole.OPERATOR, UserRole.VIEWER))]
```

---

### Task 3: Configure Rate Limiting in Main App

**File:** `backend/app/main.py`

```python
"""FastAPI application entry point for FlowViz WMS."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings


# Initialize rate limiter with Valkey backend
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.redis_url,
    strategy="fixed-window-elastic-expiry",
    default_limits=["200/minute"],
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """Application lifespan handler for startup/shutdown events."""
    # Startup - validate production settings
    if settings.is_production:
        settings.validate_production_settings()
    yield
    # Shutdown - cleanup if needed


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
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
```

---

### Task 4: Apply RBAC and Rate Limits to Routes

**Permission Matrix:**

| Endpoint | ADMIN | MANAGER | AUDITOR | OPERATOR | VIEWER | Rate Limit |
|----------|:-----:|:-------:|:-------:|:--------:|:------:|------------|
| POST /login | - | - | - | - | - | 10/minute |
| GET /health | - | - | - | - | - | 200/minute |
| GET /lots | ✓ | ✓ | ✓ | ✓ | ✓ | 200/minute |
| POST /lots | ✓ | ✓ | ✗ | ✓ | ✗ | 100/minute |
| POST /qc-decisions | ✓ | ✓ | ✓ | ✓ | ✗ | 100/minute |
| GET /traceability/* | ✓ | ✓ | ✓ | ✓ | ✓ | 50/minute |

**File:** `backend/app/api/routes/auth.py`

```python
"""Authentication endpoints."""

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import DBSession
from app.main import limiter
from app.models.user import User
from app.schemas.user import LoginResponse, UserLogin, UserResponse
from app.services.auth import create_access_token

router = APIRouter(tags=["auth"])


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,  # Required for SlowAPI
    credentials: UserLogin,
    db: DBSession,
) -> LoginResponse:
    """
    Login endpoint with rate limiting.

    Rate limit: 10 attempts per minute to prevent brute-force attacks.
    """
    stmt = select(User).where(User.email == credentials.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Include role in JWT token for RBAC
    token = create_access_token(data={"sub": str(user.id), "role": user.role.value})

    return LoginResponse(
        user=UserResponse.model_validate(user),
        token=token,
    )
```

**File:** `backend/app/api/routes/lots.py`

```python
"""Lot management endpoints."""

from fastapi import APIRouter, Request, status

from app.api.deps import AllAuthenticated, CanCreateLots, DBSession
from app.main import limiter
from app.models.lot import Lot
from app.schemas.lot import LotCreate, LotResponse

router = APIRouter(tags=["lots"])


@router.get("/lots", response_model=list[LotResponse])
@limiter.limit("200/minute")
async def list_lots(
    request: Request,
    db: DBSession,
    current_user: AllAuthenticated,
) -> list[LotResponse]:
    """List all lots. All authenticated users can view."""
    # Implementation
    pass


@router.post("/lots", response_model=LotResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("100/minute")
async def create_lot(
    request: Request,
    lot_data: LotCreate,
    db: DBSession,
    current_user: CanCreateLots,
) -> LotResponse:
    """
    Create a new lot.

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 100/minute (normal factory throughput).
    """
    lot = Lot(
        lot_code=lot_data.lot_code,
        lot_type=lot_data.lot_type,
        production_run_id=lot_data.production_run_id,
        phase_id=lot_data.phase_id,
        operator_id=current_user.id,  # Use authenticated user
        weight_kg=lot_data.weight_kg,
        temperature_c=lot_data.temperature_c,
        metadata_=lot_data.metadata or {},
    )

    db.add(lot)
    await db.flush()
    await db.refresh(lot)

    return LotResponse.model_validate(lot)
```

**File:** `backend/app/api/routes/qc.py`

```python
"""QC decision endpoints."""

from fastapi import APIRouter, Request, status

from app.api.deps import CanMakeQCDecisions, DBSession
from app.main import limiter
from app.models.qc import QCDecision
from app.schemas.qc import QCDecisionCreate, QCDecisionResponse

router = APIRouter(tags=["qc"])


@router.post(
    "/qc-decisions",
    response_model=QCDecisionResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("100/minute")
async def create_qc_decision(
    request: Request,
    decision_data: QCDecisionCreate,
    db: DBSession,
    current_user: CanMakeQCDecisions,
) -> QCDecisionResponse:
    """
    Record a QC decision for a lot.

    Requires: ADMIN, MANAGER, AUDITOR, or OPERATOR role.
    VIEWER cannot make QC decisions.

    Rate limit: 100/minute (normal QC gate processing).
    """
    decision = QCDecision(
        lot_id=decision_data.lot_id,
        qc_gate_id=decision_data.qc_gate_id,
        operator_id=current_user.id,
        decision=decision_data.decision,
        notes=decision_data.notes,
        temperature_c=decision_data.temperature_c,
        digital_signature=decision_data.digital_signature,
    )

    db.add(decision)
    await db.flush()
    await db.refresh(decision)

    return QCDecisionResponse.model_validate(decision)
```

**File:** `backend/app/api/routes/traceability.py`

```python
"""Traceability endpoints."""

from fastapi import APIRouter, Request

from app.api.deps import AllAuthenticated, DBSession
from app.main import limiter

router = APIRouter(tags=["traceability"])


@router.get("/traceability/{lot_code}")
@limiter.limit("50/minute")
async def get_lot_traceability(
    request: Request,
    lot_code: str,
    db: DBSession,
    current_user: AllAuthenticated,
):
    """
    Get full traceability tree for a lot.

    All authenticated users can view traceability (compliance requirement).
    Rate limit: 50/minute (expensive recursive queries).
    """
    # Implementation
    pass
```

---

### Task 5: Update JWT Token to Include Role

**File:** `backend/app/api/routes/auth.py` (already shown above)

The key change is adding `role` to the JWT payload:
```python
token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
```

---

### Task 6: Write RBAC Tests

**File:** `backend/tests/test_rbac.py`

```python
"""RBAC tests for role-based access control."""

from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.services.auth import create_access_token


def create_test_token(user_id: str, role: UserRole) -> str:
    """Create a JWT token for testing."""
    return create_access_token(data={"sub": user_id, "role": role.value})


@pytest.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Create an ADMIN test user."""
    user = User(
        id=UUID("00000000-0000-0000-0000-000000000001"),
        email="admin@flowviz.com",
        full_name="Admin User",
        role=UserRole.ADMIN,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.fixture
async def viewer_user(db_session: AsyncSession) -> User:
    """Create a VIEWER test user."""
    user = User(
        id=UUID("00000000-0000-0000-0000-000000000002"),
        email="viewer@flowviz.com",
        full_name="Viewer User",
        role=UserRole.VIEWER,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.fixture
async def operator_user(db_session: AsyncSession) -> User:
    """Create an OPERATOR test user."""
    user = User(
        id=UUID("00000000-0000-0000-0000-000000000003"),
        email="operator@flowviz.com",
        full_name="Operator User",
        role=UserRole.OPERATOR,
    )
    db_session.add(user)
    await db_session.commit()
    return user


# --- RBAC Tests ---


@pytest.mark.asyncio
async def test_viewer_cannot_create_lots(client: AsyncClient, viewer_user: User):
    """VIEWER role should get 403 when attempting to create lots."""
    token = create_test_token(str(viewer_user.id), UserRole.VIEWER)

    response = await client.post(
        "/api/lots",
        headers={"Authorization": f"Bearer {token}"},
        json={"lot_code": "TEST-001", "lot_type": "RAW"},
    )

    assert response.status_code == 403
    assert "Requires one of" in response.json()["detail"]
    assert "X-Required-Roles" in response.headers


@pytest.mark.asyncio
async def test_operator_can_create_lots(client: AsyncClient, operator_user: User):
    """OPERATOR role should be able to create lots."""
    token = create_test_token(str(operator_user.id), UserRole.OPERATOR)

    response = await client.post(
        "/api/lots",
        headers={"Authorization": f"Bearer {token}"},
        json={"lot_code": "TEST-001", "lot_type": "RAW"},
    )

    # 201 or 422 (validation) - but NOT 403 (forbidden)
    assert response.status_code in (201, 422)


@pytest.mark.asyncio
async def test_viewer_cannot_make_qc_decisions(client: AsyncClient, viewer_user: User):
    """VIEWER role should get 403 when attempting to create QC decisions."""
    token = create_test_token(str(viewer_user.id), UserRole.VIEWER)

    response = await client.post(
        "/api/qc-decisions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "lot_id": "00000000-0000-0000-0000-000000000001",
            "decision": "PASS",
        },
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_missing_auth_returns_401(client: AsyncClient):
    """Missing Authorization header should return 401."""
    response = await client.get("/api/lots")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_invalid_token_returns_401(client: AsyncClient):
    """Invalid JWT token should return 401."""
    response = await client.get(
        "/api/lots",
        headers={"Authorization": "Bearer invalid.token.here"},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("role", [UserRole.ADMIN, UserRole.MANAGER, UserRole.AUDITOR, UserRole.OPERATOR, UserRole.VIEWER])
async def test_all_roles_can_view_traceability(client: AsyncClient, db_session: AsyncSession, role: UserRole):
    """All authenticated roles should access traceability (compliance requirement)."""
    user = User(
        id=UUID(f"00000000-0000-0000-0000-00000000000{role.value[0]}"),
        email=f"{role.value.lower()}@flowviz.com",
        full_name=f"{role.value} User",
        role=role,
    )
    db_session.add(user)
    await db_session.commit()

    token = create_test_token(str(user.id), role)

    response = await client.get(
        "/api/traceability/TEST-LOT-001",
        headers={"Authorization": f"Bearer {token}"},
    )

    # 200 or 404 (not found) - but NOT 403 (forbidden)
    assert response.status_code in (200, 404)
```

---

### Task 7: Write Rate Limiting Tests

**File:** `backend/tests/test_rate_limiting.py`

```python
"""Rate limiting tests."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_rate_limit_exceeded(client: AsyncClient):
    """Exceeding login rate limit should return 429."""
    # Make 11 requests (limit is 10/minute)
    for i in range(11):
        response = await client.post(
            "/api/login",
            json={"email": "test@test.com"},
        )
        if response.status_code == 429:
            # Verify rate limit response
            assert "Retry-After" in response.headers
            return

    pytest.fail("Rate limit was not triggered after 11 requests")


@pytest.mark.asyncio
async def test_health_endpoint_not_rate_limited_quickly(client: AsyncClient):
    """Health endpoint should have high rate limit (200/minute)."""
    # Make 10 rapid requests - should all succeed
    for _ in range(10):
        response = await client.get("/api/health")
        assert response.status_code == 200
```

---

### Task 8: Create ADR for RBAC

**File:** `docs/decisions/0003-rbac-enforcement.md`

```markdown
# ADR 0003: Role-Based Access Control (RBAC) Enforcement

**Status:** Accepted
**Date:** 2026-01-19
**Decision Makers:** Backend Team

---

## Context

The FlowViz WMS requires strict access controls for HACCP compliance in food production. Different user roles need different permissions:
- ADMIN: Full system access
- MANAGER: Production oversight
- AUDITOR: Read-only access to all data
- OPERATOR: Lot registration, QC decisions
- VIEWER: Dashboard view only

---

## Decision

Implement RBAC using FastAPI dependency injection with the following pattern:

1. Create `require_roles(*allowed_roles)` dependency factory in `deps.py`
2. Use type aliases for common role combinations (e.g., `CanCreateLots`)
3. Apply RBAC dependencies to all route handlers
4. Include role in JWT token payload for efficient validation

---

## Alternatives Considered

### 1. Middleware-based RBAC

**Pros:** Centralized, automatic application

**Cons:** Less flexible, harder to customize per-endpoint

### 2. Decorator-based RBAC

**Pros:** Familiar pattern from Flask

**Cons:** Doesn't integrate well with FastAPI's dependency system

---

## Consequences

### Positive
- Type-safe role checking with IDE support
- Flexible per-endpoint permissions
- Reusable role combinations via type aliases

### Negative
- Every protected endpoint needs explicit dependency
- Must remember to add RBAC to new routes

### Mitigations
- Code review checklist includes RBAC verification
- Integration tests verify all endpoints are protected
```

---

## Validation Gates

### Level 1: Syntax and Style

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

# Run all tests
uv run pytest tests/ -v

# Run specific test files
uv run pytest tests/test_rbac.py -v
uv run pytest tests/test_rate_limiting.py -v
```

### Level 3: Integration Verification

```bash
# Start services
cd backend/docker && docker compose up -d

# Test health endpoint
curl http://localhost:8000/api/health

# Test rate limiting on login (should get 429 after 10 requests)
for i in {1..15}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:8000/api/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com"}'
done

# Test RBAC (should get 401 without token)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/lots
```

---

## Task Checklist (Execution Order)

1. [ ] Add `slowapi>=0.1.9` to `pyproject.toml` and run `uv sync`
2. [ ] Implement `require_roles()` dependency in `backend/app/api/deps.py`
3. [ ] Configure rate limiter in `backend/app/main.py`
4. [ ] Update `backend/app/api/routes/auth.py` with rate limiting and role in JWT
5. [ ] Update `backend/app/api/routes/lots.py` with RBAC and rate limiting
6. [ ] Update `backend/app/api/routes/qc.py` with RBAC and rate limiting
7. [ ] Update `backend/app/api/routes/traceability.py` with RBAC and rate limiting
8. [ ] Create `backend/tests/test_rbac.py` with comprehensive role tests
9. [ ] Create `backend/tests/test_rate_limiting.py`
10. [ ] Create `docs/decisions/0003-rbac-enforcement.md`
11. [ ] Run full validation: `uv run ruff check --fix && uv run mypy app/ && uv run pytest tests/ -v`

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/pyproject.toml` | Modify | Add slowapi dependency |
| `backend/app/api/deps.py` | Modify | Add `require_roles()` + type aliases |
| `backend/app/main.py` | Modify | Configure rate limiter |
| `backend/app/api/routes/auth.py` | Modify | Add rate limit, role in JWT |
| `backend/app/api/routes/lots.py` | Modify | Add RBAC + rate limiting |
| `backend/app/api/routes/qc.py` | Modify | Add RBAC + rate limiting |
| `backend/app/api/routes/traceability.py` | Modify | Add RBAC + rate limiting |
| `backend/app/api/routes/health.py` | Modify | Add rate limiting (no auth) |
| `backend/tests/test_rbac.py` | Create | RBAC test suite |
| `backend/tests/test_rate_limiting.py` | Create | Rate limit tests |
| `docs/decisions/0003-rbac-enforcement.md` | Create | ADR for RBAC |

---

## Anti-Patterns to Avoid

- **DON'T** use `@limiter.limit()` before `@router.post()` (wrong order)
- **DON'T** forget `request: Request` parameter when using rate limiting
- **DON'T** hardcode role strings - use `UserRole` enum
- **DON'T** check roles in route body - use dependency injection
- **DON'T** store secrets in code - use environment variables

---

## References

- [SlowAPI Documentation](https://slowapi.readthedocs.io/)
- [SlowAPI GitHub](https://github.com/laurentS/slowapi)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/)
- [Rate Limiting Best Practices](https://python.plainenglish.io/api-rate-limiting-and-abuse-prevention-at-scale-best-practices-with-fastapi-b5d31d690208)
- [INITIAL-6.md](../INITIAL-6.md) - Original specification

---

**Confidence Score: 8/10**

High confidence due to:
- Clear existing patterns in codebase (deps.py, auth.py)
- Well-documented SlowAPI library
- Straightforward FastAPI dependency injection
- Comprehensive test patterns already established

Potential issues:
- Rate limiting tests may need Redis/Valkey running (use `pytest.mark.skipif` if unavailable)
- Circular import possible between main.py and routes (import limiter carefully)
