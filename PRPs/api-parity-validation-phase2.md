# API Parity Validation PRP: Phase 2 Backend Testing

## Purpose

Implement the API parity validation framework as specified in `INITIAL-2.md`. This addendum to the backend migration establishes:
- Per-endpoint response shape contracts
- Golden snapshots for success AND failure responses
- Negative test coverage for edge cases
- Performance baselines with explicit thresholds
- Structured JSON diff artifacts for parity validation
- Cutover readiness checklist with rollback procedures

## Core Principles

1. **Parity-First Validation**: Every endpoint must have explicit contracts for fields, types, nullable behavior, and error formats
2. **Bidirectional Coverage**: Golden snapshots capture both success (2xx) and failure (4xx/5xx) responses
3. **Fail Fast**: Regression thresholds are explicit and measurable, not subjective
4. **Safe Cutover**: Rollback plan is documented and rehearsed before traffic switch

---

## Goal

Create a comprehensive API parity validation framework that:
- Documents explicit response shape contracts per endpoint
- Captures golden snapshot artifacts for both success and error cases
- Implements negative test coverage (invalid inputs, not-found, boundary cases)
- Establishes performance baselines with percentile-based thresholds
- Produces structured JSON diff artifacts for reviewable parity validation
- Delivers a cutover/rollback checklist for M5 milestone

## Why

- **INITIAL-2.md Compliance**: Addresses clarity gaps identified in the original migration spec
- **Risk Mitigation**: Explicit contracts prevent silent regressions during migration
- **Auditability**: Structured diffs enable PR-reviewable parity validation
- **Production Safety**: Rollback procedures reduce cutover risk

## What

### Deliverables Summary

| Deliverable | Purpose | Location |
|-------------|---------|----------|
| Parity Contract Document | Response shapes per endpoint | `docs/parity/contracts.md` |
| Golden Snapshots (Success) | Baseline success responses | `backend/tests/snapshots/success/` |
| Golden Snapshots (Failure) | Baseline error responses | `backend/tests/snapshots/failure/` |
| Characterization Tests | Validate parity with snapshots | `backend/tests/characterization/` |
| Performance Baselines | Latency thresholds per endpoint | `docs/parity/performance.md` |
| Cutover Checklist | Rollback procedures | `docs/parity/cutover-checklist.md` |

### Success Criteria

- [ ] 5 endpoints have explicit response shape contracts documented
- [ ] Golden snapshots captured for 10+ scenarios (5 success + 5 failure minimum)
- [ ] Negative tests cover: invalid inputs, not-found, boundary values
- [ ] Performance baselines define P50/P95/P99 latency thresholds
- [ ] JSON diff artifacts are reviewable in PR format
- [ ] Cutover checklist includes rollback steps and validation gates

---

## All Needed Context

### Documentation & References

```yaml
# Pytest Snapshot Testing Libraries
- url: https://syrupy-project.github.io/syrupy/
  why: Recommended pytest snapshot plugin with JSON support
  content: JSONSnapshotExtension, automatic .ambr file generation, --snapshot-update flag

- url: https://pypi.org/project/pytest-snapshot/
  why: Alternative lightweight snapshot testing
  content: snapshot fixture, simple assertion API

- url: https://github.com/syrusakbary/snapshottest
  why: Jest-inspired Python snapshot testing
  content: assertMatchSnapshot(), inline snapshots

# FastAPI Testing Best Practices
- url: https://fastapi.tiangolo.com/advanced/async-tests/
  why: Official async testing documentation
  content: httpx.AsyncClient, ASGITransport, pytest.mark.anyio

- url: https://fastapi.tiangolo.com/tutorial/testing/
  why: Basic FastAPI testing patterns
  content: TestClient, dependency overrides, status code assertions

- url: https://blog.greeden.me/en/2025/11/04/fastapi-testing-strategies-to-raise-quality-pytest-testclient-httpx-dependency-overrides-db-rollbacks-mocks-contract-tests-and-load-testing/
  why: Comprehensive testing strategy guide (2025)
  content: Contract tests, load testing, transaction rollbacks, mocking

# Codebase References
- path: backend/tests/characterization/
  why: Existing characterization test patterns to extend

- path: backend/tests/conftest.py
  why: Pytest fixtures and async test setup

- path: flow-viz-react/server/index.js
  why: Node/Express source of truth for response shapes

- path: backend/app/schemas/
  why: Current Pydantic schemas to validate against
```

