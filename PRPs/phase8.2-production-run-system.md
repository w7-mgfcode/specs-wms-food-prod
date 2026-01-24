# PRP: Phase 8.2 — Production Run System

> **Parent PRP**: phase8-unified-production-suite.md
> **Phase**: 8.2 - Production Run System
> **Date**: 2026-01-24
> **Status**: READY FOR IMPLEMENTATION
> **Confidence Score**: 8/10

---

## Purpose

Implement the full Production Run management system with:
1. State machine enforcement (IDLE → RUNNING → HOLD/COMPLETED/ABORTED)
2. Version pinning (runs can only start from PUBLISHED FlowVersions)
3. Step advancement with QC completion guards
4. Idempotent API endpoints
5. Run code generation per naming conventions

---

## Prerequisites

- **Phase 8.1 Complete**: Schema alignment migrations applied
- Tables exist: `production_runs`, `run_step_executions`, `flow_versions`
- Models exist: `ProductionRun`, `RunStepExecution`, `FlowVersion`

---

## Reference Files

```yaml
Existing Patterns:
  - backend/app/api/routes/flows.py (CRUD pattern, rate limiting)
  - backend/app/api/routes/lots.py (idempotency pattern)
  - backend/app/api/deps.py (RBAC aliases)
  - backend/app/schemas/flow.py (Pydantic patterns)
```

---

## Task List

### Task 2.1: Create Pydantic Schemas for Runs

**File**: `backend/app/schemas/run.py` (NEW)

```python
"""Production run request/response schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ProductionRunCreate(BaseModel):
    """Create a new production run."""

    flow_version_id: UUID = Field(..., description="PUBLISHED flow version to pin")


class ProductionRunResponse(BaseModel):
    """Production run response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    run_code: str
    flow_version_id: UUID | None = None
    scenario_id: UUID | None = None
    status: str
    current_step_index: int
    started_by: UUID | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime | None = None


class ProductionRunListItem(BaseModel):
    """Production run list item."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    run_code: str
    status: str
    current_step_index: int
    started_at: datetime | None = None
    completed_at: datetime | None = None


class AdvanceStepRequest(BaseModel):
    """Request to advance to next step."""

    notes: str | None = Field(None, max_length=500, description="Optional notes for step completion")


class HoldRunRequest(BaseModel):
    """Request to put run on hold."""

    reason: str = Field(..., min_length=10, max_length=500, description="Reason for hold (min 10 chars)")


class ResumeRunRequest(BaseModel):
    """Request to resume run from hold."""

    resolution: str = Field(..., min_length=10, max_length=500, description="Resolution notes (min 10 chars)")


class AbortRunRequest(BaseModel):
    """Request to abort run."""

    reason: str = Field(..., min_length=10, max_length=500, description="Reason for abort (min 10 chars)")


class RunStepExecutionResponse(BaseModel):
    """Run step execution response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    run_id: UUID
    step_index: int
    node_id: str
    status: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    operator_id: UUID | None = None
    created_at: datetime


class RunWithStepsResponse(BaseModel):
    """Production run with step executions."""

    run: ProductionRunResponse
    steps: list[RunStepExecutionResponse]
```

**Validation**:
```bash
uv run mypy app/schemas/run.py
```

---

### Task 2.2: Add RBAC Type Aliases

**File**: `backend/app/api/deps.py` (UPDATE - append)

```python
# Production Run RBAC type aliases
# Can create and operate runs: ADMIN, MANAGER, OPERATOR
CanCreateRuns = Annotated[
    User, Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR))
]

# Can manage runs (hold/resume/abort): ADMIN, MANAGER
CanManageRuns = Annotated[
    User, Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))
]
```

**Validation**:
```bash
uv run python -c "from app.api.deps import CanCreateRuns, CanManageRuns; print('OK')"
```

---

### Task 2.3: Create Run Code Generator Utility

**File**: `backend/app/services/run_code.py` (NEW)

