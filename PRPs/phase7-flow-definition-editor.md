# PRP: Flow Definition Editor (Visual Workflow Builder)

> **Phase**: 7 - UI Enhancements
> **Date**: 2026-01-24
> **Status**: READY FOR IMPLEMENTATION
> **Confidence Score**: 8/10

---

## Purpose

Transform the current read-only flow viewer into a fully editable, versioned workflow builder using React Flow (XYFlow). This allows "Process Engineers" (non-developers) to define manufacturing steps, QC gates, and swimlanes using a drag-and-drop interface.

## Core Principles

1. **Hybrid Data Model**: Design-time uses JSONB (flexibility); Runtime reads validated JSON definitions
2. **Canvas Performance**: 60fps drag interactions using Zustand + unmanaged refs
3. **Versioning Safety**: Production runs reference specific version IDs (immutable)
4. **RBAC Enforcement**: Editors draft, Managers publish

---

## Goal

Build a complete Flow Definition Editor system that:
- Provides visual drag-and-drop node placement (Start, Process, QC, End, Buffer)
- Implements swimlanes as Group Nodes for functional area organization
- Supports strict Draft → Published lifecycle with version immutability
- Integrates with existing RBAC (require Manager role to Publish)
- Stores graph definitions as JSONB with backend validation

## Why

- **Business Value**: Process Engineers can modify workflows without developer involvement
- **Agility**: Manufacturing flows can be updated and versioned independently
- **Compliance**: HACCP requires process definitions to be documented and immutable
- **Audit Trail**: Version history provides full traceability of flow changes

## What

### Success Criteria

- [ ] User can create a new Flow Definition
- [ ] User can drag nodes (Start, Process, QC, Buffer, End) onto canvas
- [ ] User can create Swimlanes (Group Nodes) and nest nodes inside them
- [ ] Draft auto-saves (debounced) to backend
- [ ] Manager can Publish a Draft (creates immutable version)
- [ ] Published versions cannot be edited (only forked to new Draft)
- [ ] Production Runs reference specific `flow_version_id`
- [ ] All RBAC permissions enforced (Editor: draft, Manager: publish)
- [ ] Tests pass: `uv run pytest && npm run lint && npm run build`

---

## All Needed Context

### External Documentation (MUST READ)

```yaml
# React Flow (XYFlow) - Canvas Library
- url: https://reactflow.dev/learn/getting-started/installation-and-requirements
  why: Installation for @xyflow/react v12
  content: npm install @xyflow/react, style imports

- url: https://reactflow.dev/learn/customization/custom-nodes
  why: Creating custom node components (ProcessNode, QCGateNode, etc.)
  content: Node component structure, handle positioning, data props

- url: https://reactflow.dev/learn/layouting/sub-flows
  why: Swimlanes implementation using Group Nodes
  content: parentId property, extent: 'parent' constraint, nested positioning

- url: https://reactflow.dev/examples/interaction/save-and-restore
  why: Serialization pattern for JSONB storage
  content: rfInstance.toObject(), setNodes/setEdges/setViewport restoration

- url: https://reactflow.dev/learn/advanced-use/state-management
  why: Zustand integration for 60fps performance
  content: External state management, avoiding React useState for high-frequency updates

- url: https://reactflow.dev/api-reference/types/react-flow-json-object
  why: Type definitions for graph serialization
  content: ReactFlowJsonObject structure for database storage

- url: https://reactflow.dev/ui/components/labeled-group-node
  why: Swimlane UI component reference
  content: Pre-built group node with label support
```

### Codebase Patterns (FOLLOW EXACTLY)

#### Backend - SQLAlchemy Model Pattern
**Reference**: `backend/app/models/production.py`

```python
# Pattern: UUID primary key, JSONB field, cascade relationships
class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    name: Mapped[dict[str, Any]] = mapped_column(JSONB_TYPE, nullable=False)  # LocalizedString
    config: Mapped[dict[str, Any]] = mapped_column(JSONB_TYPE, default=dict)

    # Cascade delete for owned collections
    phases: Mapped[list["Phase"]] = relationship(
        "Phase", back_populates="scenario", cascade="all, delete-orphan"
    )
```