### Current API Surface (5 Endpoints)

| Endpoint | Method | Node/Express Response | FastAPI Response |
|----------|--------|----------------------|------------------|
| `/api/health` | GET | `{"status": "ok", "timestamp": "ISO8601"}` | ✅ Match |
| `/api/login` | POST | `{"user": {...}, "token": "string"}` | ✅ Match |
| `/api/lots` | POST | Dynamic DB row with all fields | ✅ Match (structured) |
| `/api/qc-decisions` | POST | Dynamic DB row with all fields | ✅ Match (validated) |
| `/api/traceability/{lot_code}` | GET | `{"central": {...}, "parents": [...], "children": [...]}` | ✅ Match |

### Known Differences to Document

```yaml
# Node/Express vs FastAPI Behavioral Differences
differences:
  lot_creation:
    node: "Accepts ANY JSON fields, passes directly to SQL INSERT"
    fastapi: "Structured Pydantic validation, rejects unknown fields"
    parity_decision: "FastAPI returns 422 for invalid fields (acceptable delta)"

  authentication:
    node: "Returns mock token: 'mock-jwt-token-for-mode-c'"
    fastapi: "Returns real JWT token signed with SECRET_KEY"
    parity_decision: "Token format differs but user object shape matches"

  error_format:
    node: "Returns {error: 'message'} for all errors"
    fastapi: "Returns {detail: 'message'} (FastAPI default)"
    parity_decision: "Document as acceptable delta, update frontend if needed"
```

### Response Shape Contracts (Per Endpoint)

```typescript
// GET /api/health
interface HealthResponse {
  status: "ok";
  timestamp: string; // ISO8601 format ending in "Z"
}

// POST /api/login
interface LoginRequest {
  email: string; // EmailStr in Pydantic
}
interface LoginResponse {
  user: {
    id: string;          // UUID
    email: string;
    full_name: string | null;
    role: "ADMIN" | "MANAGER" | "AUDITOR" | "OPERATOR" | "VIEWER";
    created_at: string;  // ISO8601
    last_login: string | null;
  };
  token: string;         // JWT
}
interface LoginErrorResponse {
  detail: string;        // "Invalid credentials" for 401
}

// POST /api/lots
interface LotCreateRequest {
  lot_code: string;              // Required, 1-100 chars
  lot_type?: "RAW" | "DEB" | "BULK" | "MIX" | "SKW" | "FRZ" | "FG";
  production_run_id?: string;    // UUID
  weight_kg?: number;            // 0-10000, 2 decimal places
  temperature_c?: number;        // -50 to 100, 1 decimal place
  metadata?: object;             // JSONB
}
interface LotResponse {
  id: string;
  lot_code: string;
  lot_type: string | null;
  production_run_id: string | null;
  phase_id: string | null;
  operator_id: string | null;
  weight_kg: number | null;
  temperature_c: number | null;
  metadata: object;
  created_at: string;
}

// POST /api/qc-decisions
interface QCDecisionRequest {
  lot_id?: string;
  qc_gate_id?: string;
  decision?: "PASS" | "HOLD" | "FAIL";
  notes?: string;                // Required for HOLD/FAIL (min 10 chars)
  temperature_c?: number;
  digital_signature?: string;
}
interface QCDecisionResponse {
  id: string;
  lot_id: string | null;
  qc_gate_id: string | null;
  operator_id: string | null;
  decision: string | null;
  notes: string | null;
  temperature_c: number | null;
  digital_signature: string | null;
  decided_at: string;
}

// GET /api/traceability/{lot_code}
interface TraceabilityResponse {
  central: LotResponse;
  parents: LotResponse[];
  children: LotResponse[];
}
interface TraceabilityNotFoundResponse {
  detail: string;  // "Lot not found"
}
```

