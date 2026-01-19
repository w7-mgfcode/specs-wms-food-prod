# Security Hardening Foundation: RBAC, Rate Limiting & Secrets Management

> **Phase:** 4.1 - Security Hardening  
> **Sprint:** Week 1-4  
> **Priority:** CRITICAL (Must complete before production)  
> **Date:** January 19, 2026  
> **Version:** 1.0

---

## FEATURE:

Implement comprehensive security hardening for the Food Production WMS, establishing the foundational security layer required before any production deployment. This specification covers three critical security components:

1. **Role-Based Access Control (RBAC):** Enforce role-based permissions at the FastAPI API layer using dependency injection, ensuring only authorized users can perform sensitive operations (create lots, delete production runs, access traceability data).

2. **Rate Limiting:** Prevent brute-force attacks, API abuse, and denial-of-service vectors by implementing request rate limiting with SlowAPI backed by Valkey, protecting authentication endpoints and high-value operations.

3. **Secrets Management:** Migrate from insecure environment variables to enterprise-grade secrets management (AWS Secrets Manager or HashiCorp Vault), eliminating hardcoded credentials and enabling secure secret rotation.

The system must maintain HACCP compliance for food traceability while enforcing strict access controls for lot registration, QC decisions, and audit trail access across 5 distinct roles: ADMIN, MANAGER, AUDITOR, OPERATOR, and VIEWER.

**Success Criteria:**
- All API endpoints protected with RBAC (100% coverage)
- Rate limiting active on all endpoints (zero brute-force vulnerability)
- Zero secrets in code, environment variables, or docker-compose files
- All changes backward-compatible with existing frontend

---

## TOOLS:

- **require_role(*allowed_roles: str) -> Callable**: FastAPI dependency for role-based access control. Returns a role checker function that validates JWT tokens and verifies user role membership. Raises 401 for invalid/expired tokens, 403 for insufficient permissions. Example: `Depends(require_role("ADMIN", "MANAGER"))`.

- **decode_access_token(token: str) -> dict | None**: Decodes and validates a JWT access token. Returns payload with user_id, email, role, and expiration. Returns None for invalid tokens. Used internally by RBAC middleware.

- **get_secret(secret_name: str, region: str = "us-east-1") -> dict**: Fetches secrets from AWS Secrets Manager (cached with @lru_cache). Returns dictionary of secret key-value pairs. Fallback to environment variables in development mode.

- **get_vault_client() -> hvac.Client**: Returns authenticated HashiCorp Vault client using AppRole authentication. Used for on-premise or multi-cloud deployments as alternative to AWS Secrets Manager.

- **limiter.limit(rate: str) -> Callable**: SlowAPI decorator for rate limiting endpoints. Rate format: "N/period" (e.g., "10/minute", "100/hour"). Supports per-IP and per-user limiting. Requires `request: Request` as first parameter.

- **audit_log_access(user_id: str, endpoint: str, action: str) -> None**: Records access audit log entry to immutable audit table. Called automatically by RBAC middleware on successful authorization. Required for HACCP compliance.

---

## DEPENDENCIES:

### Python Packages (Backend)
```toml
# backend/pyproject.toml additions
[project.dependencies]
slowapi = "^0.1.9"
boto3 = "^1.35.0"          # For AWS Secrets Manager
hvac = "^2.3.0"             # For HashiCorp Vault (optional)
python-jose = { extras = ["cryptography"], version = "^3.3.0" }
bcrypt = "^4.2.0"
```

### Infrastructure Services
- **Valkey 8.1+:** Rate limiting storage backend (existing)
- **AWS Secrets Manager:** Production secrets storage (or HashiCorp Vault)
- **PostgreSQL 17:** Audit log storage (existing)

### Frontend Dependencies
- No frontend changes required for this phase
- Existing auth token handling compatible with RBAC

---

## SYSTEM PROMPT(S):

