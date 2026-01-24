# Phase Plan: Flow Definition Editor (Visual Workflow Builder)

> **Role**: Senior Full-Stack Architect + UX Engineer
> **Date**: 2026-01-24
> **Status**: PROPOSED
> **Target Branch**: `phase/flow-editor`

## 1. Architecture Overview

To transition from a static viewer to a dynamic editor, we will adopt a **Hybrid Architecture**:
- **Design-Time (Editor)**: Uses a document-oriented model (JSONB) to store the visual graph (layout, positions, edges, config). This offers maximum flexibility for the UI (XYFlow).
- **Run-Time (Execution)**: Uses a structured model. When a flow version is "Published", the backend parses the graph and validates logic, but we primarily execute from the immutable JSON definition (or a compiled version of it).
- **Library Choice**: **React Flow (XYFlow)**. It is the industry standard for React, supports React 19, and handles the "interactive graph" complexity (zooming, selection, dragging) better than any custom solution.

### Modules & Responsibilities

| Layer | Module | Responsibility |
|-------|--------|----------------|
| **Frontend** | `FlowEditor` | derived from XYFlow. Handles canvas interaction, drag-and-drop. |
| **Frontend** | `FlowStore` | Zustand store. Manages the *uncommitted* draft state, undo/redo stack, and UI selection. |
| **Backend** | `FlowDefService` | CRUD for definitions. Handles "Publishing" (validating connectivity, locking version). |
| **Backend** | `FlowExecService` | Instantiates a `FlowRun` from a `FlowVersion`. Maps active nodes to real operations. |
| **DB** | `flow_versions` | Stores the "Source Code" of the flow (JSON graph). |

---

## 2. Database Schema Changes

We need to introduce a new schema domain for generic flows, separate from the current hardcoded `scenarios`.

### Tables

```sql
-- The abstract concept of a flow (e.g., "Standard Production Line")
CREATE TABLE flow_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Immutable versions of a flow (e.g., "v1.0", "v1.1-draft")
CREATE TABLE flow_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_definition_id UUID REFERENCES flow_definitions(id),
    version_num INTEGER NOT NULL, -- sequential 1, 2, 3
    status VARCHAR(50) NOT NULL, -- 'DRAFT', 'PUBLISHED', 'ARCHIVED'
    
    -- The Core Graph Definition
    -- Contains: { nodes: [], edges: [], viewport: {} }
    graph_schema JSONB NOT NULL DEFAULT '{}',
    
    -- Extracted Metadata for Quick Indexing (Optional optimization)
    -- e.g., ["QC_GATE_1", "PACKAGING_STEP"]
    node_index JSONB DEFAULT '[]',

    created_by UUID REFERENCES users(id), -- RBAC
    committed_at TIMESTAMPTZ, -- When it was published
    
    UNIQUE(flow_definition_id, version_num)
);

-- (Optional) If we need relational strictness for reporting queries later,
-- we can add a flow_nodes table that is hydrated triggers ONLY on publish.
-- For Phase P0/P1, we will stick to JSONB for simplicity and agility.
```

---

## 3. API Design (FastAPI)

### Endpoints

| Method | Path | RBAC | Description |
|--------|------|------|-------------|
| `GET` | `/api/flows` | Viewer | List all flow definitions (latest published versions) |
| `POST` | `/api/flows` | Editor | Create a new flow definition (starts at v1 Draft) |
| `GET` | `/api/flows/{id}/versions` | Editor | List all versions of a flow |
| `GET` | `/api/flows/{id}/versions/{vid}` | Viewer | Get full graph JSON for a specific version |
| `PUT` | `/api/flows/{id}/versions/{vid}` | Editor | Save Draft (Update graph_schema JSON). Allowed only if status=DRAFT. |
| `POST` | `/api/flows/{id}/versions/{vid}/publish` | Manager | **Validate** and **Lock** version. Creates new v(N+1) Draft automatically. |
| `POST` | `/api/flows/{id}/versions/{vid}/clone` | Editor | Fork a flow into a new definition. |

---

## 4. Frontend Architecture (React 19)

### Components