---

## Implementation Blueprint

### Phase 2 Task Breakdown

```yaml
Task 1 - Install Snapshot Testing Library:
  action: Add syrupy to dev dependencies
  files:
    - backend/pyproject.toml
  commands:
    - uv add --dev syrupy
  validation:
    - uv run python -c "import syrupy; print(syrupy.__version__)"

Task 2 - Create Parity Contract Document:
  action: Document response shapes per endpoint
  files:
    - CREATE docs/parity/contracts.md
  content:
    - Response shapes from contracts section above
    - Field types, nullable behavior, error formats
    - Acceptable deltas (authentication tokens, error format)

Task 3 - Capture Golden Success Snapshots:
  action: Generate baseline success response snapshots
  files:
    - backend/tests/snapshots/success/health.json
    - backend/tests/snapshots/success/login.json
    - backend/tests/snapshots/success/lots.json
    - backend/tests/snapshots/success/qc_decisions.json
    - backend/tests/snapshots/success/traceability.json
  validation:
    - Each snapshot matches Node/Express response shape
    - Snapshots are committed to Git for version control

Task 4 - Capture Golden Failure Snapshots:
  action: Generate baseline error response snapshots
  files:
    - backend/tests/snapshots/failure/login_invalid.json
    - backend/tests/snapshots/failure/lots_validation.json
    - backend/tests/snapshots/failure/qc_validation.json
    - backend/tests/snapshots/failure/traceability_not_found.json
  scenarios:
    - 401 Unauthorized (invalid email)
    - 422 Validation Error (missing required fields)
    - 422 Validation Error (boundary violations)
    - 404 Not Found (non-existent lot)

Task 5 - Implement Negative Test Coverage:
  action: Add tests for invalid inputs and edge cases
  files:
    - backend/tests/characterization/test_lots.py
    - backend/tests/characterization/test_qc.py
    - backend/tests/characterization/test_auth.py
    - backend/tests/characterization/test_traceability.py
  test_scenarios:
    lots:
      - Missing lot_code (422)
      - Negative weight (422)
      - Weight > 10000 (422)
      - Temperature < -50 (422)
      - Temperature > 100 (422)
      - Invalid lot_type enum (422)
    qc_decisions:
      - HOLD without notes (422)
      - FAIL without notes (422)
      - HOLD with notes < 10 chars (422)
      - Invalid decision enum (422)
    auth:
      - Non-existent email (401)
      - Invalid email format (422)
    traceability:
      - Non-existent lot_code (404)

Task 6 - Implement Snapshot Assertions:
  action: Update characterization tests to use syrupy
  files:
    - backend/tests/characterization/test_health.py
    - backend/tests/characterization/test_auth.py
    - backend/tests/characterization/test_lots.py
    - backend/tests/characterization/test_qc.py
    - backend/tests/characterization/test_traceability.py
  pattern: |
    from syrupy.extensions.json import JSONSnapshotExtension

    @pytest.fixture
    def snapshot_json(snapshot):
        return snapshot.use_extension(JSONSnapshotExtension)

    async def test_health_response_shape(client, snapshot_json):
        response = await client.get("/api/health")
        assert response.json() == snapshot_json

Task 7 - Define Performance Baselines:
  action: Document latency thresholds per endpoint
  files:
    - CREATE docs/parity/performance.md
  content: |
    | Endpoint | P50 | P95 | P99 | Max |
    |----------|-----|-----|-----|-----|
    | GET /api/health | 5ms | 20ms | 50ms | 100ms |
    | POST /api/login | 50ms | 150ms | 300ms | 500ms |
    | POST /api/lots | 20ms | 80ms | 200ms | 400ms |
    | POST /api/qc-decisions | 20ms | 80ms | 200ms | 400ms |
    | GET /api/traceability/{lot_code} | 30ms | 100ms | 250ms | 500ms |
  notes:
    - Thresholds based on single PostgreSQL query complexity
    - Login includes bcrypt verification (intentionally slower)
    - Traceability includes 3 JOINs (parents + children)

Task 8 - Implement Performance Benchmarks:
  action: Add pytest-benchmark tests for latency validation
  files:
    - backend/tests/performance/test_latency.py
  dependencies:
    - uv add --dev pytest-benchmark
  pattern: |
    @pytest.mark.benchmark
    async def test_health_latency(client, benchmark):
        result = await benchmark(client.get, "/api/health")
        assert result.status_code == 200
        # Threshold validation happens via benchmark comparison

Task 9 - Create Cutover Checklist:
  action: Document cutover and rollback procedures
  files:
    - CREATE docs/parity/cutover-checklist.md
  content:
    pre_cutover:
      - [ ] All characterization tests pass
      - [ ] Snapshot diffs are clean (no unreviewed changes)
      - [ ] Performance within baseline thresholds
      - [ ] Rollback tested in staging environment
    cutover:
      - [ ] Switch reverse proxy to FastAPI (port 8000)
      - [ ] Monitor error rates for 15 minutes
      - [ ] Verify key flows: login, lot creation, traceability
    rollback:
      - [ ] Switch reverse proxy back to Node/Express (port 3000)
      - [ ] Verify Node/Express is responding
      - [ ] Document failure reason for post-mortem
    post_cutover:
      - [ ] Monitor for 24 hours
      - [ ] Compare performance metrics
      - [ ] Schedule Node/Express retirement

Task 10 - Generate JSON Diff Artifacts:
  action: Configure pytest to output reviewable diffs
  files:
    - backend/pytest.ini (update)
    - backend/tests/conftest.py (update)
  configuration: |
    # pytest.ini
    [pytest]
    addopts = --snapshot-warn-unused

    # conftest.py
    @pytest.fixture
    def snapshot_diff_reporter(request):
        """Generate JSON diff artifacts for failed assertions."""
        yield
        # After test, if failed, write diff to artifacts/
```