### Security Implementation Prompt
```
You are implementing security hardening for a Food Production WMS with HACCP compliance requirements. Follow these strict security principles:

**RBAC Implementation:**
- Use FastAPI dependency injection for role checks (Depends pattern)
- Never trust client-provided role claims without JWT verification
- Log all authorization decisions for audit compliance
- Fail closed: deny access on any validation error
- Include X-Required-Roles header in 403 responses for debugging

**Rate Limiting:**
- Apply rate limits before authentication (prevent brute-force)
- Use fixed-window-elastic-expiry strategy for predictable limits
- Store rate limit state in Valkey for horizontal scaling
- Return 429 Too Many Requests with Retry-After header
- Lower limits for destructive operations (DELETE, sensitive POST)

**Secrets Management:**
- NEVER log secrets, even at DEBUG level
- Use @lru_cache for secret retrieval (reduce API calls)
- Fail hard in production if secrets unavailable
- Allow fallback to environment variables only in development
- Implement secret rotation support (quarterly requirement)

**Testing Requirements:**
- Test every role against every endpoint (permission matrix)
- Test invalid tokens (expired, malformed, wrong signature)
- Test rate limit exhaustion and recovery
- Mock secrets manager in tests (never use real secrets)
```

### Code Review Checklist
```
Before merging security code, verify:
[ ] All routes have RBAC decorators applied
[ ] No secrets in source code, configs, or docker files
[ ] Rate limits configured per Rate Limit Configuration table
[ ] Unit tests cover all authorization paths (happy + failure)
[ ] Audit logging enabled for data modification endpoints
[ ] ADR created for any security architecture decisions
```

---

## IMPLEMENTATION:

### P4: RBAC Middleware Implementation

**Objective:** Enforce role-based access control at FastAPI endpoint level

```python
# backend/app/api/deps.py
from fastapi import Depends, HTTPException, Header, status
from app.services.auth import decode_access_token
from app.services.audit import audit_log_access
from typing import Callable
import logging

logger = logging.getLogger(__name__)

async def require_role(*allowed_roles: str) -> Callable:
    """FastAPI dependency for role-based access control.
    
    Args:
        *allowed_roles: Variable number of role names that are permitted
        
    Returns:
        Callable dependency that validates JWT and checks role membership
        
    Raises:
        HTTPException 401: Invalid or expired token
        HTTPException 403: User role not in allowed_roles
    """
    async def role_checker(
        authorization: str = Header(..., alias="Authorization"),
    ) -> dict:
        # Validate header format
        if not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header format",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Extract and decode token
        token = authorization.replace("Bearer ", "")
        payload = decode_access_token(token)
        
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check role permission
        user_role = payload.get("role")
        if user_role not in allowed_roles:
            logger.warning(
                f"Access denied: user={payload.get('sub')} "
                f"role={user_role} required={allowed_roles}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(allowed_roles)}",
                headers={"X-Required-Roles": ", ".join(allowed_roles)},
            )
        
        # Log successful authorization (for audit)
        await audit_log_access(
            user_id=payload.get("sub"),
            action="authorize",
            resource=f"role:{user_role}",
        )
        
        return payload
    
    return role_checker


# Usage examples in routes
@router.delete("/production-runs/{run_id}")
async def delete_production_run(
    run_id: str,
    current_user: dict = Depends(require_role("ADMIN", "MANAGER")),
    db: AsyncSession = Depends(get_db),
):
    """Only ADMIN and MANAGER can delete production runs."""
    # Implementation here
    pass


@router.post("/lots")
async def create_lot(
    lot: LotCreate,
    current_user: dict = Depends(require_role("ADMIN", "MANAGER", "OPERATOR")),
    db: AsyncSession = Depends(get_db),
):
    """VIEWER role cannot create lots."""
    # Implementation here
    pass


@router.get("/traceability/{lot_id}")
async def get_lot_traceability(
    lot_id: str,
    current_user: dict = Depends(require_role("ADMIN", "MANAGER", "AUDITOR", "OPERATOR", "VIEWER")),
    db: AsyncSession = Depends(get_db),
):
    """All authenticated users can view traceability (read-only for compliance)."""
    # Implementation here
    pass
```

