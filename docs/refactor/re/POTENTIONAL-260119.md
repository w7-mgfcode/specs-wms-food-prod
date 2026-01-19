# Strategic Assessment: Food Production WMS (Future Roadmap)

**Date:** January 19, 2026  
**Version:** 1.0  
**Status:** DRAFT (For Executive Review)  
**Author:** Senior IT Architect (AI Agent)

---

## Executive Summary

This document provides a comprehensive analysis and strategic roadmap for the `specs-wms-food-prod` project. Moving beyond Phase 3, the system stands at a critical technological inflection point. The successful migration to FastAPI and React 19 establishes a modern baseline, but future scalability (multi-site, IoT integration, AI-driven insights) requires deliberate architectural decisions now to avoid technical debt later.

---

## PHASE 1: ANALYZE

### 1.1 Codebase & Architecture Assessment

**Strengths:**
- **Modern Stack:** React 19 and FastAPI (Python 3.13+) positions the platform well for future AI/ML integrations compared to the legacy Node.js backend.
- **Monorepo Structure:** Centralized documentation and code facilitates easier refactoring and parity checking.
- **Domain Modeling:** The `lot_genealogy` and `qc_gates` models allow for arbitrary depth in traceability, a critical requirement for food safety (mock recall capability).
- **Development Discipline:** High quality of documentation (ADRs, PRPs, Specs) suggests a mature engineering culture.

**Weaknesses & Constraints:**
- **Frontend Heavy Logic:** The "First Flow" logic resides heavily in `useFlowStore.ts` (Zustand). As complexity grows (hundreds of active lots), this state management will become a performance bottleneck on client devices.
- **Type Duplication:** Currently relying on manual synchronization or loose contracts between FastAPI guarantees and Frontend types (per INITIAL-5.md). This creates a "drift risk" surface.
- **Auth Simplicity:** In-memory JWT storage is secure against XSS but potentially frustrating for warehouse operators who may refresh devices frequently; lack of "Offline Mode" is a major risk for factory floors with spotty Wi-Fi.
- **Limited IoT hooks:** The system currently assumes human-entry for most data (weights, temperatures), missing the opportunity for automated capture from scales/sensors.

### 1.2 Technical Debt
- **Supabase Legacy:** `supabase-js` client is still present in frontend code despite the move to a custom FastAPI backend.
- **Testing Gaps:** While backend parity is tested, end-to-end (E2E) testing for critical flows (e.g., "Receive -> QC -> Ship") is manual or minimal.
- **Database Migrations:** Schema is defined in SQLAlchemy models, but robust migration rollback strategies for production data need verification.

---

## PHASE 2: BRAINSTORM

### 2.1 Strategic Directions

**Direction A: The "Connected Factory" (IoT Focus)**
- Shift focus to automated data ingestion.
- Integrate directly with digital scales (RS232/USB-to-WebSerial) and temperature loggers (MQTT).
- **Goal:** Reduce human error to ~0% and increase speed.

**Direction B: The "Resilient Edge" (Offline-First)**
- Re-architect specific frontend modules for offline capability.
- Use Service Workers and local IDB (IndexedDB) to cache active production runs.
- **Goal:** Zero downtime manufacturing, even during internet outages.

**Direction C: The "Intelligent Supervisor" (AI/Data Focus)**
- Leverage Python backend for real-time yield optimization.
- Predictive QC: "Based on raw material temp and supplier A, risk of defect is 80%."
- **Goal:** Higher margins through waste reduction.

### 2.2 Scaling Scenarios
- **Multi-Site Expansion:** How does the DB schema handle "Factory A" vs "Factory B"? Currently implicit or missing.
- **High Volume:** If production lots hit 10k/day, the `traceability` recursive queries (3 levels of JOINs) will need materialized views or graph database offloading.

---

## PHASE 3: RESEARCH

### 3.1 Technology Deep Dive

**1. Reliable Connectivity (Edge Strategy):**
- *Research:* Current React Query v5 supports `persistQueryClient` adapters.
- *Feasibility:* High. Can be added to existing stack without rewrite.
- *Constraint:* Requires backend to handle "eventual consistency" (sync conflicts) if two operators edit the same lot offline.

**2. Type Safety (Codegen):**
- *Research:* `openapi-typescript-codegen` or `orval`.
- *Finding:* Hand-written clients (planned in Phase 4) are flexible but error-prone.
- *Recommendation:* Adopt `orval` for React Query hook generation directly from FastAPI `openapi.json`.