#### Backend - Pydantic Schema Pattern
**Reference**: `backend/app/schemas/lot.py`, `backend/app/schemas/qc.py`

```python
# Pattern: ConfigDict, alias for ORM fields, model_validator
class LotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    metadata: dict[str, Any] = Field(
        default_factory=dict, alias="metadata_", serialization_alias="metadata"
    )

# Pattern: Cross-field validation
class QCDecisionCreate(BaseModel):
    decision: Decision
    notes: str | None = Field(None, max_length=1000)

    @model_validator(mode="after")
    def validate_notes_for_hold_fail(self) -> Self:
        if self.decision in (Decision.HOLD, Decision.FAIL) and (
            not self.notes or len(self.notes.strip()) < 10
        ):
            raise ValueError("Notes required for HOLD/FAIL decisions (min 10 chars)")
        return self
```

#### Backend - RBAC Route Pattern
**Reference**: `backend/app/api/routes/lots.py`, `backend/app/api/deps.py`

```python
# Pattern: Type aliases for RBAC, rate limiting, metrics
from app.api.deps import AdminOrManager, CanCreateLots, DBSession

@router.post("/lots", response_model=LotResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("100/minute")
async def create_lot(
    request: Request,
    lot_data: LotCreate,
    db: DBSession,
    current_user: CanCreateLots,  # RBAC via type alias
) -> LotResponse:
    lot = Lot(**lot_data.model_dump())
    db.add(lot)
    await db.flush()
    await db.refresh(lot)
    return LotResponse.model_validate(lot)
```

#### Frontend - Zustand Store Pattern
**Reference**: `flow-viz-react/src/stores/useFlowStore.ts`

```typescript
// Pattern: create with devtools, separate state from actions
interface FlowState {
    buffers: Record<string, BufferConfig>;
    isLoaded: boolean;
    loadError: string | null;

    // Actions
    loadFlowConfig: () => Promise<void>;
    setActiveGate: (gateId: number | string) => void;
}

export const useFlowStore = create<FlowState>()(
    devtools(
        (set, get) => ({
            buffers: {},
            isLoaded: false,
            loadError: null,

            loadFlowConfig: async () => {
                try {
                    const response = await fetch('/api/...');
                    set({ buffers: data.buffers, isLoaded: true, loadError: null });
                } catch (error) {
                    set({ loadError: error.message, isLoaded: false });
                }
            },
        }),
        { name: 'FlowStore' }
    )
);
```

#### Frontend - API Client Pattern
**Reference**: `flow-viz-react/src/lib/api/client.ts`, `flow-viz-react/src/lib/api/lots.ts`

```typescript
// Pattern: apiFetch wrapper with JWT injection
export async function apiFetch<T>(
    path: string,
    options?: RequestInit & { skipAuth?: boolean }
): Promise<T> { ... }

// Pattern: Resource-specific functions
export async function createLot(data: LotCreate): Promise<Lot> {
    return apiFetch<Lot>('/api/lots', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}
```

#### Frontend - TanStack Query Hook Pattern
**Reference**: `flow-viz-react/src/hooks/useLots.ts`

```typescript
// Pattern: useMutation with cache invalidation
export function useCreateLot() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: LotCreate) => createLot(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.lots.all });
        },
    });
}
```

---

## Known Gotchas & Library Quirks

```yaml
# CRITICAL: React Flow v12 package name change
gotcha: "reactflow is now @xyflow/react"
impact: "Must use: import { ReactFlow } from '@xyflow/react'"
solution: "npm install @xyflow/react && import '@xyflow/react/dist/style.css'"

# CRITICAL: Node dimensions in v12
gotcha: "Node dimensions now stored in node.measured.width/height"
impact: "Layouting libraries (dagre, elkjs) need adjustment"
solution: "Read from node.measured, not node.width/height"

# CRITICAL: Canvas performance
gotcha: "Storing node positions in React useState causes 60fps drops"
impact: "Laggy dragging experience"
solution: "Use Zustand with external state, or useNodesState() hook"

# CRITICAL: Swimlane node containment
gotcha: "Child nodes can escape parent bounds by default"
impact: "Nodes may float outside swimlane visually"
solution: "Use extent: 'parent' on child nodes to constrain movement"

# CRITICAL: Draft vs Published mutability
gotcha: "Published versions MUST be immutable for HACCP compliance"
impact: "Editing published version creates audit issues"
solution: "Backend rejects PUT to non-DRAFT versions with 403"

# CRITICAL: Version reference in Production Runs
gotcha: "Run must reference specific version_id, never 'latest'"
impact: "Mid-run flow changes could corrupt active production"
solution: "flow_version_id FK, validate version exists before run start"

# CRITICAL: JSONB validation
gotcha: "Malformed graph JSON can break UI on load"
impact: "Editor crashes or shows invalid state"
solution: "Pydantic model validates graph_schema structure before DB save"
```