```python
"""Run code generation service."""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.production import ProductionRun


async def generate_run_code(db: AsyncSession, site_code: str = "DUNA") -> str:
    """
    Generate run code: RUN-YYYYMMDD-SITE-####

    Example: RUN-20260124-DUNA-0001

    The sequence number resets daily.
    """
    today = date.today()
    date_str = today.strftime("%Y%m%d")
    prefix = f"RUN-{date_str}-{site_code}-"

    # Get max sequence for today
    stmt = select(func.max(ProductionRun.run_code)).where(
        ProductionRun.run_code.like(f"{prefix}%")
    )
    result = await db.execute(stmt)
    max_code = result.scalar_one_or_none()

    if max_code:
        # Extract sequence number and increment
        try:
            seq = int(max_code[-4:]) + 1
        except ValueError:
            seq = 1
    else:
        seq = 1

    return f"{prefix}{seq:04d}"


def validate_run_code(code: str) -> bool:
    """Validate run code format."""
    import re
    pattern = r'^RUN-\d{8}-[A-Z]{4}-\d{4}$'
    return bool(re.match(pattern, code))
```

**Validation**:
```bash
uv run python -c "
from app.services.run_code import validate_run_code
assert validate_run_code('RUN-20260124-DUNA-0001')
assert not validate_run_code('INVALID')
print('OK')
"
```

---

### Task 2.4: Create Production Run API Routes

**File**: `backend/app/api/routes/runs.py` (NEW)