1.  **`FlowCatalog`**: Grid view of available flows. Cards show "Active Version", "Last Edited".
2.  **`FlowDesigner`** (The Editor Page):
    *   **`NodePalette`** (Left Sidebar): Draggable templates (Start Node, Process Step, QC Gate, Buffer).
    *   **`Canvas`** (Center): Wrapper around `<ReactFlow />`. Handles `onDrop`, `onConnect`.
    *   **`PropertiesPanel`** (Right Sidebar): Context-aware form. If Node selected -> Show Config. If Edge selected -> Show Label/Condition.
3.  **`FlowRunViewer`** (The Runtime Page):
    *   Read-only version of the Canvas.
    *   Overlays "Live Data" (badges count, alerts) on top of the node positions.

### State Management
*   **Zustand**: Used for the *Editor Session*. Dragging visual nodes needs 60fps performance; we cannot wait for server roundtrips.
    *   `useFlowStore`: `nodes[]`, `edges[]`, `selectedId`.
    *   Actions: `addNode`, `updateNodeConfig`, `autoLayout`.
*   **TanStack Query**: Used to *Load* the initial version and *Save* (auto-save debounce).

---

## 5. UX Specification

### "Advanced Mode" (Canvas Editor) - **DEFAULT**
Since manufacturing flows branch (QC Pass/Fail), a linear list is insufficient. We will use a **Canvas-first** approach but with "Smart Snapping".
*   **Swimlanes**: Implemented as "Group Nodes" (SubFlows) in React Flow.
    *   User creates a "Department" container (e.g., "Packaging Zone").
    *   Drops nodes *inside* that container.
*   **Auto-Layout**: "Magic Wand" button using `dagre` or `elkjs` to automatically organize messy graphs.
*   **Validation**:
    *   Cannot publish if there are "floating" nodes (unconnected).
    *   Cannot publish if "Start" or "End" is missing.
    *   Visual error indicators (red outline) on invalid nodes.

### Runtime Integration (The "Overlay")
The definitions are blueprints. Whent a `ProductionRun` starts, it references `flow_version_id`.
The UI fetches:
1.  The `graph_schema` (from `flow_versions`).
2.  The `runtime_state` (lots counts per node_id).
3.  Merges them: `<Node id="step_1" data={{ ...config, runtimeCount: 50 }} />`.

---

## 6. Phased Delivery Roadmap

### P0: Foundation (Backend)
- [ ] Create DB migrations (`flow_definitions`, `flow_versions`).
- [ ] Implement `Pydantic` models for the Graph Schema (Node/Edge typing).
- [ ] Create `FlowDefService` with Draft/Publish logic.

### P1: The Editor (Frontend)
- [ ] Install `reactflow` (xyflow).
- [ ] Build `FlowDesigner` layout.
- [ ] Implement Drag-and-Drop from Palette.
- [ ] Implement Save (Debounced PUT to draft).

### P2: Node Configuration
- [ ] Build `PropertiesPanel` forms for specific node types (e.g., "QC Gate" needs "Checklist" config).
- [ ] Validate graph integrity on client-side.

### P3: Runtime Connection
- [ ] Update `ProductionRun` model to link to `flow_version_id`.
- [ ] Build `FlowRunViewer` that loads the graph and overlays live lot counts.

---

## 7. Acceptance Criteria Checks

- [ ] **Create**: User can create "My New Process".
- [ ] **Edit**: User can drag a "QC Gate" node onto the canvas and name it "Metal Detector".
- [ ] **Save**: Reloading the page restores the draft diagram.
- [ ] **Publish**: Clicking publish locks the version.
- [ ] **Runtime**: Starting a run uses the *Published* graph, not the *Draft* one.
- [ ] **Security**: Only Managers can Publish. Editors can Save Drafts.

## 8. Task Breakdown (for Agents)

### Backend Agent
- **Task**: "Scaffold Flow Schema"
  - File: `backend/app/models/flow.py`
  - Complexity: Medium
- **Task**: "Flow CRUD API"
  - File: `backend/app/api/routes/flows.py`
  - Complexity: Medium

### Frontend Agent
- **Task**: "Setup React Flow"
  - Dependencies: `@xyflow/react`
  - File: `src/components/flow/FlowCanvas.tsx`
  - Complexity: Medium
- **Task**: "Properties Panel"
  - File: `src/components/flow/PropertiesPanel.tsx`
  - Complexity: Large

---
*Generated by Agentic Architect for FlowViz WMS*
