# Phase 3: First Production Flow (Interactive Visual Spec)

## Context
This document captures the requested **Phase 3** effort to define a **full, interactive, step-by-step
production flow** (or a single-stack enhancement) with a **creative visual**. The scope includes
initial buffer lots and QC gate sequencing for the first flow, with data aligned to the existing
lot genealogy and QC decision requirements.

### Reference inputs (from research notes)
**Buffers / lots**
- LK Buffer (0–4°C)
  - BULK-20260114-DUNA-5001 — Mell: 200 kg
  - BULK-20260114-DUNA-5002 — Bőr: 30 kg
  - BULK-20260114-DUNA-5003 — Combfilé: 120 kg
- MIX Buffer (0–4°C)
  - MIXLOT-20260115-DUNA-0001 — Today’s Mix: 1,070 kg
- SKW15 Buffer (0–4°C)
  - SKW15-20260115-DUNA-0001 — 15kg rods: 20 pcs
  - SKW15-20260115-DUNA-0002 — 15kg rods: 20 pcs
- SKW30 Buffer (0–4°C)
  - SKW30-20260115-DUNA-0001 — 30kg rods: 8 pcs
  - SKW30-20260115-DUNA-0002 — 30kg rods: 7 pcs

**QC gates (sequence)**
- Gate 1: Receipt
- Gate 3: Deboning
- Gate 4: BULK Ready
- Gate 5: Mix
- Gate 6: Skewer Weigh
- Gate 6.5: SKU Split
- Gate 7: Freeze
- Gate 8: (Label TBD; see Open Questions)

**Main goal**
- Edit or create a **full new Production Flow**
- Support **interactive, step-by-step** visualization (or a focused change to one stack)
- Be **creative in visual** presentation

---

## ANALYZE

### Rephrase the problem
We need to define a **Phase 3 production flow** that visualizes the first operational stream using
realistic buffer lots, temperatures, weights, and QC gate steps. The flow should be **interactive**
(step-by-step) and **visually creative**, either by redesigning a full flow or by enhancing a single
stack in a meaningful, engaging way.

### Unknowns / open questions
- **Gate 8 definition**: Is Gate 8 Packaging, Palletizing, Shipment, or a custom compliance gate?
  What fields must be captured (labels, operator sign-off, pallet IDs, shipping temps)?
- **Primary UI surface**: Should Phase 3 live in V1 (Dashboard), V2 (Command Center), V3
  (Validator), or a dedicated Phase 3 route? Which user persona is the priority?
- **Editability and authority**: Are lots/QC decisions editable during step progression, or locked
  as read-only snapshots for audit integrity?
- **HACCP compliance**: Do we need explicit temperature log capture at every CCP gate, and how
  should exceptions (HOLD/FAIL) be represented in the UI?
- **Data contract**: Do we source this from mock config only, or will it map 1:1 to backend
  schema (lots, lot_genealogy, qc_decisions)?

### Relevant dimensions
- **Tech:** React-based flow visualization, Zustand state, potential Supabase or FastAPI-backed
  data sources, and reusable UI widgets for gates/lots/buffers.
- **Data:** Lot identifiers, weights, temperatures, quantities (pcs), parent/child relations, QC
  decisions, and timestamps for step progression.
- **Security:** Role-based visibility (viewer/operator/manager/auditor), immutable QC logs, and
  audit trails for gate decisions.
- **Cost:** Frontend build effort vs. backend parity changes; prioritize minimal backend changes
  and schema reuse where possible.
- **Scale:** Must support multiple lots per buffer, multiple buffers per flow, and multiple gates
  without overwhelming the screen.
- **UX/Accessibility:** Clear active-step cueing, compact density with progressive disclosure,
  and readability for operators on factory-floor displays.

---

## BRAINSTORM

### Alternative ideas
1. **Step-by-step “Run Mode” overlay**
   - A guided UI that advances gate-by-gate, highlighting the active buffer and QC gate.
2. **Single-stack enhancement**
   - Focus only on the first stream with richer cards, inline QC decisions, and lot details.
3. **Lane-based flow map**
   - Horizontal lanes by buffer type (LK, MIX, SKW15, SKW30), with gate markers and lot cards.
4. **Timeline + snapshots**
   - A vertical timeline of gates; each gate expands into buffer snapshots and QC metadata.
5. **Split view (map + detail)**
   - Left panel shows lane map; right panel shows selected lot/gate details and QC decision form.

