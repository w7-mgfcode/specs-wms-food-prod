# Phase 3 First Flow INITIAL Spec

## Constraints + Examples

### Constraints
- **Stay within current frontend stack**: React 19 + TypeScript + Vite + Zustand; no new state or
  visualization libraries unless explicitly approved.
- **No backend breaking changes**: the Phase 3 flow should be driven by configuration or existing
  data contracts (lots, lot genealogy, QC decisions) without altering API response shapes.
- **Audit integrity**: QC decisions remain immutable; UI must not imply edits unless explicitly
  permitted by role.
- **Performance**: the flow must render smoothly with multiple lots per buffer (target: <100 items
  on screen) without layout thrash or heavy reflows.
- **Accessibility/readability**: operator-facing UI needs clear active-step cues and high contrast
  status badges for temperatures and QC states.
- **File size discipline**: keep components within 500 lines and functions within 50 lines.

### Examples (seed data references)
- **LK Buffer (0–4°C)**
  - BULK-20260114-DUNA-5001 — Mell: 200 kg
  - BULK-20260114-DUNA-5002 — Bőr: 30 kg
  - BULK-20260114-DUNA-5003 — Combfilé: 120 kg
- **MIX Buffer (0–4°C)**
  - MIXLOT-20260115-DUNA-0001 — Today’s Mix: 1,070 kg
- **SKW15 Buffer (0–4°C)**
  - SKW15-20260115-DUNA-0001 — 15kg rods: 20 pcs
  - SKW15-20260115-DUNA-0002 — 15kg rods: 20 pcs
- **SKW30 Buffer (0–4°C)**
  - SKW30-20260115-DUNA-0001 — 30kg rods: 8 pcs
  - SKW30-20260115-DUNA-0002 — 30kg rods: 7 pcs
- **QC gates (sequence)**
  - Gate 1: Receipt
  - Gate 3: Deboning
  - Gate 4: BULK Ready
  - Gate 5: Mix
  - Gate 6: Skewer Weigh
  - Gate 6.5: SKU Split
  - Gate 7: Freeze
  - Gate 8: (Label TBD)

## Research Options (3–5)

1. **Lane-based flow map + step overlay**
   - Lanes by buffer type; active gate highlighted in a stepper overlay.
2. **Single-stack enhancement only**
   - Enhance the first stream with richer lot cards and inline QC summaries.
3. **Timeline narrative view**
   - Vertical gate timeline with expandable snapshots per buffer.
4. **Split view (map + detail)**
   - Left lane map, right detail panel for selected lot/gate info.

## Tradeoffs (Cost / Risk / Time)

| Option | Cost | Risk | Time | Notes |
| --- | --- | --- | --- | --- |
| Lane-based + overlay | Medium | Low | Medium | Balanced interactivity and clarity, moderate state work. |
| Single-stack enhancement | Low | Low | Short | Fastest, but less holistic. |
| Timeline narrative | Medium | Medium | Medium | Clear story, less “live” feel. |
| Split view | Medium | Medium | Medium | Strong detail view, more layout complexity. |

## MVP Decision

### Chosen: Lane-based flow map + step overlay

- Delivers an interactive, step-by-step experience while keeping UI comprehensible.
- Minimizes backend risk by relying on configuration data and existing schema concepts.
- Scales to multiple buffers and lots without requiring new infrastructure.

## Milestones

1. **M0: Flow config schema**
   - Define data model for buffers, lots, gates, and transitions.
2. **M1: Base lane UI**
   - Render lanes and lot cards with temperature/weight badges.
3. **M2: Gate stepper overlay**
   - Add step progression controls and active gate highlight logic.
4. **M3: Role-aware behaviors**
   - Read-only vs operator interactions; audit-safe UI cues.
5. **M4: Visual polish + accessibility**
   - Ensure contrast, spacing, and density are operator friendly.
6. **M5: Stakeholder validation**
   - Walkthrough review and iterate on feedback.

## Validation Checkpoints

- **Data accuracy**: lot cards and gate sequence match the reference buffer list and QC order.
- **Interaction clarity**: active step is visually obvious and consistent across lanes.
- **Performance**: no noticeable frame drops when rendering target data volume.
- **Role enforcement**: no edit affordances for read-only roles.
- **Parity safety**: no API response shape changes required to support UI.

## Final Spec (Deliverables)

- Configuration-driven flow model for Phase 3.
- Lane-based UI with lot cards and temperature/weight/quantity badges.
- Step progression overlay (GateStepper + RunMode toggle).
- Role-aware interaction affordances with audit-safe cues.
- Updated documentation for Phase 3 UX and data requirements.