---

## Implementation Blueprint

### Database Schema

```sql
-- Table: flow_definitions
-- Represents the abstract concept of a workflow (e.g., "Standard Production Line")
CREATE TABLE flow_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name JSONB NOT NULL,                    -- LocalizedString: {hu: str, en: str}
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: flow_versions
-- Immutable snapshots of a flow definition
CREATE TABLE flow_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_definition_id UUID REFERENCES flow_definitions(id) ON DELETE CASCADE,
    version_num INTEGER NOT NULL,           -- Sequential: 1, 2, 3...
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- DRAFT, PUBLISHED, ARCHIVED

    -- The Core Graph Definition (React Flow JSON structure)
    -- Contains: { nodes: [], edges: [], viewport: {} }
    graph_schema JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}',

    created_by UUID REFERENCES users(id),
    published_at TIMESTAMPTZ,               -- NULL for drafts
    published_by UUID REFERENCES users(id), -- NULL for drafts
    created_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(flow_definition_id, version_num),
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);

-- Add flow_version_id to production_runs (nullable for backward compatibility)
ALTER TABLE production_runs
ADD COLUMN flow_version_id UUID REFERENCES flow_versions(id);
```

### Pydantic Graph Schema

```python
# backend/app/schemas/flow.py

from enum import Enum
from pydantic import BaseModel, Field, model_validator
from typing import Any, Self
from uuid import UUID

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

class Position(BaseModel):
    """Node position on canvas."""
    x: float
    y: float

class NodeData(BaseModel):
    """Generic node data payload."""
    label: dict[str, str]  # LocalizedString: {hu, en}
    nodeType: FlowNodeType
    config: dict[str, Any] = Field(default_factory=dict)

class FlowNode(BaseModel):
    """React Flow node structure."""
    id: str
    type: str = "default"  # React Flow node type (custom component name)
    position: Position
    data: NodeData
    parentId: str | None = None  # For swimlane containment
    extent: str | None = None    # 'parent' to constrain to group
    measured: dict[str, float] | None = None  # Set by React Flow after render

class FlowEdge(BaseModel):
    """React Flow edge structure."""
    id: str
    source: str
    target: str
    sourceHandle: str | None = None
    targetHandle: str | None = None
    label: str | None = None
    animated: bool = False

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
        """Validate graph has required structure for publishing."""
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

# Request/Response schemas
class FlowDefinitionCreate(BaseModel):
    """Create a new flow definition."""
    name: dict[str, str]  # LocalizedString
    description: str | None = None

class FlowDefinitionResponse(BaseModel):
    """Flow definition response."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: dict[str, str]
    description: str | None
    created_at: datetime
    updated_at: datetime
    latest_version: int | None = None  # Computed from versions

class FlowVersionCreate(BaseModel):
    """Create initial draft version (internal use)."""
    graph_schema: GraphSchema = Field(default_factory=GraphSchema)

class FlowVersionUpdate(BaseModel):
    """Update draft version graph."""
    graph_schema: GraphSchema

class FlowVersionResponse(BaseModel):
    """Flow version response."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    flow_definition_id: UUID
    version_num: int
    status: FlowVersionStatus
    graph_schema: GraphSchema
    created_at: datetime
    published_at: datetime | None
```

### Task List (Ordered)