### Pros / cons
- **Run Mode overlay**
  - Pros: Highly interactive, supports step-by-step guidance.
  - Cons: More state management and interaction logic.
- **Single-stack enhancement**
  - Pros: Lower cost, faster delivery, minimal refactor.
  - Cons: Less holistic visualization, may feel incomplete.
- **Lane-based map**
  - Pros: Clear spatial mapping, supports multiple lot cards.
  - Cons: Can become visually dense without good layout.
- **Timeline + snapshots**
  - Pros: Strong narrative flow, easy to scan.
  - Cons: Less “live” feel if not animated.
- **Split view**
  - Pros: Keeps map clean while allowing depth for QA/QC details.
  - Cons: More layout complexity, risks competing focal points.

### Patterns / analogies / mental models
- **Manufacturing line storyboard:** each gate is a frame with contextual lot cards.
- **Airport baggage flow:** buffers as conveyor bays, gates as checkpoints.
- **Kanban + swimlanes:** buffers are lanes, lots are cards, gates are column separators.
- **Control room dashboard:** high-level view with drill-down panel for exceptions.

---

## RESEARCH

### Relevant technologies / models / architectures
- **React + Zustand** for step flow state, gate progression, and active-lot selection.
- **Composable UI widgets** for lot cards, gate panels, and buffer summaries.
- **Structured scenario data** (lots, gates, transitions) to drive dynamic rendering.
- **State machine mindset** (simple finite state for gates) to avoid ambiguous transitions.

### Best practices
- **Progressive disclosure:** show summary first, expand details on interaction.
- **Consistency with QC gate models:** explicit gate types and immutable decisions.
- **Semantic temperature/weight badges:** quick comprehension of compliance status.
- **Stable identifiers:** keep lot codes and gate IDs persistent to support audit links.

### Anti-patterns
- **Overloading a single screen** with too many nodes, leading to visual noise.
- **Hidden state transitions** without explicit UI cues.
- **Unbounded interactivity** that makes parity or audit trails ambiguous.
- **Gate-specific logic scattered across components**, making the flow hard to change.

### Risks / uncertainties
- Gate 8 ambiguity may lead to incorrect labeling or compliance assumptions.
- Without a clear data contract, the UI could diverge from existing traceability structures.
- Over-indexing on UI polish without validating operator workflows could slow adoption.

---

## SYNTHESIS

### Merged direction
A **lane-based flow map** with a **step-by-step Run Mode overlay** offers the best balance of
clarity and interactivity. We can keep the initial scope to the first stream while ensuring
buffer cards and QC gates are visually distinct, interactive, and data-driven.

### Decision directions
- Use a lane-based layout for buffers (LK, MIX, SKW15, SKW30).
- Overlay a step-by-step gate progression that highlights the active QC gate and relevant lots.
- Represent each lot as a compact card with temperature/weight/quantity badges.

### Trade-off summary
- **Interactive overlay** improves usability but adds state complexity.
- **Single-stack focus** reduces scope while still enabling a complete narrative for Phase 3.

---

## SPECIFICATION – FINAL OUTPUT

### What we decided
We will create a **Phase 3 Production Flow** as a **lane-based visual map** for the first stream,
layered with a **step-by-step gate progression**. This avoids duplicating the entire system while
still delivering a complete, interactive experience for the LK → MIX → SKW pipeline, aligned to
current gate sequencing and buffer lots.

### Target architecture
- **Data-driven flow model:** buffers, lots, and gates as structured configuration.
- **Lane-based UI:** each buffer is a lane; lots render as cards within the lane.
- **Step progression overlay:** a controlled state machine highlights the active gate and
  relevant lots.
- **Role-aware interactions:** view-only for non-operators, controlled actions for operators.

### Key components
- **BufferLane**: displays buffer title, temperature range, and lot cards.
- **LotCard**: compact card with ID, weight/quantity, and status badges.
- **GateStepper**: ordered QC gate sequence with active/complete states.
- **RunModeController**: toggles step-by-step progression and context hints.

### Open questions
- Confirm **Gate 8** label and any required metadata.
- Decide whether Phase 3 ships as a new route or augments an existing FlowViz page.
- Confirm whether operators can edit/override lots during step progression.

### Next steps
1. Confirm Gate 8 label and requirements.
2. Define the flow config schema (buffers, lots, gates, transitions).
3. Implement UI prototype (lane-based layout + GateStepper + RunMode toggle).
4. Validate with stakeholders for clarity, interaction flow, and data correctness.