**Permission Matrix:**
| Endpoint | ADMIN | MANAGER | AUDITOR | OPERATOR | VIEWER |
|----------|-------|---------|---------|----------|--------|
| GET /lots | ✓ | ✓ | ✓ | ✓ | ✓ |
| POST /lots | ✓ | ✓ | ✗ | ✓ | ✗ |
| PUT /lots/{id} | ✓ | ✓ | ✗ | ✓ | ✗ |
| DELETE /lots/{id} | ✓ | ✗ | ✗ | ✗ | ✗ |
| POST /qc-decisions | ✓ | ✓ | ✓ | ✓ | ✗ |
| DELETE /production-runs | ✓ | ✓ | ✗ | ✗ | ✗ |
| GET /traceability/* | ✓ | ✓ | ✓ | ✓ | ✓ |
| GET /audit-logs | ✓ | ✗ | ✓ | ✗ | ✗ |
| POST /users | ✓ | ✗ | ✗ | ✗ | ✗ |
| PUT /users/{id}/role | ✓ | ✗ | ✗ | ✗ | ✗ |

---

### S3: Rate Limiting Implementation

**Objective:** Prevent brute-force attacks and API abuse

```python
# backend/app/main.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# Initialize limiter with Valkey backend for distributed rate limiting
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.redis_url,  # Valkey is Redis-compatible
    strategy="fixed-window-elastic-expiry",
    default_limits=["200/minute"],  # Fallback for unlisted endpoints
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


# Apply rate limits in routes
from app.main import limiter

@router.post("/login")
@limiter.limit("10/minute")  # Strict: prevent brute-force
async def login(request: Request, credentials: LoginRequest):
    """Rate limit: 10 attempts per minute to prevent brute-force attacks."""
    pass


@router.post("/lots")
@limiter.limit("100/minute")
async def create_lot(request: Request, lot: LotCreate, ...):
    """Rate limit: 100 lot registrations per minute per IP (normal: 1-2/sec)."""
    pass


@router.post("/qc-decisions")
@limiter.limit("100/minute")
async def create_qc_decision(request: Request, decision: QCDecisionCreate, ...):
    """Rate limit: 100 QC decisions per minute per IP."""
    pass


@router.get("/traceability/{lot_id}")
@limiter.limit("50/minute")
async def get_traceability(request: Request, lot_id: str, ...):
    """Rate limit: 50 traceability queries per minute (expensive operation)."""
    pass


@router.delete("/production-runs/{run_id}")
@limiter.limit("20/minute")
async def delete_production_run(request: Request, run_id: str, ...):
    """Rate limit: 20 deletions per minute (destructive operation)."""
    pass
```

**Rate Limit Configuration Table:**
| Endpoint | Limit | Rationale |
|----------|-------|-----------|
| POST /login | 10/minute | Prevent brute-force password attacks |
| POST /refresh-token | 10/minute | Prevent token abuse |
| POST /lots | 100/minute | Normal operation (factory throughput) |
| POST /qc-decisions | 100/minute | Normal QC gate processing |
| GET /traceability/* | 50/minute | Expensive recursive queries |
| DELETE /* | 20/minute | Destructive operations |
| GET /lots | 200/minute | Read operations (higher limit) |
| GET /production-runs | 200/minute | Read operations |
| Default | 200/minute | Fallback for unlisted endpoints |

---

### S1: Secrets Management Migration

**Objective:** Move from environment variables to AWS Secrets Manager (or Vault)

**Option A: AWS Secrets Manager (Recommended for AWS deployment)**
```python
# backend/app/config.py
import boto3
from botocore.exceptions import ClientError
from functools import lru_cache
import json
from pydantic_settings import BaseSettings
import logging

logger = logging.getLogger(__name__)


@lru_cache(maxsize=8)
def get_aws_secret(secret_name: str, region: str = "us-east-1") -> dict:
    """Fetch secret from AWS Secrets Manager (cached for performance).
    
    Args:
        secret_name: Name of secret in AWS Secrets Manager
        region: AWS region where secret is stored
        
    Returns:
        Dictionary of secret key-value pairs
        
    Note:
        Results are cached to minimize API calls. 
        Cache is invalidated on application restart.
        For secret rotation, deploy new application version.
    """
    try:
        client = boto3.client('secretsmanager', region_name=region)
        response = client.get_secret_value(SecretId=secret_name)
        return json.loads(response['SecretString'])
    except ClientError as e:
        logger.error(f"Failed to fetch secret {secret_name}: {e}")
        raise


class Settings(BaseSettings):
    """Application settings with production-safe secret handling."""
    
    environment: str = "development"
    aws_region: str = "us-east-1"
    
    # Development fallbacks (NEVER used in production)
    _dev_secret_key: str = "INSECURE-DEV-ONLY-CHANGE-ME"
    _dev_database_url: str = "postgresql+asyncpg://admin:password@localhost:5432/flowviz"
    _dev_redis_url: str = "redis://localhost:6379/0"
    
    @property
    def is_production(self) -> bool:
        return self.environment.lower() in ("production", "prod", "staging")
    
    @property
    def secret_key(self) -> str:
        """JWT signing key - from Secrets Manager in production."""
        if self.is_production:
            secrets = get_aws_secret("flowviz/api", self.aws_region)
            return secrets["secret_key"]
        return self._dev_secret_key
    
    @property
    def database_url(self) -> str:
        """Database connection string - from Secrets Manager in production."""
        if self.is_production:
            secrets = get_aws_secret("flowviz/database", self.aws_region)
            return secrets["url"]
        return self._dev_database_url
    
    @property
    def redis_url(self) -> str:
        """Valkey/Redis connection string - from Secrets Manager in production."""
        if self.is_production:
            secrets = get_aws_secret("flowviz/cache", self.aws_region)
            return secrets["url"]
        return self._dev_redis_url
    
    def validate_production_settings(self) -> None:
        """Validate that production settings are properly configured.
        
        Raises:
            ValueError: If production settings are invalid
        """
        if self.is_production:
            if "INSECURE" in self.secret_key:
                raise ValueError(
                    "CRITICAL: Production detected but using insecure secret key. "
                    "Configure AWS Secrets Manager correctly."
                )
            logger.info("Production settings validated successfully")


settings = Settings()
```

**Option B: HashiCorp Vault (For on-premise or multi-cloud)**
```python
# backend/app/config_vault.py
import hvac
from functools import lru_cache
import os
import logging

logger = logging.getLogger(__name__)


@lru_cache
def get_vault_client() -> hvac.Client:
    """Get authenticated Vault client using AppRole authentication.
    
    Environment variables required:
        VAULT_ADDR: Vault server URL
        VAULT_ROLE_ID: AppRole role ID
        VAULT_SECRET_ID: AppRole secret ID
    """
    client = hvac.Client(url=os.getenv("VAULT_ADDR"))
    client.auth.approle.login(
        role_id=os.getenv("VAULT_ROLE_ID"),
        secret_id=os.getenv("VAULT_SECRET_ID"),
    )
    if not client.is_authenticated():
        raise RuntimeError("Failed to authenticate with Vault")
    return client


def get_vault_secret(path: str) -> dict:
    """Fetch secret from Vault KV v2 secrets engine.
    
    Args:
        path: Secret path (e.g., "flowviz/database")
        
    Returns:
        Dictionary of secret key-value pairs
    """
    client = get_vault_client()
    secret = client.secrets.kv.v2.read_secret_version(path=path)
    return secret['data']['data']
```

**Secrets to Migrate:**
| Secret Name | Current Location | Target Secret Path |
|-------------|------------------|-------------------|
| SECRET_KEY | .env | flowviz/api → secret_key |
| DATABASE_URL | docker-compose.yml | flowviz/database → url |
| REDIS_URL | docker-compose.yml | flowviz/cache → url |
| SMTP_PASSWORD | N/A | flowviz/email → password |

**AWS Secrets Manager Setup (Terraform):**
```hcl
# infrastructure/secrets.tf
resource "aws_secretsmanager_secret" "flowviz_api" {
  name        = "flowviz/api"
  description = "FlowViz API secrets (JWT key)"
}

resource "aws_secretsmanager_secret_version" "flowviz_api" {
  secret_id = aws_secretsmanager_secret.flowviz_api.id
  secret_string = jsonencode({
    secret_key = var.jwt_secret_key  # From secure input
  })
}

resource "aws_secretsmanager_secret" "flowviz_database" {
  name        = "flowviz/database"
  description = "FlowViz database connection string"
}

# IAM policy for EC2/ECS to access secrets
resource "aws_iam_policy" "secrets_access" {
  name = "flowviz-secrets-read"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.flowviz_api.arn,
        aws_secretsmanager_secret.flowviz_database.arn,
      ]
    }]
  })
}
```

---

## TESTING:

### RBAC Test Suite
```python
# backend/tests/test_rbac.py
import pytest
from httpx import AsyncClient
from app.services.auth import create_access_token

# Test tokens for each role
def get_token_for_role(role: str) -> str:
    return create_access_token(
        data={"sub": f"{role.lower()}@test.com", "role": role}
    )


@pytest.mark.asyncio
async def test_operator_cannot_delete_runs(client: AsyncClient):
    """OPERATOR role should get 403 when attempting to delete production runs."""
    token = get_token_for_role("OPERATOR")
    
    resp = await client.delete(
        "/api/v1/production-runs/test-run-id",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert resp.status_code == 403
    assert "Requires one of: ADMIN, MANAGER" in resp.json()["detail"]
    assert resp.headers.get("X-Required-Roles") == "ADMIN, MANAGER"


@pytest.mark.asyncio
async def test_viewer_cannot_create_lots(client: AsyncClient):
    """VIEWER role should get 403 when attempting to create lots."""
    token = get_token_for_role("VIEWER")
    
    resp = await client.post(
        "/api/v1/lots",
        headers={"Authorization": f"Bearer {token}"},
        json={"lot_code": "TEST-001", "lot_type": "RAW"}
    )
    
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_auditor_can_view_audit_logs(client: AsyncClient):
    """AUDITOR role should have access to audit logs."""
    token = get_token_for_role("AUDITOR")
    
    resp = await client.get(
        "/api/v1/audit-logs",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_invalid_token_returns_401(client: AsyncClient):
    """Invalid JWT token should return 401 Unauthorized."""
    resp = await client.get(
        "/api/v1/lots",
        headers={"Authorization": "Bearer invalid.token.here"}
    )
    
    assert resp.status_code == 401
    assert "Invalid or expired token" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_missing_auth_header_returns_401(client: AsyncClient):
    """Missing Authorization header should return 401."""
    resp = await client.get("/api/v1/lots")
    
    assert resp.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["ADMIN", "MANAGER", "AUDITOR", "OPERATOR", "VIEWER"])
async def test_all_roles_can_view_traceability(client: AsyncClient, role: str):
    """All authenticated roles should access traceability (compliance requirement)."""
    token = get_token_for_role(role)
    
    resp = await client.get(
        "/api/v1/traceability/TEST-LOT-001",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    # 200 or 404 (not found) - but NOT 403 (forbidden)
    assert resp.status_code in (200, 404)
```

### Rate Limiting Test Suite
```python
# backend/tests/test_rate_limiting.py
import pytest
from httpx import AsyncClient
import asyncio


@pytest.mark.asyncio
async def test_login_rate_limit_exceeded(client: AsyncClient):
    """Exceeding login rate limit should return 429."""
    # Make 11 requests (limit is 10/minute)
    for i in range(11):
        resp = await client.post(
            "/api/login",
            json={"email": "test@test.com", "password": "wrong"}
        )
        if resp.status_code == 429:
            # Verify rate limit response
            assert "Too Many Requests" in resp.text
            assert "Retry-After" in resp.headers
            return
    
    pytest.fail("Rate limit was not triggered after 11 requests")


@pytest.mark.asyncio
async def test_rate_limit_recovery(client: AsyncClient):
    """Rate limit should reset after window expires."""
    # Exhaust rate limit
    for _ in range(15):
        await client.post("/api/login", json={"email": "x", "password": "x"})
    
    # Wait for rate limit window to reset (in test, use shorter window)
    await asyncio.sleep(2)  # Adjust based on test config
    
    # Should be allowed again
    resp = await client.post(
        "/api/login",
        json={"email": "valid@test.com", "password": "valid"}
    )
    assert resp.status_code != 429
```

---

## EXAMPLES:

### Existing Project Examples
- `backend/app/services/auth.py` - JWT token handling (existing implementation)
- `backend/app/api/deps.py` - Current dependency injection patterns
- `backend/tests/conftest.py` - Test fixtures and async client setup

### Reference Implementations
- FastAPI Security: https://fastapi.tiangolo.com/tutorial/security/
- SlowAPI Documentation: https://slowapi.readthedocs.io/
- AWS Secrets Manager: https://docs.aws.amazon.com/secretsmanager/

---

## DOCUMENTATION:

### Internal Documentation
- `CLAUDE.md` - AI coding guidance (lines 180-220: security patterns)
- `docs/decisions/0003-rbac-enforcement.md` - ADR for RBAC design (to be created)
- `docs/SETUP.md` - Development environment (update for secrets setup)

### External Documentation
- FastAPI Security: https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
- SlowAPI: https://slowapi.readthedocs.io/
- AWS Secrets Manager: https://docs.aws.amazon.com/secretsmanager/
- HashiCorp Vault: https://developer.hashicorp.com/vault/docs

---

## OTHER CONSIDERATIONS:

### Immediate Action Items (Week 1-2)

**Week 1 (Jan 20-24, 2026):**
- [ ] Day 1-2: Implement `require_role()` dependency in `backend/app/api/deps.py`
- [ ] Day 3: Apply RBAC to all routes in `backend/app/api/routes/`
- [ ] Day 4: Write RBAC test suite (`backend/tests/test_rbac.py`)
- [ ] Day 5: Install and configure SlowAPI with Valkey backend

**Week 2 (Jan 27-31, 2026):**
- [ ] Day 1: Apply rate limits to all endpoints per configuration table
- [ ] Day 2: Write rate limiting tests (`backend/tests/test_rate_limiting.py`)
- [ ] Day 3-4: Implement secrets management (AWS or Vault decision required)
- [ ] Day 5: Update documentation and create ADR

### Critical Decisions Required

| Decision | Options | Deadline | Owner | Impact |
|----------|---------|----------|-------|--------|
| Secrets Provider | AWS Secrets Manager vs HashiCorp Vault | Day 1 Week 2 | DevOps Lead | Determines config.py implementation |
| AWS Region | us-east-1, eu-west-1, etc. | Day 1 Week 2 | Ops Team | Secret path configuration |
| Rate Limit Tuning | Default limits adequate? | Week 3 | Backend Lead | May need adjustment after testing |

### Risk Mitigation

**Risk: Existing frontend breaks after RBAC enforcement**
- **Mitigation:** Test all frontend flows before deployment
- **Fallback:** Add temporary bypass for legacy endpoints (time-limited)

**Risk: Rate limits too aggressive for production**
- **Mitigation:** Start with higher limits, reduce after baseline established
- **Fallback:** Quick config change (no code deployment needed)

**Risk: Secrets Manager unavailable**
- **Mitigation:** Health check on startup, fail fast with clear error
- **Fallback:** Emergency env var override (requires deployment)

### Deliverables Checklist

- [ ] `backend/app/api/deps.py` - RBAC dependency injection
- [ ] `backend/app/api/routes/*.py` - All routes updated with role decorators
- [ ] `backend/app/main.py` - SlowAPI rate limiting configured
- [ ] `backend/app/config.py` - Secrets management integration
- [ ] `backend/tests/test_rbac.py` - 100% endpoint permission coverage
- [ ] `backend/tests/test_rate_limiting.py` - Rate limit behavior tests
- [ ] `docs/decisions/0003-rbac-enforcement.md` - Architecture Decision Record
- [ ] `docs/decisions/0004-secrets-management.md` - Architecture Decision Record
- [ ] `docs/SETUP.md` - Updated with secrets configuration

**Effort Estimate:** 8 days (1 backend engineer + 1 DevOps engineer part-time)

---

**Document Version:** 1.0  
**Phase:** 4.1 - Security Hardening Foundation  
**Last Updated:** January 19, 2026  
**Next Phase:** INITIAL-7.md (Infrastructure & Observability)