### Pseudocode: Snapshot Test Pattern

```python
# backend/tests/characterization/test_health.py
import pytest
from httpx import AsyncClient
from syrupy.extensions.json import JSONSnapshotExtension

@pytest.fixture
def snapshot_json(snapshot):
    """Use JSON extension for readable snapshots."""
    return snapshot.use_extension(JSONSnapshotExtension)

@pytest.mark.asyncio
async def test_health_success_response(client: AsyncClient, snapshot_json):
    """
    Characterization test: Health endpoint success response.

    Golden snapshot captures:
    - status: "ok"
    - timestamp: ISO8601 format
    """
    response = await client.get("/api/health")

    assert response.status_code == 200

    # Normalize timestamp for snapshot comparison
    data = response.json()
    data["timestamp"] = "NORMALIZED"  # Timestamps vary

    assert data == snapshot_json

@pytest.mark.asyncio
async def test_login_failure_response(client: AsyncClient, snapshot_json):
    """
    Characterization test: Login with invalid email.

    Golden snapshot captures:
    - 401 status code
    - {"detail": "Invalid credentials"}
    """
    response = await client.post(
        "/api/login",
        json={"email": "nonexistent@flowviz.com"}
    )

    assert response.status_code == 401
    assert response.json() == snapshot_json
```

### Pseudocode: Negative Test Pattern

