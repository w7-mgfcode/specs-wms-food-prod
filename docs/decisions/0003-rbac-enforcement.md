# ADR 0003: Role-Based Access Control (RBAC) Enforcement

**Status:** Accepted
**Date:** 2026-01-19
**Decision Makers:** Backend Team

---

## Context

The FlowViz WMS requires strict access controls for HACCP compliance in food production. Different user roles need different permissions:

- **ADMIN**: Full system access, user management
- **MANAGER**: Production oversight, QC overrides
- **AUDITOR**: Read-only access to all data, QC decisions for audit purposes
- **OPERATOR**: Lot registration, QC decisions
- **VIEWER**: Dashboard view only

The Node/Express backend had no formal RBAC enforcement. During the FastAPI migration, we need to implement proper access controls that:

1. Protect sensitive operations (lot creation, QC decisions)
2. Allow compliance-required access (traceability for all authenticated users)
3. Prevent unauthorized access with clear error responses
4. Integrate cleanly with FastAPI's dependency injection pattern

---

## Decision

Implement RBAC using FastAPI dependency injection with the following pattern:

### 1. Dependency Factory Pattern

Create `require_roles(*allowed_roles)` in `app/api/deps.py` that:
- Returns a dependency function that checks user role membership
- Raises 401 if not authenticated
- Raises 403 with `X-Required-Roles` header if role not permitted

```python
def require_roles(*allowed_roles: UserRole) -> Callable[[User], User]:
    async def role_checker(user: Annotated[User, Depends(get_current_user_required)]) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Requires one of: {', '.join(r.value for r in allowed_roles)}",
                headers={"X-Required-Roles": ", ".join(r.value for r in allowed_roles)},
            )
        return user
    return role_checker
```

### 2. Type Aliases for Common Patterns

```python
AdminOnly = Annotated[User, Depends(require_roles(UserRole.ADMIN))]
CanCreateLots = Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR))]
CanMakeQCDecisions = Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AUDITOR, UserRole.OPERATOR))]
AllAuthenticated = Annotated[User, Depends(require_roles(*UserRole))]
```

### 3. Route Integration

```python
@router.post("/lots", status_code=201)
async def create_lot(lot_data: LotCreate, db: DBSession, current_user: CanCreateLots):
    ...
```

### 4. JWT Token Enhancement

Include `role` in JWT payload for efficient validation:
```python
token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
```

---

## Permission Matrix

| Endpoint | ADMIN | MANAGER | AUDITOR | OPERATOR | VIEWER |
|----------|:-----:|:-------:|:-------:|:--------:|:------:|
| GET /health | - | - | - | - | - |
| POST /login | - | - | - | - | - |
| GET /lots | ✓ | ✓ | ✓ | ✓ | ✓ |
| POST /lots | ✓ | ✓ | ✗ | ✓ | ✗ |
| POST /qc-decisions | ✓ | ✓ | ✓ | ✓ | ✗ |
| GET /traceability/* | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Alternatives Considered

### 1. Middleware-based RBAC

**Approach:** Check roles in middleware based on route path patterns.

**Pros:**
- Centralized, automatic application
- No need to modify each route

**Cons:**
- Less flexible per-endpoint customization
- Path matching can be error-prone
- Harder to test in isolation

**Decision:** Rejected - too inflexible for varying permission requirements.

### 2. Decorator-based RBAC

**Approach:** Use `@requires_role(UserRole.ADMIN)` decorator pattern.

**Pros:**
- Familiar pattern from Flask
- Explicit permission at route level

**Cons:**
- Doesn't integrate well with FastAPI's dependency system
- Can't compose with other dependencies elegantly
- Less type-safe

**Decision:** Rejected - dependency injection is more idiomatic for FastAPI.

### 3. Policy-based Authorization (Casbin/OPA)

**Approach:** Use external policy engine for authorization decisions.

**Pros:**
- Externalized, auditable policies
- Powerful rule composition

**Cons:**
- Additional infrastructure dependency
- Over-engineered for current needs
- Learning curve for team

**Decision:** Rejected for MVP - may revisit for enterprise features.

---

## Consequences

### Positive

- **Type-safe:** IDE support and compile-time checking via type aliases
- **Flexible:** Per-endpoint permission customization
- **Testable:** Dependencies can be mocked/overridden in tests
- **Self-documenting:** Type aliases like `CanCreateLots` are descriptive
- **Consistent:** Same pattern across all routes
- **HACCP Compliant:** Clear audit trail for who can do what

### Negative

- **Explicit:** Every protected endpoint needs RBAC dependency
- **Verbose:** Initial setup requires adding dependencies to all routes
- **Enforcement:** Must remember to add RBAC to new routes

### Mitigations

1. **Code review checklist** includes RBAC verification for all new endpoints
2. **Integration tests** verify all endpoints are protected (see `test_rbac.py`)
3. **Type aliases** reduce boilerplate and encourage reuse
4. **Documentation** includes permission matrix for reference

---

## Implementation Checklist

- [x] Create `require_roles()` dependency factory in `deps.py`
- [x] Add role-specific type aliases
- [x] Update JWT token to include role claim
- [x] Apply RBAC to all routes:
  - [x] `/lots` (GET: all, POST: CanCreateLots)
  - [x] `/qc-decisions` (POST: CanMakeQCDecisions)
  - [x] `/traceability/*` (GET: AllAuthenticated)
- [x] Create comprehensive RBAC test suite
- [x] Create this ADR

---

## Related Documents

- [CLAUDE.md](../../CLAUDE.md) - Roles & Permissions section
- [INITIAL-6.md](../../INITIAL-6.md) - Security Hardening specification
- [test_rbac.py](../../backend/tests/test_rbac.py) - RBAC test suite
