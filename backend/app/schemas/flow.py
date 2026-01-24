"""Flow definition and version schemas for request/response validation."""

from datetime import datetime
from enum import Enum
from typing import Any, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class FlowNodeType(str, Enum):
    """Valid node types for flow editor."""

    START = "start"
    END = "end"
    PROCESS = "process"
    QC_GATE = "qc_gate"
    BUFFER = "buffer"
    GROUP = "group"  # Swimlane


class FlowVersionStatus(str, Enum):
    """Flow version lifecycle states."""

    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


# --- Graph Schema Components ---


class Position(BaseModel):
    """Node position on canvas."""

    x: float
    y: float


class NodeData(BaseModel):
    """Generic node data payload."""

    label: dict[str, str]  # LocalizedString: {hu, en}
    nodeType: FlowNodeType  # noqa: N815 - React Flow API uses camelCase
    config: dict[str, Any] = Field(default_factory=dict)


class FlowNode(BaseModel):
    """React Flow node structure."""

    id: str
    type: str = "default"  # React Flow node type (custom component name)
    position: Position
    data: NodeData
    parentId: str | None = None  # noqa: N815 - React Flow API uses camelCase
    extent: str | None = None  # 'parent' to constrain to group
    measured: dict[str, float] | None = None  # Set by React Flow after render
    width: float | None = None  # Optional explicit width
    height: float | None = None  # Optional explicit height


class FlowEdge(BaseModel):
    """React Flow edge structure."""

    id: str
    source: str
    target: str
    sourceHandle: str | None = None  # noqa: N815 - React Flow API uses camelCase
    targetHandle: str | None = None  # noqa: N815 - React Flow API uses camelCase
    label: str | None = None
    animated: bool = False
    type: str | None = None  # Edge type (default, smoothstep, etc.)


class Viewport(BaseModel):
    """Canvas viewport state."""

    x: float = 0
    y: float = 0
    zoom: float = 1


class GraphSchema(BaseModel):
    """
    Complete graph definition stored in flow_versions.graph_schema JSONB.

    This is the "source code" of a flow - validated before storage.
    """

    nodes: list[FlowNode] = Field(default_factory=list)
    edges: list[FlowEdge] = Field(default_factory=list)
    viewport: Viewport = Field(default_factory=Viewport)

    @model_validator(mode="after")
    def validate_graph_structure(self) -> Self:
        """Validate graph has required structure."""
        node_ids = {n.id for n in self.nodes}

        # Validate edge references
        for edge in self.edges:
            if edge.source not in node_ids:
                raise ValueError(f"Edge {edge.id} references non-existent source: {edge.source}")
            if edge.target not in node_ids:
                raise ValueError(f"Edge {edge.id} references non-existent target: {edge.target}")

        # Validate parent references (swimlanes)
        for node in self.nodes:
            if node.parentId and node.parentId not in node_ids:
                raise ValueError(f"Node {node.id} references non-existent parent: {node.parentId}")

        return self


# --- Request Schemas ---


class FlowDefinitionCreate(BaseModel):
    """Create a new flow definition."""

    name: dict[str, str]  # LocalizedString: {hu, en}
    description: str | None = None


class FlowVersionUpdate(BaseModel):
    """Update draft version graph."""

    graph_schema: GraphSchema


# --- Response Schemas ---


class FlowDefinitionResponse(BaseModel):
    """Flow definition response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: dict[str, Any]  # Use Any for JSONB compatibility
    description: str | None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime


class FlowDefinitionListItem(BaseModel):
    """Flow definition list item with version summary."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: dict[str, Any]
    description: str | None
    created_at: datetime
    updated_at: datetime
    latest_version_num: int | None = None
    latest_status: FlowVersionStatus | None = None
    version_count: int = 0
    published_version_num: int | None = None
    created_by_name: str | None = None


class FlowVersionResponse(BaseModel):
    """Flow version response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    flow_definition_id: UUID
    version_num: int
    status: FlowVersionStatus
    graph_schema: dict[str, Any]  # Return as dict for flexibility
    created_by: UUID | None = None
    published_at: datetime | None = None
    published_by: UUID | None = None
    created_at: datetime


class FlowVersionListItem(BaseModel):
    """Flow version list item (without full graph)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    flow_definition_id: UUID
    version_num: int
    status: FlowVersionStatus
    created_by: UUID | None = None
    published_at: datetime | None = None
    created_at: datetime


class PublishFlowResponse(BaseModel):
    """Response after publishing a flow version."""

    published_version: FlowVersionResponse
    new_draft: FlowVersionResponse | None = None  # Auto-created new draft