```python
"""Production run management endpoints."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import AllAuthenticated, CanCreateRuns, CanManageRuns, DBSession
from app.models.flow import FlowVersion, FlowVersionStatus
from app.models.production import ProductionRun, RunStatus
from app.models.run import RunStepExecution, StepExecutionStatus
from app.rate_limit import limiter
from app.schemas.run import (
    AbortRunRequest,
    AdvanceStepRequest,
    HoldRunRequest,
    ProductionRunCreate,
    ProductionRunListItem,
    ProductionRunResponse,
    ResumeRunRequest,
    RunStepExecutionResponse,
    RunWithStepsResponse,
)
from app.services.run_code import generate_run_code

router = APIRouter(prefix="/runs", tags=["runs"])


# --- List/Get Endpoints ---


@router.get("", response_model=list[ProductionRunListItem])
@limiter.limit("100/minute")
async def list_runs(
    request: Request,
    db: DBSession,
    current_user: AllAuthenticated,
    status_filter: str | None = None,
) -> list[ProductionRunListItem]:
    """
    List all production runs.

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    stmt = select(ProductionRun).order_by(ProductionRun.started_at.desc())

    if status_filter:
        stmt = stmt.where(ProductionRun.status == status_filter)

    result = await db.execute(stmt)
    runs = result.scalars().all()

    return [ProductionRunListItem.model_validate(r) for r in runs]


@router.get("/{run_id}", response_model=ProductionRunResponse)
@limiter.limit("100/minute")
async def get_run(
    request: Request,
    run_id: UUID,
    db: DBSession,
    current_user: AllAuthenticated,
) -> ProductionRunResponse:
    """
    Get production run by ID.

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    stmt = select(ProductionRun).where(ProductionRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(status_code=404, detail="Production run not found")

    return ProductionRunResponse.model_validate(run)


@router.get("/{run_id}/steps", response_model=list[RunStepExecutionResponse])
@limiter.limit("100/minute")
async def get_run_steps(
    request: Request,
    run_id: UUID,
    db: DBSession,
    current_user: AllAuthenticated,
) -> list[RunStepExecutionResponse]:
    """
    Get step execution history for a run.

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    # Verify run exists
    run_stmt = select(ProductionRun.id).where(ProductionRun.id == run_id)
    run_result = await db.execute(run_stmt)
    if run_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Production run not found")

    stmt = (
        select(RunStepExecution)
        .where(RunStepExecution.run_id == run_id)
        .order_by(RunStepExecution.step_index)
    )
    result = await db.execute(stmt)
    steps = result.scalars().all()

    return [RunStepExecutionResponse.model_validate(s) for s in steps]


# --- Create Endpoint ---


@router.post("", response_model=ProductionRunResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("50/minute")
async def create_run(
    request: Request,
    data: ProductionRunCreate,
    db: DBSession,
    current_user: CanCreateRuns,
    idempotency_key: UUID = Header(..., alias="Idempotency-Key"),
) -> ProductionRunResponse:
    """
    Create a new production run pinned to a PUBLISHED flow version.

    The run is created in IDLE status. Use /start to begin execution.

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 50/minute.
    Idempotency: Required header for duplicate prevention.
    """
    # Idempotency check
    existing_stmt = select(ProductionRun).where(
        ProductionRun.idempotency_key == idempotency_key
    )
    existing_result = await db.execute(existing_stmt)
    existing = existing_result.scalar_one_or_none()
    if existing:
        return ProductionRunResponse.model_validate(existing)

    # Validate flow_version is PUBLISHED
    version_stmt = select(FlowVersion).where(FlowVersion.id == data.flow_version_id)
    version_result = await db.execute(version_stmt)
    flow_version = version_result.scalar_one_or_none()

    if flow_version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow version not found"
        )

    if flow_version.status != FlowVersionStatus.PUBLISHED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Flow version must be PUBLISHED to start a run. Current status: {flow_version.status}"
        )

    # Generate run code
    run_code = await generate_run_code(db)

    # Create run in IDLE status
    run = ProductionRun(
        run_code=run_code,
        flow_version_id=data.flow_version_id,
        status=RunStatus.IDLE.value,
        current_step_index=0,
        idempotency_key=idempotency_key,
        started_by=current_user.id,
    )
    db.add(run)
    await db.flush()
    await db.refresh(run)

    return ProductionRunResponse.model_validate(run)


# --- State Transition Endpoints ---


@router.post("/{run_id}/start", response_model=ProductionRunResponse)
@limiter.limit("50/minute")
async def start_run(
    request: Request,
    run_id: UUID,
    db: DBSession,
    current_user: CanCreateRuns,
) -> ProductionRunResponse:
    """
    Start a run (IDLE → RUNNING).

    Creates the initial step execution for step 0.

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 50/minute.
    """
    stmt = select(ProductionRun).where(ProductionRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(status_code=404, detail="Production run not found")

    if run.status != RunStatus.IDLE.value:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot start run in {run.status} status. Must be IDLE."
        )

    # Transition to RUNNING
    now = datetime.now(UTC)
    run.status = RunStatus.RUNNING.value
    run.started_at = now

    # Create step execution for step 0 (Start)
    step_exec = RunStepExecution(
        run_id=run.id,
        step_index=0,
        node_id="start",  # TODO: Get from flow version graph
        status=StepExecutionStatus.IN_PROGRESS.value,
        started_at=now,
        operator_id=current_user.id,
    )
    db.add(step_exec)

    await db.flush()
    await db.refresh(run)

    return ProductionRunResponse.model_validate(run)


@router.post("/{run_id}/advance", response_model=ProductionRunResponse)
@limiter.limit("100/minute")
async def advance_step(
    request: Request,
    run_id: UUID,
    data: AdvanceStepRequest | None = None,
    db: DBSession = None,
    current_user: CanCreateRuns = None,
) -> ProductionRunResponse:
    """
    Advance to the next step.

    Guards:
    - Run must be RUNNING
    - Current step must have no pending QC
    - No HOLD lots at current step
    - Cannot advance past step 10

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 100/minute.
    """
    stmt = select(ProductionRun).where(ProductionRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(status_code=404, detail="Production run not found")

    if run.status != RunStatus.RUNNING.value:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot advance run in {run.status} status. Must be RUNNING."
        )

    if run.current_step_index >= 10:
        raise HTTPException(
            status_code=400,
            detail="Run is at final step (10). Use /complete to finish."
        )

    # TODO: Check QC completion for current step
    # TODO: Check no HOLD lots at current step

    now = datetime.now(UTC)

    # Complete current step execution
    current_step_stmt = select(RunStepExecution).where(
        RunStepExecution.run_id == run_id,
        RunStepExecution.step_index == run.current_step_index,
    )
    current_step_result = await db.execute(current_step_stmt)
    current_step = current_step_result.scalar_one_or_none()

    if current_step:
        current_step.status = StepExecutionStatus.COMPLETED.value
        current_step.completed_at = now

    # Advance step index
    run.current_step_index += 1

    # Create new step execution
    next_step = RunStepExecution(
        run_id=run.id,
        step_index=run.current_step_index,
        node_id=f"step-{run.current_step_index}",  # TODO: Get from flow version graph
        status=StepExecutionStatus.IN_PROGRESS.value,
        started_at=now,
        operator_id=current_user.id,
    )
    db.add(next_step)

    await db.flush()
    await db.refresh(run)

    return ProductionRunResponse.model_validate(run)


@router.post("/{run_id}/hold", response_model=ProductionRunResponse)
@limiter.limit("50/minute")
async def hold_run(
    request: Request,
    run_id: UUID,
    data: HoldRunRequest,
    db: DBSession,
    current_user: CanCreateRuns,
) -> ProductionRunResponse:
    """
    Put run on HOLD (RUNNING → HOLD).

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 50/minute.
    """
    stmt = select(ProductionRun).where(ProductionRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(status_code=404, detail="Production run not found")

    if run.status != RunStatus.RUNNING.value:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot hold run in {run.status} status. Must be RUNNING."
        )

    run.status = RunStatus.HOLD.value

    # TODO: Record hold reason in audit log

    await db.flush()
    await db.refresh(run)

    return ProductionRunResponse.model_validate(run)


@router.post("/{run_id}/resume", response_model=ProductionRunResponse)
@limiter.limit("50/minute")
async def resume_run(
    request: Request,
    run_id: UUID,
    data: ResumeRunRequest,
    db: DBSession,
    current_user: CanManageRuns,  # Manager required
) -> ProductionRunResponse:
    """
    Resume run from HOLD (HOLD → RUNNING).

    Requires: ADMIN or MANAGER role (elevated permission).
    Rate limit: 50/minute.
    """
    stmt = select(ProductionRun).where(ProductionRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(status_code=404, detail="Production run not found")

    if run.status != RunStatus.HOLD.value:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot resume run in {run.status} status. Must be HOLD."
        )

    run.status = RunStatus.RUNNING.value

    # TODO: Record resume resolution in audit log

    await db.flush()
    await db.refresh(run)

    return ProductionRunResponse.model_validate(run)


@router.post("/{run_id}/complete", response_model=ProductionRunResponse)
@limiter.limit("20/minute")
async def complete_run(
    request: Request,
    run_id: UUID,
    db: DBSession,
    current_user: CanCreateRuns,
) -> ProductionRunResponse:
    """
    Complete run (RUNNING → COMPLETED).

    Guards:
    - Run must be RUNNING
    - Current step must be 10 (Shipment)
    - All QC must be passed

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 20/minute.
    """
    stmt = select(ProductionRun).where(ProductionRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(status_code=404, detail="Production run not found")

    if run.status != RunStatus.RUNNING.value:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete run in {run.status} status. Must be RUNNING."
        )

    if run.current_step_index != 10:
        raise HTTPException(
            status_code=400,
            detail=f"Run must be at step 10 (Shipment) to complete. Current step: {run.current_step_index}"
        )

    # TODO: Verify all QC passed

    now = datetime.now(UTC)

    # Complete final step execution
    final_step_stmt = select(RunStepExecution).where(
        RunStepExecution.run_id == run_id,
        RunStepExecution.step_index == 10,
    )
    final_step_result = await db.execute(final_step_stmt)
    final_step = final_step_result.scalar_one_or_none()

    if final_step:
        final_step.status = StepExecutionStatus.COMPLETED.value
        final_step.completed_at = now

    # Complete the run
    run.status = RunStatus.COMPLETED.value
    run.completed_at = now
    run.ended_at = now

    await db.flush()
    await db.refresh(run)

    return ProductionRunResponse.model_validate(run)


@router.post("/{run_id}/abort", response_model=ProductionRunResponse)
@limiter.limit("20/minute")
async def abort_run(
    request: Request,
    run_id: UUID,
    data: AbortRunRequest,
    db: DBSession,
    current_user: CanManageRuns,  # Manager required
) -> ProductionRunResponse:
    """
    Abort run (RUNNING/HOLD → ABORTED).

    Requires: ADMIN or MANAGER role (elevated permission).
    Rate limit: 20/minute.
    """
    stmt = select(ProductionRun).where(ProductionRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(status_code=404, detail="Production run not found")

    if run.status not in (RunStatus.RUNNING.value, RunStatus.HOLD.value):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot abort run in {run.status} status. Must be RUNNING or HOLD."
        )

    now = datetime.now(UTC)
    run.status = RunStatus.ABORTED.value
    run.ended_at = now

    # TODO: Record abort reason in audit log

    await db.flush()
    await db.refresh(run)

    return ProductionRunResponse.model_validate(run)
```