```yaml
# Phase P0: Backend Foundation
Task 1: Create Database Migration
  FILE: backend/alembic/versions/{timestamp}_add_flow_definitions.py
  PATTERN: Follow existing migration patterns
  DELIVERABLE: flow_definitions + flow_versions tables + production_runs.flow_version_id
  VALIDATION: alembic upgrade head succeeds

Task 2: Create SQLAlchemy Models
  FILE: backend/app/models/flow.py
  PATTERN: Copy from backend/app/models/production.py
  DELIVERABLE: FlowDefinition, FlowVersion models with relationships
  VALIDATION: Import succeeds in backend/app/models/__init__.py

Task 3: Create Pydantic Schemas
  FILE: backend/app/schemas/flow.py
  PATTERN: Copy from backend/app/schemas/qc.py
  DELIVERABLE: GraphSchema, FlowNode, FlowEdge, request/response schemas
  VALIDATION: pytest tests/test_flow_schemas.py passes

Task 4: Create RBAC Type Aliases
  FILE: backend/app/api/deps.py (append)
  PATTERN: Follow existing aliases (CanCreateLots, AdminOrManager)
  DELIVERABLE: CanEditFlows, CanPublishFlows aliases
  VALIDATION: Import succeeds

Task 5: Create Flow API Routes
  FILE: backend/app/api/routes/flows.py
  PATTERN: Copy from backend/app/api/routes/lots.py
  DELIVERABLE: CRUD endpoints with RBAC + rate limiting
  VALIDATION: pytest tests/test_flow_routes.py passes

Task 6: Register Routes
  FILE: backend/app/api/routes/__init__.py (append)
  PATTERN: Follow existing router registration
  DELIVERABLE: api_router.include_router(flows.router)
  VALIDATION: /api/flows endpoint responds

# Phase P1: Frontend Editor Core
Task 7: Install React Flow
  COMMAND: cd flow-viz-react && npm install @xyflow/react
  DELIVERABLE: Package added to package.json
  VALIDATION: npm run build succeeds

Task 8: Create Flow Editor Types
  FILE: flow-viz-react/src/types/flowEditor.ts
  PATTERN: Follow flow-viz-react/src/types/flow.ts
  DELIVERABLE: EditorNode, EditorEdge, FlowDefinition, FlowVersion types
  VALIDATION: TypeScript compiles without errors

Task 9: Create Flow Editor Store
  FILE: flow-viz-react/src/stores/useFlowEditorStore.ts
  PATTERN: Follow useFlowStore.ts
  DELIVERABLE: Zustand store for editor state (nodes, edges, selectedId, isDirty)
  VALIDATION: Store mounts without errors

Task 10: Create API Client Functions
  FILE: flow-viz-react/src/lib/api/flows.ts
  PATTERN: Follow flow-viz-react/src/lib/api/lots.ts
  DELIVERABLE: listFlows, getFlowVersion, saveFlowVersion, publishFlow
  VALIDATION: TypeScript compiles

Task 11: Create TanStack Query Hooks
  FILE: flow-viz-react/src/hooks/useFlows.ts
  PATTERN: Follow useLots.ts
  DELIVERABLE: useFlowVersions, useSaveFlowDraft, usePublishFlow
  VALIDATION: Hooks render without errors

Task 12: Create Custom Node Components
  FILES:
    - flow-viz-react/src/components/flowEditor/nodes/StartNode.tsx
    - flow-viz-react/src/components/flowEditor/nodes/ProcessNode.tsx
    - flow-viz-react/src/components/flowEditor/nodes/QCGateNode.tsx
    - flow-viz-react/src/components/flowEditor/nodes/BufferNode.tsx
    - flow-viz-react/src/components/flowEditor/nodes/EndNode.tsx
    - flow-viz-react/src/components/flowEditor/nodes/SwimlaneNode.tsx
  PATTERN: React Flow custom nodes with handles
  DELIVERABLE: Node components with proper styling
  VALIDATION: Nodes render on canvas

Task 13: Create Node Palette Component
  FILE: flow-viz-react/src/components/flowEditor/NodePalette.tsx
  DELIVERABLE: Draggable node templates sidebar
  VALIDATION: Drag preview appears

Task 14: Create Properties Panel Component
  FILE: flow-viz-react/src/components/flowEditor/PropertiesPanel.tsx
  DELIVERABLE: Context-aware config form for selected node/edge
  VALIDATION: Form updates node data

Task 15: Create Flow Canvas Component
  FILE: flow-viz-react/src/components/flowEditor/FlowCanvas.tsx
  PATTERN: React Flow with Zustand integration
  DELIVERABLE: Interactive canvas with drag-drop, connect, select
  VALIDATION: Nodes can be dragged, connected

Task 16: Create Flow Editor Page
  FILE: flow-viz-react/src/components/flowEditor/FlowEditorPage.tsx
  PATTERN: Follow FirstFlowPage.tsx layout
  DELIVERABLE: Integrated editor with palette, canvas, panel
  VALIDATION: Page loads without errors

Task 17: Add Route to Router
  FILE: flow-viz-react/src/router.tsx
  DELIVERABLE: /flow-editor/:id route
  VALIDATION: Navigation works

# Phase P2: Save/Load/Publish
Task 18: Implement Auto-Save
  FILE: flow-viz-react/src/components/flowEditor/FlowCanvas.tsx (update)
  DELIVERABLE: Debounced save (2s) when isDirty changes
  VALIDATION: Draft persists after reload

Task 19: Implement Publish Flow
  FILE: flow-viz-react/src/components/flowEditor/FlowEditorPage.tsx (update)
  DELIVERABLE: Publish button (Manager only), creates new version
  VALIDATION: Published version shows in list

Task 20: Add Flow Catalog Page
  FILE: flow-viz-react/src/components/flowEditor/FlowCatalogPage.tsx
  DELIVERABLE: Grid view of flows with version info
  VALIDATION: Flows listed, can open editor

# Phase P3: Testing & Validation
Task 21: Backend Unit Tests
  FILE: backend/tests/test_flow_routes.py
  DELIVERABLE: Tests for CRUD, RBAC, publish workflow
  VALIDATION: pytest passes

Task 22: Frontend Lint & Build
  COMMAND: cd flow-viz-react && npm run lint && npm run build
  DELIVERABLE: No errors
  VALIDATION: Build succeeds

Task 23: Integration Test
  DELIVERABLE: Manual test of full workflow
  VALIDATION: Create → Edit → Save → Publish → Load works
```

