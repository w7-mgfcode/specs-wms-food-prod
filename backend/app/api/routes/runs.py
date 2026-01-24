"""Production run management endpoints."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
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
)
from app.services.run_code import generate_run_code

router = APIRouter(prefix="/runs", tags=["runs"])


# --- Idempotency Key Dependency ---


def get_idempotency_key(
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
) -> UUID:
    """Extract idempotency key from header."""
    return idempotency_key


IdempotencyKey = Annotated[UUID, Depends(get_idempotency_key)]


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
    idempotency_key: IdempotencyKey,
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
            status_code=status.HTTP_404_NOT_FOUND, detail="Flow version not found"
        )

    if flow_version.status != FlowVersionStatus.PUBLISHED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Flow version must be PUBLISHED to start a run. Current status: {flow_version.status}",
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
            detail=f"Cannot start run in {run.status} status. Must be IDLE.",
        )

    # Transition to RUNNING
    now = datetime.now(UTC)
    run.status = RunStatus.RUNNING.value
    run.started_at = now

    # Create step execution for step 0 (Start)
    step_exec = RunStepExecution(
        run_id=run.id,
        step_index=0,
        node_id="start",
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
    db: DBSession,
    current_user: CanCreateRuns,
    data: AdvanceStepRequest | None = None,
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
            detail=f"Cannot advance run in {run.status} status. Must be RUNNING.",
        )

    if run.current_step_index >= 10:
        raise HTTPException(
            status_code=400,
            detail="Run is at final step (10). Use /complete to finish.",
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
        node_id=f"step-{run.current_step_index}",
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
            detail=f"Cannot hold run in {run.status} status. Must be RUNNING.",
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
            detail=f"Cannot resume run in {run.status} status. Must be HOLD.",
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
            detail=f"Cannot complete run in {run.status} status. Must be RUNNING.",
        )

    if run.current_step_index != 10:
        raise HTTPException(
            status_code=400,
            detail=f"Run must be at step 10 (Shipment) to complete. Current step: {run.current_step_index}",
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
            detail=f"Cannot abort run in {run.status} status. Must be RUNNING or HOLD.",
        )

    now = datetime.now(UTC)
    run.status = RunStatus.ABORTED.value
    run.ended_at = now

    # TODO: Record abort reason in audit log

    await db.flush()
    await db.refresh(run)

    return ProductionRunResponse.model_validate(run)
