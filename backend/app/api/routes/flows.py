"""Flow definition and version management endpoints."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import func, select

from app.api.deps import AllAuthenticated, CanEditFlows, CanPublishFlows, DBSession
from app.models.flow import FlowDefinition, FlowVersion, FlowVersionStatus
from app.rate_limit import limiter
from app.schemas.flow import (
    FlowDefinitionCreate,
    FlowDefinitionListItem,
    FlowDefinitionResponse,
    FlowVersionListItem,
    FlowVersionResponse,
    FlowVersionUpdate,
    GraphSchema,
    PublishFlowResponse,
)

router = APIRouter(prefix="/flows", tags=["flows"])


# --- Flow Definition Endpoints ---


@router.get("", response_model=list[FlowDefinitionListItem])
@limiter.limit("100/minute")
async def list_flow_definitions(
    request: Request,
    db: DBSession,
    current_user: AllAuthenticated,
) -> list[FlowDefinitionListItem]:
    """
    List all flow definitions with version summary.

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    # Query definitions with aggregated version info
    stmt = select(FlowDefinition).order_by(FlowDefinition.updated_at.desc())
    result = await db.execute(stmt)
    definitions = result.scalars().all()

    items = []
    for defn in definitions:
        # Get version summary for each definition
        version_stmt = select(
            func.count(FlowVersion.id).label("version_count"),
            func.max(FlowVersion.version_num).label("latest_version_num"),
        ).where(FlowVersion.flow_definition_id == defn.id)
        version_result = await db.execute(version_stmt)
        version_info = version_result.one()

        # Get latest version status
        latest_status = None
        if version_info.latest_version_num:
            latest_stmt = select(FlowVersion.status).where(
                FlowVersion.flow_definition_id == defn.id,
                FlowVersion.version_num == version_info.latest_version_num,
            )
            latest_result = await db.execute(latest_stmt)
            latest_status = latest_result.scalar_one_or_none()

        items.append(
            FlowDefinitionListItem(
                id=defn.id,
                name=defn.name,
                description=defn.description,
                created_at=defn.created_at,
                updated_at=defn.updated_at,
                latest_version_num=version_info.latest_version_num,
                latest_status=latest_status,
                version_count=version_info.version_count or 0,
            )
        )

    return items


@router.post("", response_model=FlowDefinitionResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("50/minute")
async def create_flow_definition(
    request: Request,
    data: FlowDefinitionCreate,
    db: DBSession,
    current_user: CanEditFlows,
) -> FlowDefinitionResponse:
    """
    Create a new flow definition with initial draft version.

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 50/minute.
    """
    # Create the flow definition
    flow_def = FlowDefinition(
        name=data.name,
        description=data.description,
        created_by=current_user.id,
    )
    db.add(flow_def)
    await db.flush()

    # Create initial draft version (v1)
    initial_graph = GraphSchema().model_dump()
    version = FlowVersion(
        flow_definition_id=flow_def.id,
        version_num=1,
        status=FlowVersionStatus.DRAFT,
        graph_schema=initial_graph,
        created_by=current_user.id,
    )
    db.add(version)
    await db.flush()
    await db.refresh(flow_def)

    return FlowDefinitionResponse.model_validate(flow_def)


@router.get("/{flow_id}", response_model=FlowDefinitionResponse)
@limiter.limit("100/minute")
async def get_flow_definition(
    request: Request,
    flow_id: UUID,
    db: DBSession,
    current_user: AllAuthenticated,
) -> FlowDefinitionResponse:
    """
    Get a flow definition by ID.

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    stmt = select(FlowDefinition).where(FlowDefinition.id == flow_id)
    result = await db.execute(stmt)
    flow_def = result.scalar_one_or_none()

    if flow_def is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow definition not found",
        )

    return FlowDefinitionResponse.model_validate(flow_def)


@router.delete("/{flow_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("20/minute")
async def delete_flow_definition(
    request: Request,
    flow_id: UUID,
    db: DBSession,
    current_user: CanPublishFlows,  # Only managers can delete
) -> None:
    """
    Delete a flow definition and all its versions.

    Requires: ADMIN or MANAGER role.
    Rate limit: 20/minute.
    """
    stmt = select(FlowDefinition).where(FlowDefinition.id == flow_id)
    result = await db.execute(stmt)
    flow_def = result.scalar_one_or_none()

    if flow_def is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow definition not found",
        )

    await db.delete(flow_def)


# --- Flow Version Endpoints ---


@router.get("/{flow_id}/versions", response_model=list[FlowVersionListItem])
@limiter.limit("100/minute")
async def list_flow_versions(
    request: Request,
    flow_id: UUID,
    db: DBSession,
    current_user: AllAuthenticated,
) -> list[FlowVersionListItem]:
    """
    List all versions of a flow definition.

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    # Verify flow exists
    flow_stmt = select(FlowDefinition.id).where(FlowDefinition.id == flow_id)
    flow_result = await db.execute(flow_stmt)
    if flow_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow definition not found",
        )

    stmt = (
        select(FlowVersion)
        .where(FlowVersion.flow_definition_id == flow_id)
        .order_by(FlowVersion.version_num.desc())
    )
    result = await db.execute(stmt)
    versions = result.scalars().all()

    return [FlowVersionListItem.model_validate(v) for v in versions]