**3. Graph Traceability:**
- *Research:* Recursive CTEs in PostgreSQL (Common Table Expressions) are efficient up to ~5-10 levels.
- *Benchmark:* For deep genealogy (>10 hops), PostgreSQL `ltree` extension or dedicated Graph DB (Neo4j) might be needed.
- *Answer:* For now, recursive CTEs are sufficient for food production (usually <15 processing steps).

### 3.2 Regulatory Compliance (HACCP/FDA/IFS)
- **Electronic Records (21 CFR Part 11):** Requires strict audit trails. `qc_decisions` table is immutable (good), but "updates" to Lot properties need a history table (`lots_history`).
- **Mock Recall Speed:** Regulation often requires retrieving full genealogy < 4 hours. Current indexing strategy needs to verify `lot_genealogy` traversal speed.

---

## PHASE 4: SYNTHESIS

### 4.1 Prioritization Matrix

| Initiative | Business Value | Tech Difficulty | Strategy |
|------------|----------------|-----------------|----------|
| **IoT Integration** | HIGH (Speed/Accuracy) | HIGH (Hardware types) | Validated integration for specific scales only. |
| **Offline Mode** | HIGH (Uptime) | MEDIUM | Critical for factory floor user experience. |
| **Codegen Client** | MEDIUM (Dev Speed) | LOW | Quick win for Phase 4 to prevent bugs. |
| **AI Insights** | MEDIUM (Long term) | HIGH | Postpone until data volume increases. |

### 4.2 Synergies
- **Offline Mode** needs **Codegen types** to ensure the local cache structure matches the server schema perfecty.
- **IoT Integration** feeds the **AI Insights** engine; without reliable sensor data, AI models are garbage-in-garbage-out.

### 4.3 Strategic Decision
We will prioritize **Operational Resilience (Offline/Edge)** as the primary strategic theme for the next 6 months. This aligns with the "food production" reality (damp environments, thick walls, spotty Wi-Fi) and builds upon the robust React/FastAPI foundation.

---

## PHASE 5: SPECIFICATION (FINAL)

### Strategic Initiative: "Resilient Operations" (Next 12-18 Months)

#### Objectives
1. **Zero Data Loss:** No production data lost due to connectivity issues.
2. **Type-Safe Contract:** Automatic synchronization between Backend and Frontend.
3. **Audit-Ready:** Full history of all changes, not just final states.

### Detailed Roadmap

#### **H1 (Next 6 Months): hardening & Integration**

**Milestone 1: Automated Contract (Phase 4 Revision)**
*Instead of manual `client.ts`:*
- **Tooling:** Implement `openapi-typescript` + `tanstack-query` codegen.
- **CI/CD:** Pipeline fails if frontend types don't match backend OpenAPI spec.
- **Value:** Eliminates "schema drift" bugs immediately.

**Milestone 2: Offline Capability (PWA)**
*Enhance Phase 3 UI:*
- **Cache Strategy:** Configure `PersistQueryClient` with IndexedDB.
- **Optimistic Updates:** UI updates immediately; syncs to FastAPI background.
- **Queue System:** "Pending Actions" store in Zustand for requests failed due to network.

**Milestone 3: Audit Log (History)**
*Database Enhancement:*
- **Architecture:** Implement Trigger-based logging in PostgreSQL to a `_audit` schema.
- **Coverage:** Every INSERT/UPDATE/DELETE on `lots`, `qc_decisions`, and `production_runs`.

#### **H2 (Month 6-12): Expansion & Intelligence**

**Milestone 4: Connected Devices (WebSerial)**
*Frontend Feature:*
- Use Browser `navigator.serial` API to read weight directly into FlowLane UI.
- Fallback to manual entry if API unavailable.

**Milestone 5: Multi-Site Schema**
*Backend Refactor:*
- Introduce `site_id` tenant column on all core tables.
- Update RBAC to scope users to specific sites.

### Risk Management

| Risk | Mitigation Strategy |
|------|---------------------|
| **Offline Sync Conflicts** | Implement "Last-Write-Wins" logic for simple fields; "Append-Only" for QC logs to avoid overwrites. |
| **Browser data limits** | Prune IndexedDB cache older than 7 days; force full-sync on logic changes. |
| **Hardware incompatibility** | Standardize on scales that support simple ASCII output over Serial/USB. |

---

### Immediate Action items (Next Sprint)
1. **Update Phase 4 Spec:** Modify `INITIAL-4.md` to include Codegen instead of manual types.
2. **Audit Schema:** Create `lots_history` table design proposal.
3. **PWA Config:** Add `vite-plugin-pwa` to frontend build config.
