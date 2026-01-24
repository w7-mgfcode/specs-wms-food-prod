# INITIAL-10: Flow Definition Editor

## FEATURE:

**Flow Definition Editor (Visual Workflow Builder)**

Transform the current read-only flow viewer into a fully editable, versioned workflow builder. This allows "Process Engineers" (non-developers) to define manufacturing steps, QC gates, and swimlanes using a drag-and-drop interface.

**Core Capabilities:**
1.  **Visual Editor**: Drag-and-drop nodes (Start, Process, QC, End) onto an infinite canvas.
2.  **Swimlanes**: visually group steps into functional areas (e.g., "Preparation", "Cooking", "Packaging").
3.  **Versioning**: Strict "Draft" vs "Published" lifecycle. published flows are immutable and used for production runs.
4.  **RBAC**: Only Managers can Publish; Editors can Draft.

## EXAMPLES:

Since the `examples/` directory is not present, we reference the core patterns established in our `PRPs/` directory:

1.  **`PRPs/EXAMPLE_multi_agent_prp.md`**:
    - Defines the standard for multi-agent task breakdown. We follow this structure for the Flow Editor plan, specifically breaking down Backend and Frontend tasks.
    - *Adaptation*: We created `docs/plans/flow-definition-editor.md` following this exact structure.

2.  **`backend/app/schemas` (Pydantic v2 Patterns)**:
    - We will mirror the existing Pydantic validation patterns found in the backend for the new `GraphSchema`.
    - *Key Pattern*: Strict typing with `ConfigDict(from_attributes=True)`.

## DOCUMENTATION:

**Internal Specs**:
- **[docs/plans/flow-definition-editor.md](docs/plans/flow-definition-editor.md)**: The detailed architectural plan (Schema, API, Components).
- **[docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md)**: Branching strategy for this feature (`phase/7-ui-enhancements`).

**External Libraries**:
- **[React Flow (XYFlow)](https://reactflow.dev/)**: Main library for the canvas.
    - *Key Docs*: "Custom Nodes", "Sub Flows" (for swimlanes), "Save and Restore".
- **[TanStack Query](https://tanstack.com/query/latest)**: For server state sync.
- **[Zustand](https://zustand-demo.pmnd.rs/)**: For local canvas state (selection, dragging performance).

## OTHER CONSIDERATIONS:

**Gotchas & Requirements**:
1.  **Hybrid Data Model**: We are storing the *Design Definition* as a JSON Blob (Draft) but the *Runtime Execution* as normalized relational data (for performance). This means the "Publish" step is complex—it must "compile" the JSON into SQL rows (or we validate the JSON strictly so runtime can read it directly).
    - *Decision*: Validation is critical at the API layer.
2.  **Canvas Performance**: Dragging nodes must be 60fps. Do NOT store node positions in React State (useState) if it causes re-renders of the whole app. Use **Zustand** + unmanaged refs for high-frequency updates.
3.  **Swimlane UX**: "Swimlanes" in node editors can be tricky. We will implement them as **Group Nodes** (SubFlows). If a user drags a node *out* of a swimlane, logic must handle that (or restrict it).
4.  **Versioning Safety**: A "Production Run" must point to a specific *Version ID* (e.g., v1.2), never "Latest". If v1.3 is published while a run is active, the run MUST stay on v1.2.
