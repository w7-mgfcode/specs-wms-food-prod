# Backend Refactor INITIAL-2 (Addendum to INITIAL.md)

This document **builds on** `INITIAL.md` and avoids restating baseline constraints, options, and
milestones. Treat it as a delta focused on (1) clarity gaps, (2) decision checkpoints, and
(3) alignment items surfaced by the backend refactor plan.

## What is *not* duplicated here
- **Baseline constraints, options, tradeoffs, MVP choice, milestones, and validation** remain the
  source of truth in `INITIAL.md`.
- This file only adds clarifications, guardrails, and a few refinements to reduce ambiguity.

## Clarifications and guardrails (delta)

### API parity scope
- Parity should be defined **per-endpoint** with explicit response shape contracts (fields,
  types, nullable behavior, and error format).
- Golden snapshots must capture both **success** and **failure** responses.

### Authentication migration path
- The new FastAPI login flow must match the **current Node/Express behavior** first (response
  shape + status codes), then evolve to bcrypt/JWT once parity is proven.
- If passwordless behavior is retained during parity, document the transition plan in the
  milestone notes.

### Performance baselines
- Define acceptable latency thresholds per endpoint before parity validation gates.
- Regression thresholds should be explicit (e.g., percentile-based), not subjective.

### Cutover readiness
- Cutover requires:
  - Parity validation + snapshot diffs clean.
  - Characterization tests green.
  - Performance within agreed bounds.
  - Rollback plan documented.

## Research options (delta)
No changes to the research options set in `INITIAL.md`. The plan remains anchored on the
**strangler pattern**, with side-by-side Docker deployment for validation.

## Milestones (delta notes)
- **M0:** Ensure the shared `.env` contract is finalized and versioned.
- **M3:** Add an explicit parity checklist per endpoint (inputs, outputs, errors).
- **M5:** Define and rehearse rollback steps (routing + data integrity).

## Validation checkpoints (delta)
- Add **negative test coverage** for invalid inputs and not-found cases for each endpoint.
- Record **payload diffs** in a structured, reviewable format (e.g., JSON diff artifacts).

## Deliverables (delta)
- A parity contract document enumerating response shapes for each endpoint.
- Snapshot artifacts for both success and error cases.
- A cutover/rollback checklist tied to M5.
