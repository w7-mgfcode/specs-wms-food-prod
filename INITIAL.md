# Backend Refactor INITIAL Spec

## Constraints + Examples

### Constraints
- **Tech stack** must match the preferred list (minimums/compatible ranges):
  - Python 3.13+, FastAPI >=0.125, SQLAlchemy 2.0.x (async), Pydantic 2.11+, PostgreSQL 17.x, Valkey 8.1+, Alembic 1.14+, Celery 5.4+, asyncpg (latest), bcrypt 4.x, python-jose (latest).
- **Docker-first** workflow: services should run in containers and support side-by-side validation.
- **Safe refactor** workflow:
  - Baseline snapshot tests (golden output).
  - Add characterization tests (if missing).
  - Refactor in small SRP steps.
  - Validate after each step.
  - Remove dead code + simplify.
  - Final: coverage + diff review.
- **API parity** must be maintained during migration (no breaking changes until cutover).

### Examples (Current API surface)
- `GET /api/health`
- `POST /api/login`
- `GET /api/traceability/:lotCode`
- `POST /api/lots`
- `POST /api/qc-decisions`

## Research Options (3–5)

1. **Strangler pattern (side-by-side FastAPI)**
   - Stand up FastAPI in Docker; route a subset of endpoints via reverse proxy.
2. **Full rewrite with feature freeze**
   - Freeze Node/Express changes; rewrite all endpoints before switching traffic.
3. **Incremental replacement behind API gateway**
   - Gateway routes requests to Node or FastAPI based on path/version.
4. **Hybrid microservice split**
   - Keep Node/Express for existing endpoints, introduce FastAPI for new async-heavy services (traceability, audits), then migrate core endpoints.

## Tradeoffs (Cost / Risk / Time)

| Option | Cost | Risk | Time | Notes |
| --- | --- | --- | --- | --- |
| Strangler pattern | Medium | Low | Medium | Enables parity checks and gradual cutover. |
| Full rewrite | High | High | Long | Highest regression risk; big-bang release. |
| API gateway split | Medium | Medium | Medium | More infra complexity, clear routing. |
| Hybrid microservice | Medium | Medium | Medium | Faster for new features, slower full migration. |

## MVP Decision

**Choose: Strangler pattern (side-by-side FastAPI)**
- Lowest risk path with safe refactor constraints.
- Supports characterization testing and stepwise parity validation.
- Compatible with Docker-first workflow.

## Milestones

1. **M0: Foundations**
   - Docker Compose with FastAPI + Postgres 17.x + Valkey.
   - Health endpoint parity and environment configuration.
2. **M1: Data layer**
   - SQLAlchemy async models and session management.
   - Alembic migrations (reflect existing schema as needed).
3. **M2: Auth**
   - Login flow with bcrypt + python-jose tokens.
   - Pydantic schemas with validators.
4. **M3: API parity**
   - Traceability, lots, QC decisions endpoints.
   - Characterization tests validate output parity.
5. **M4: Async + cache**
   - Valkey caching for read-heavy endpoints.
   - Celery tasks for heavy traceability/audit jobs.
6. **M5: Cutover + cleanup**
   - Route traffic to FastAPI.
   - Retire Node/Express service after parity and monitoring goals met.

## Validation Checkpoints

- **Baseline**: snapshot/golden output captured for all current endpoints.
- **Per milestone**:
  - Characterization tests pass.
  - Response payloads unchanged (or explicitly documented and approved).
  - Docker Compose up/down cleanly.
  - Performance does not regress beyond agreed thresholds.
- **Final**:
  - Coverage target met.
  - Diff review complete with explicit approval of any behavior changes.

## Final Spec (Deliverables)

- Docker Compose with:
  - FastAPI app (Python 3.13)
  - PostgreSQL 17.x
  - Valkey 8.1
- FastAPI backend with async SQLAlchemy models and Pydantic schemas.
- Alembic migrations aligned to the existing database.
- Celery task queue and worker setup.
- Characterization tests + snapshot artifacts for API parity.
- Documentation updates for setup, development, and cutover procedures.