**Validation**:
```bash
uv run mypy app/api/routes/runs.py
```

---

### Task 2.5: Register Runs Router

**File**: `backend/app/api/routes/__init__.py` (UPDATE)

```python
from fastapi import APIRouter

from app.api.routes import auth, flows, health, lots, qc, runs, traceability

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(lots.router)
api_router.include_router(qc.router)
api_router.include_router(traceability.router)
api_router.include_router(flows.router)
api_router.include_router(runs.router)  # NEW
```

**Validation**:
```bash
uv run python -c "from app.api.routes import api_router; print([r.path for r in api_router.routes])"
```

---

### Task 2.6: Create Tests for Runs API

**File**: `backend/tests/test_runs.py` (NEW)

```python
"""Tests for production run API endpoints."""

import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.flow import FlowDefinition, FlowVersion, FlowVersionStatus
from app.models.production import ProductionRun, RunStatus
from app.models.user import User


@pytest.fixture
async def published_flow_version(db_session: AsyncSession, test_operator_user: User):
    """Create a published flow version for testing."""
    # Create flow definition
    flow_def = FlowDefinition(
        name={"en": "Test Flow", "hu": "Teszt Folyamat"},
        description="Test flow for runs",
        created_by=test_operator_user.id,
    )
    db_session.add(flow_def)
    await db_session.flush()

    # Create published version
    version = FlowVersion(
        flow_definition_id=flow_def.id,
        version_num=1,
        status=FlowVersionStatus.PUBLISHED.value,
        graph_schema={
            "nodes": [
                {"id": "start", "type": "start", "position": {"x": 0, "y": 0}, "data": {"label": {"en": "Start"}, "nodeType": "start", "config": {}}},
                {"id": "end", "type": "end", "position": {"x": 100, "y": 0}, "data": {"label": {"en": "End"}, "nodeType": "end", "config": {}}},
            ],
            "edges": [{"id": "e1", "source": "start", "target": "end"}],
            "viewport": {"x": 0, "y": 0, "zoom": 1},
        },
        published_at=datetime.now(UTC),
        published_by=test_operator_user.id,
        created_by=test_operator_user.id,
    )
    db_session.add(version)
    await db_session.flush()

    return version


@pytest.mark.asyncio
async def test_create_run_requires_published_version(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    test_operator_user: User,
):
    """Test that runs can only be created from PUBLISHED versions."""
    # Create a DRAFT version
    flow_def = FlowDefinition(
        name={"en": "Draft Flow"},
        created_by=test_operator_user.id,
    )
    db_session.add(flow_def)
    await db_session.flush()

    draft_version = FlowVersion(
        flow_definition_id=flow_def.id,
        version_num=1,
        status=FlowVersionStatus.DRAFT.value,
        graph_schema={"nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}},
        created_by=test_operator_user.id,
    )
    db_session.add(draft_version)
    await db_session.flush()

    # Try to create run from DRAFT version
    response = await client.post(
        "/api/runs",
        json={"flow_version_id": str(draft_version.id)},
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    assert response.status_code == 400
    assert "PUBLISHED" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_run_success(
    client: AsyncClient,
    auth_headers: dict,
    published_flow_version: FlowVersion,
):
    """Test successful run creation."""
    idempotency_key = str(uuid.uuid4())

    response = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers={**auth_headers, "Idempotency-Key": idempotency_key},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "IDLE"
    assert data["current_step_index"] == 0
    assert data["flow_version_id"] == str(published_flow_version.id)
    assert data["run_code"].startswith("RUN-")


@pytest.mark.asyncio
async def test_create_run_idempotency(
    client: AsyncClient,
    auth_headers: dict,
    published_flow_version: FlowVersion,
):
    """Test that duplicate requests with same idempotency key return same result."""
    idempotency_key = str(uuid.uuid4())
    headers = {**auth_headers, "Idempotency-Key": idempotency_key}

    # First request
    response1 = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers=headers,
    )

    # Second request with same key
    response2 = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers=headers,
    )

    assert response1.status_code == 201
    assert response2.status_code == 201
    assert response1.json()["id"] == response2.json()["id"]


@pytest.mark.asyncio
async def test_run_lifecycle_idle_to_running(
    client: AsyncClient,
    auth_headers: dict,
    published_flow_version: FlowVersion,
):
    """Test starting a run (IDLE → RUNNING)."""
    # Create run
    create_response = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )
    run_id = create_response.json()["id"]

    # Start run
    start_response = await client.post(
        f"/api/runs/{run_id}/start",
        headers=auth_headers,
    )

    assert start_response.status_code == 200
    data = start_response.json()
    assert data["status"] == "RUNNING"
    assert data["started_at"] is not None


@pytest.mark.asyncio
async def test_run_lifecycle_advance_step(
    client: AsyncClient,
    auth_headers: dict,
    published_flow_version: FlowVersion,
):
    """Test advancing steps."""
    # Create and start run
    create_response = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )
    run_id = create_response.json()["id"]

    await client.post(f"/api/runs/{run_id}/start", headers=auth_headers)

    # Advance step
    advance_response = await client.post(
        f"/api/runs/{run_id}/advance",
        headers=auth_headers,
    )

    assert advance_response.status_code == 200
    data = advance_response.json()
    assert data["current_step_index"] == 1


@pytest.mark.asyncio
async def test_run_lifecycle_hold_and_resume(
    client: AsyncClient,
    auth_headers: dict,
    manager_auth_headers: dict,
    published_flow_version: FlowVersion,
):
    """Test hold and resume flow."""
    # Create and start run
    create_response = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )
    run_id = create_response.json()["id"]

    await client.post(f"/api/runs/{run_id}/start", headers=auth_headers)

    # Hold run
    hold_response = await client.post(
        f"/api/runs/{run_id}/hold",
        json={"reason": "Quality issue detected"},
        headers=auth_headers,
    )

    assert hold_response.status_code == 200
    assert hold_response.json()["status"] == "HOLD"

    # Resume run (requires manager)
    resume_response = await client.post(
        f"/api/runs/{run_id}/resume",
        json={"resolution": "Issue resolved and verified"},
        headers=manager_auth_headers,
    )

    assert resume_response.status_code == 200
    assert resume_response.json()["status"] == "RUNNING"


@pytest.mark.asyncio
async def test_complete_run_requires_step_10(
    client: AsyncClient,
    auth_headers: dict,
    published_flow_version: FlowVersion,
):
    """Test that completion requires step 10."""
    # Create and start run
    create_response = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )
    run_id = create_response.json()["id"]

    await client.post(f"/api/runs/{run_id}/start", headers=auth_headers)

    # Try to complete at step 0
    complete_response = await client.post(
        f"/api/runs/{run_id}/complete",
        headers=auth_headers,
    )

    assert complete_response.status_code == 400
    assert "step 10" in complete_response.json()["detail"]
```