---

## Validation Loop

### Level 1: Backend Validation

```bash
# Run from backend/ directory
cd backend

# 1. Type checking
uv run mypy app/models/flow.py app/schemas/flow.py app/api/routes/flows.py

# 2. Linting
uv run ruff check app/models/flow.py app/schemas/flow.py app/api/routes/flows.py --fix

# 3. Schema validation test
uv run pytest tests/test_flow_schemas.py -v

# 4. Route tests
uv run pytest tests/test_flow_routes.py -v

# 5. Full test suite
uv run pytest --cov=app --cov-report=term-missing

# Expected: All tests pass, no type errors, no lint errors
```

### Level 2: Frontend Validation

```bash
# Run from flow-viz-react/ directory
cd flow-viz-react

# 1. TypeScript compilation
npm run build

# 2. Linting
npm run lint

# 3. Dev server starts without errors
npm run dev
# Navigate to http://localhost:5173/flow-editor/new

# Expected: No compile errors, lint passes, page loads
```

### Level 3: Integration Validation

```bash
# Start both services
# Terminal 1: Backend
cd backend && uv run uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd flow-viz-react && npm run dev

# Manual Tests:
# 1. Navigate to /flow-editor (catalog)
# 2. Create new flow definition
# 3. Drag Start, Process, QC Gate, End nodes
# 4. Connect nodes with edges
# 5. Create swimlane, drag nodes into it
# 6. Reload page - draft persists
# 7. Click Publish (as Manager)
# 8. Verify version incremented
# 9. Try to edit published version - should fork to new draft
```

---

## File Structure (After Implementation)