```python
# backend/tests/characterization/test_lots.py
import pytest
from httpx import AsyncClient

class TestLotValidation:
    """Negative tests for lot creation validation."""

    @pytest.mark.asyncio
    async def test_missing_lot_code_returns_422(self, client: AsyncClient):
        """lot_code is required."""
        response = await client.post(
            "/api/lots",
            json={"lot_type": "RAW", "weight_kg": 100.0}
        )
        assert response.status_code == 422
        assert "lot_code" in response.text.lower()

    @pytest.mark.asyncio
    @pytest.mark.parametrize("weight,expected_error", [
        (-1.0, "greater than or equal to 0"),
        (10001.0, "less than or equal to 10000"),
    ])
    async def test_weight_boundary_validation(
        self, client: AsyncClient, weight: float, expected_error: str
    ):
        """Weight must be 0-10000."""
        response = await client.post(
            "/api/lots",
            json={"lot_code": "TEST-LOT", "weight_kg": weight}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.parametrize("temp", [-51.0, 101.0])
    async def test_temperature_boundary_validation(
        self, client: AsyncClient, temp: float
    ):
        """Temperature must be -50 to 100."""
        response = await client.post(
            "/api/lots",
            json={"lot_code": "TEST-LOT", "temperature_c": temp}
        )
        assert response.status_code == 422
```

### Pseudocode: QC Decision Validation

```python
# backend/tests/characterization/test_qc.py
import pytest
from httpx import AsyncClient

class TestQCDecisionValidation:
    """Negative tests for QC decision validation per CLAUDE.md rules."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("decision", ["HOLD", "FAIL"])
    async def test_hold_fail_requires_notes(
        self, client: AsyncClient, decision: str
    ):
        """HOLD/FAIL decisions require notes (min 10 chars)."""
        # Without notes
        response = await client.post(
            "/api/qc-decisions",
            json={"decision": decision}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.parametrize("decision", ["HOLD", "FAIL"])
    async def test_hold_fail_notes_min_length(
        self, client: AsyncClient, decision: str
    ):
        """Notes must be at least 10 characters."""
        response = await client.post(
            "/api/qc-decisions",
            json={"decision": decision, "notes": "short"}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.parametrize("decision", ["HOLD", "FAIL"])
    async def test_hold_fail_with_valid_notes_succeeds(
        self, client: AsyncClient, decision: str
    ):
        """HOLD/FAIL with proper notes (>=10 chars) succeeds."""
        response = await client.post(
            "/api/qc-decisions",
            json={
                "decision": decision,
                "notes": "Temperature out of range, holding for review"
            }
        )
        assert response.status_code == 201
```

---

## Validation Loop

### Level 1: Syntax and Style

```bash
# Navigate to backend
cd /home/w7-shellsnake/w7-DEV_X1/w7-specsWH-DUNA_v2/backend

# Lint and format
uv run ruff check . --fix
uv run ruff format .

# Type checking
uv run mypy app/ --ignore-missing-imports

# Expected: No errors, no warnings
# If failing: Fix issues before proceeding
```

### Level 2: Unit Tests Pass

```bash
# Run all characterization tests
uv run pytest tests/characterization/ -v

# Run with coverage
uv run pytest tests/characterization/ --cov=app --cov-report=term-missing

# Expected: All tests pass, coverage > 80%
# If failing: Fix implementation or update snapshots
```

### Level 3: Snapshot Validation

```bash
# Run snapshot tests (will create .ambr files on first run)
uv run pytest tests/characterization/ --snapshot-update

# Review snapshot diffs
git diff backend/tests/snapshots/

# Validate snapshots match Node/Express responses
uv run pytest tests/characterization/ -v

# Expected: Snapshots committed, no unreviewed changes
# If failing: Update snapshots or fix implementation
```

### Level 4: Negative Test Coverage

```bash
# Run only negative/failure tests
uv run pytest tests/characterization/ -k "invalid or not_found or validation" -v

# Expected: All negative cases return expected error codes
# - 401 for invalid credentials
# - 404 for not found
# - 422 for validation errors
```

### Level 5: Performance Baseline

```bash
# Run benchmark tests (optional, requires pytest-benchmark)
uv run pytest tests/performance/ --benchmark-only

# Expected: All endpoints within P99 thresholds
# If failing: Investigate query performance, add indexes
```

---

## Final Validation Checklist

### Parity Contract Compliance

- [ ] `docs/parity/contracts.md` documents all 5 endpoints
- [ ] Response shapes match TypeScript interfaces
- [ ] Nullable fields explicitly marked
- [ ] Error formats documented