@router.get("/{flow_id}/versions/{version_num}", response_model=FlowVersionResponse)
@limiter.limit("100/minute")
async def get_flow_version(
    request: Request,
    flow_id: UUID,
    version_num: int,
    db: DBSession,
    current_user: AllAuthenticated,
) -> FlowVersionResponse:
    """
    Get a specific version of a flow definition with full graph schema.

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    stmt = select(FlowVersion).where(
        FlowVersion.flow_definition_id == flow_id,
        FlowVersion.version_num == version_num,
    )
    result = await db.execute(stmt)
    version = result.scalar_one_or_none()

    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {version_num} not found for this flow",
        )

    return FlowVersionResponse.model_validate(version)


@router.get("/{flow_id}/versions/latest/draft", response_model=FlowVersionResponse)
@limiter.limit("100/minute")
async def get_latest_draft(
    request: Request,
    flow_id: UUID,
    db: DBSession,
    current_user: AllAuthenticated,
) -> FlowVersionResponse:
    """
    Get the latest draft version for editing.

    If no draft exists, returns 404 (use fork endpoint to create one).

    Requires: Any authenticated user.
    Rate limit: 100/minute.
    """
    stmt = (
        select(FlowVersion)
        .where(
            FlowVersion.flow_definition_id == flow_id,
            FlowVersion.status == FlowVersionStatus.DRAFT,
        )
        .order_by(FlowVersion.version_num.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    version = result.scalar_one_or_none()

    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No draft version found for this flow",
        )

    return FlowVersionResponse.model_validate(version)


@router.put("/{flow_id}/versions/{version_num}", response_model=FlowVersionResponse)
@limiter.limit("100/minute")
async def update_flow_version(
    request: Request,
    flow_id: UUID,
    version_num: int,
    data: FlowVersionUpdate,
    db: DBSession,
    current_user: CanEditFlows,
) -> FlowVersionResponse:
    """
    Update a draft version's graph schema.

    Only DRAFT versions can be updated. Published/Archived versions are immutable.

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 100/minute.
    """
    stmt = select(FlowVersion).where(
        FlowVersion.flow_definition_id == flow_id,
        FlowVersion.version_num == version_num,
    )
    result = await db.execute(stmt)
    version = result.scalar_one_or_none()

    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {version_num} not found for this flow",
        )

    if version.status != FlowVersionStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cannot edit {version.status.value} version. Only DRAFT versions can be modified.",
        )

    # Update the graph schema
    version.graph_schema = data.graph_schema.model_dump()

    # Update the parent definition's updated_at
    flow_stmt = select(FlowDefinition).where(FlowDefinition.id == flow_id)
    flow_result = await db.execute(flow_stmt)
    flow_def = flow_result.scalar_one()
    flow_def.updated_at = datetime.now(UTC)

    await db.flush()
    await db.refresh(version)

    return FlowVersionResponse.model_validate(version)


@router.post("/{flow_id}/versions/{version_num}/publish", response_model=PublishFlowResponse)
@limiter.limit("20/minute")
async def publish_flow_version(
    request: Request,
    flow_id: UUID,
    version_num: int,
    db: DBSession,
    current_user: CanPublishFlows,
) -> PublishFlowResponse:
    """
    Publish a draft version, making it immutable.

    After publishing:
    1. The version status changes to PUBLISHED
    2. published_at and published_by are set
    3. A new DRAFT version (N+1) is automatically created

    Requires: ADMIN or MANAGER role.
    Rate limit: 20/minute.
    """
    stmt = select(FlowVersion).where(
        FlowVersion.flow_definition_id == flow_id,
        FlowVersion.version_num == version_num,
    )
    result = await db.execute(stmt)
    version = result.scalar_one_or_none()

    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {version_num} not found for this flow",
        )

    if version.status != FlowVersionStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot publish {version.status.value} version. Only DRAFT versions can be published.",
        )

    # Validate graph has required structure for publishing
    graph = GraphSchema.model_validate(version.graph_schema)

    # Check for at least one START and one END node
    node_types = [n.data.nodeType.value for n in graph.nodes]
    if "start" not in node_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot publish: Flow must have at least one START node",
        )
    if "end" not in node_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot publish: Flow must have at least one END node",
        )

    # Publish the version
    now = datetime.now(UTC)
    version.status = FlowVersionStatus.PUBLISHED
    version.published_at = now
    version.published_by = current_user.id

    # Create new draft version (v N+1)
    new_draft = FlowVersion(
        flow_definition_id=flow_id,
        version_num=version_num + 1,
        status=FlowVersionStatus.DRAFT,
        graph_schema=version.graph_schema,  # Copy the published graph
        created_by=current_user.id,
    )
    db.add(new_draft)

    # Update parent definition
    flow_stmt = select(FlowDefinition).where(FlowDefinition.id == flow_id)
    flow_result = await db.execute(flow_stmt)
    flow_def = flow_result.scalar_one()
    flow_def.updated_at = now

    await db.flush()
    await db.refresh(version)
    await db.refresh(new_draft)

    return PublishFlowResponse(
        published_version=FlowVersionResponse.model_validate(version),
        new_draft=FlowVersionResponse.model_validate(new_draft),
    )


@router.post("/{flow_id}/versions/{version_num}/fork", response_model=FlowVersionResponse)
@limiter.limit("50/minute")
async def fork_flow_version(
    request: Request,
    flow_id: UUID,
    version_num: int,
    db: DBSession,
    current_user: CanEditFlows,
) -> FlowVersionResponse:
    """
    Create a new draft by forking an existing version.

    Use this to create a draft from a published version for editing.

    Requires: ADMIN, MANAGER, or OPERATOR role.
    Rate limit: 50/minute.
    """
    # Get the source version
    stmt = select(FlowVersion).where(
        FlowVersion.flow_definition_id == flow_id,
        FlowVersion.version_num == version_num,
    )
    result = await db.execute(stmt)
    source = result.scalar_one_or_none()

    if source is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {version_num} not found for this flow",
        )

    # Get the latest version number
    max_stmt = select(func.max(FlowVersion.version_num)).where(
        FlowVersion.flow_definition_id == flow_id
    )
    max_result = await db.execute(max_stmt)
    max_version = max_result.scalar_one() or 0

    # Check if there's already a draft
    draft_stmt = select(FlowVersion).where(
        FlowVersion.flow_definition_id == flow_id,
        FlowVersion.status == FlowVersionStatus.DRAFT,
    )
    draft_result = await db.execute(draft_stmt)
    existing_draft = draft_result.scalar_one_or_none()

    if existing_draft:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A draft version (v{existing_draft.version_num}) already exists. Edit that or archive it first.",
        )

    # Create new draft
    new_draft = FlowVersion(
        flow_definition_id=flow_id,
        version_num=max_version + 1,
        status=FlowVersionStatus.DRAFT,
        graph_schema=source.graph_schema,
        created_by=current_user.id,
    )
    db.add(new_draft)

    # Update parent definition
    flow_stmt = select(FlowDefinition).where(FlowDefinition.id == flow_id)
    flow_result = await db.execute(flow_stmt)
    flow_def = flow_result.scalar_one()
    flow_def.updated_at = datetime.now(UTC)

    await db.flush()
    await db.refresh(new_draft)

    return FlowVersionResponse.model_validate(new_draft)