```plaintext
backend/
├── alembic/versions/
│   └── {timestamp}_add_flow_definitions.py  # NEW
├── app/
│   ├── models/
│   │   ├── __init__.py                      # UPDATED (add FlowDefinition, FlowVersion)
│   │   └── flow.py                          # NEW
│   ├── schemas/
│   │   ├── __init__.py                      # UPDATED (add flow schemas)
│   │   └── flow.py                          # NEW
│   └── api/
│       ├── deps.py                          # UPDATED (add CanEditFlows, CanPublishFlows)
│       └── routes/
│           ├── __init__.py                  # UPDATED (add flows router)
│           └── flows.py                     # NEW
└── tests/
    ├── test_flow_schemas.py                 # NEW
    └── test_flow_routes.py                  # NEW

flow-viz-react/
├── src/
│   ├── types/
│   │   └── flowEditor.ts                    # NEW
│   ├── stores/
│   │   └── useFlowEditorStore.ts            # NEW
│   ├── lib/api/
│   │   ├── index.ts                         # UPDATED (add flows)
│   │   └── flows.ts                         # NEW
│   ├── hooks/
│   │   └── useFlows.ts                      # NEW
│   ├── components/flowEditor/
│   │   ├── nodes/
│   │   │   ├── StartNode.tsx                # NEW
│   │   │   ├── ProcessNode.tsx              # NEW
│   │   │   ├── QCGateNode.tsx               # NEW
│   │   │   ├── BufferNode.tsx               # NEW
│   │   │   ├── EndNode.tsx                  # NEW
│   │   │   └── SwimlaneNode.tsx             # NEW
│   │   ├── NodePalette.tsx                  # NEW
│   │   ├── PropertiesPanel.tsx              # NEW
│   │   ├── FlowCanvas.tsx                   # NEW
│   │   ├── FlowEditorPage.tsx               # NEW
│   │   └── FlowCatalogPage.tsx              # NEW
│   └── router.tsx                           # UPDATED (add routes)
└── package.json                             # UPDATED (add @xyflow/react)
```

---

## Final Validation Checklist

### Backend
- [ ] `alembic upgrade head` succeeds
- [ ] Models import without errors
- [ ] Schemas validate graph structure
- [ ] Routes enforce RBAC (Editor: draft, Manager: publish)
- [ ] Publishing creates immutable version
- [ ] `uv run pytest` passes
- [ ] `uv run ruff check . && uv run mypy app/` no errors

### Frontend
- [ ] `npm install @xyflow/react` succeeds
- [ ] Custom nodes render on canvas
- [ ] Drag-and-drop from palette works
- [ ] Swimlanes constrain child nodes
- [ ] Auto-save persists drafts
- [ ] Publish button visible only for Managers
- [ ] `npm run lint && npm run build` passes

### Integration
- [ ] Full create → edit → save → publish workflow works
- [ ] Published versions are read-only
- [ ] Version history is preserved
- [ ] RBAC enforced end-to-end

---

## Anti-Patterns to Avoid

- ❌ Don't store node positions in React `useState` (use Zustand for 60fps)
- ❌ Don't allow editing published versions (fork to new draft instead)
- ❌ Don't reference "latest" version in production runs (use specific ID)
- ❌ Don't skip Pydantic validation before saving graph_schema
- ❌ Don't hardcode node types (use enum for extensibility)
- ❌ Don't commit without running full test suite

---

## Confidence Score: 8/10

**High confidence** due to:
- Clear codebase patterns to follow
- Well-documented React Flow library
- Established RBAC and API patterns in existing code
- Comprehensive task breakdown

**Minor uncertainty on**:
- Swimlane edge cases (drag between swimlanes)
- Auto-layout integration (dagre/elkjs) - deferred to P2
- Complex graph validation rules (cycles, orphans) - basic validation first

---

## Sources

- [React Flow Installation](https://reactflow.dev/learn/getting-started/installation-and-requirements)
- [React Flow Custom Nodes](https://reactflow.dev/learn/customization/custom-nodes)
- [React Flow Sub Flows](https://reactflow.dev/learn/layouting/sub-flows)
- [React Flow Save and Restore](https://reactflow.dev/examples/interaction/save-and-restore)
- [React Flow State Management](https://reactflow.dev/learn/advanced-use/state-management)
- [React Flow Labeled Group Node](https://reactflow.dev/ui/components/labeled-group-node)
- [@xyflow/react npm](https://www.npmjs.com/package/@xyflow/react)