**Validation**:
```bash
uv run pytest tests/test_runs.py -v
```

---

## Validation Loop

### Step 1: Run Type Checks

```bash
cd backend
uv run mypy app/schemas/run.py app/api/routes/runs.py app/services/run_code.py
```

### Step 2: Run Lint

```bash
uv run ruff check app/schemas/run.py app/api/routes/runs.py app/services/run_code.py --fix
```

### Step 3: Run Tests

```bash
uv run pytest tests/test_runs.py -v
```

### Step 4: Manual API Test

```bash
# Start server
uv run uvicorn app.main:app --reload --port 8000

# Test endpoints
curl -X GET http://localhost:8000/api/runs | jq
curl -X POST http://localhost:8000/api/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"flow_version_id": "..."}' | jq
```

---

## Final Checklist

- [ ] Schemas: `ProductionRunCreate`, `ProductionRunResponse`, state transition requests
- [ ] RBAC: `CanCreateRuns`, `CanManageRuns` aliases added
- [ ] Service: Run code generator with daily sequence
- [ ] Routes: GET /runs, GET /runs/{id}, GET /runs/{id}/steps
- [ ] Routes: POST /runs (create with idempotency)
- [ ] Routes: POST /runs/{id}/start (IDLE → RUNNING)
- [ ] Routes: POST /runs/{id}/advance (step progression)
- [ ] Routes: POST /runs/{id}/hold (RUNNING → HOLD)
- [ ] Routes: POST /runs/{id}/resume (HOLD → RUNNING, Manager only)
- [ ] Routes: POST /runs/{id}/complete (at step 10)
- [ ] Routes: POST /runs/{id}/abort (Manager only)
- [ ] Router registered in __init__.py
- [ ] Tests: version pinning, idempotency, state transitions
- [ ] All tests pass

---

## Confidence Score: 8/10

**High confidence** because:
- Clear state machine defined in INITIAL-11
- Existing route patterns to follow
- RBAC patterns established

**Uncertainty**:
- QC completion guards not yet implemented (TODOs)
- Step execution node_id mapping from graph needs refinement
- Audit logging integration deferred to Phase 8.4