### Golden Snapshot Coverage

- [ ] Success snapshots for all 5 endpoints
- [ ] Failure snapshots for all error scenarios
- [ ] Snapshots committed to Git
- [ ] `--snapshot-update` not required on clean run

### Negative Test Coverage

- [ ] Missing required fields → 422
- [ ] Boundary violations → 422
- [ ] Invalid email → 401
- [ ] Not found → 404
- [ ] HOLD/FAIL without notes → 422

### Performance Baselines

- [ ] P50/P95/P99 thresholds documented
- [ ] Benchmark tests implemented (optional)
- [ ] No endpoint exceeds P99 threshold

### Cutover Readiness

- [ ] Cutover checklist in `docs/parity/cutover-checklist.md`
- [ ] Rollback procedures documented
- [ ] Validation gates defined

---

## Anti-Patterns to Avoid

### Snapshot Testing

- ❌ Don't snapshot timestamps without normalization (they always change)
- ❌ Don't commit snapshots without reviewing diffs
- ❌ Don't use `--snapshot-update` without understanding changes
- ❌ Don't test implementation details, test response contracts

### Parity Validation

- ❌ Don't assume Node/Express behavior is correct (document it first)
- ❌ Don't ignore error format differences (document as acceptable deltas)
- ❌ Don't skip failure cases (they're critical for parity)
- ❌ Don't merge without clean snapshot diffs

### Performance Testing

- ❌ Don't set arbitrary thresholds (base on actual measurements)
- ❌ Don't test against production database (use test fixtures)
- ❌ Don't ignore outliers (P99 matters for reliability)

---

## Quick Reference

### Commands

```bash
# Full validation suite
cd backend && uv run pytest tests/characterization/ -v --cov=app

# Update snapshots (after reviewing changes)
uv run pytest tests/characterization/ --snapshot-update

# Run specific endpoint tests
uv run pytest tests/characterization/test_health.py -v
uv run pytest tests/characterization/test_auth.py -v
uv run pytest tests/characterization/test_lots.py -v
uv run pytest tests/characterization/test_qc.py -v
uv run pytest tests/characterization/test_traceability.py -v

# Quality checks
uv run ruff check . --fix && uv run mypy app/
```

### File Locations

| Artifact | Path |
|----------|------|
| Parity Contracts | `docs/parity/contracts.md` |
| Performance Baselines | `docs/parity/performance.md` |
| Cutover Checklist | `docs/parity/cutover-checklist.md` |
| Success Snapshots | `backend/tests/snapshots/success/` |
| Failure Snapshots | `backend/tests/snapshots/failure/` |
| Characterization Tests | `backend/tests/characterization/` |

---

## Confidence Score

**8/10** — High confidence for one-pass implementation

### Strengths
- Existing characterization tests provide foundation
- Clear response shapes from Node/Express code
- Well-documented validation rules in CLAUDE.md
- Syrupy is mature and well-documented

### Risks
- Performance thresholds are estimates (need actual measurements)
- Snapshot normalization for timestamps requires care
- Error format delta (detail vs error) may need frontend update

---

## Sources

- [Syrupy - Pytest Snapshot Plugin](https://syrupy-project.github.io/syrupy/)
- [FastAPI Async Tests](https://fastapi.tiangolo.com/advanced/async-tests/)
- [FastAPI Testing Tutorial](https://fastapi.tiangolo.com/tutorial/testing/)
- [FastAPI Testing Strategies (2025)](https://blog.greeden.me/en/2025/11/04/fastapi-testing-strategies-to-raise-quality-pytest-testclient-httpx-dependency-overrides-db-rollbacks-mocks-contract-tests-and-load-testing/)
- [pytest-snapshot PyPI](https://pypi.org/project/pytest-snapshot/)
- [snapshottest GitHub](https://github.com/syrusakbary/snapshottest)

---

_PRP generated for INITIAL-2.md addendum. Implements API parity validation framework for Phase 2 backend testing._
