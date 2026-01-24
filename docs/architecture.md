# System Architecture

## Overview

Flow-Viz React is a **food production traceability system** designed for manufacturing environments. The system provides real-time visualization of production flows, lot tracking with full genealogy, and quality control gate management.

### Migration Strategy (Phase 1-5) & Schema Alignment (Phase 8)

**Status**: ✅ **Phase 5 Complete** — Security hardening with RBAC and rate limiting
**Status**: 🔄 **Phase 8.1 In Progress** — Schema alignment for production flow execution tracking

Migration from Node/Express + Supabase to **FastAPI** using the **strangler pattern**:

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1** | ✅ Complete | FastAPI backend scaffold, characterization tests |
| **Phase 2** | ✅ Complete | Core API endpoints (lots, runs, QC, auth, traceability) |
| **Phase 3** | ✅ Complete | First Flow lane-based UI with buffer visualization |
| **Phase 4** | ✅ Complete | Frontend-FastAPI integration, API client layer, TanStack Query |
| **Phase 5** | ✅ Complete | Security hardening: RBAC, rate limiting, enhanced JWT |
| **Phase 8.1** | 🔄 In Progress | Schema alignment: step tracking, lot status lifecycle, flow version governance |
| **Phase 6** | 🔄 Planned | Secrets management, infrastructure hardening, monitoring |

**Phase 8.1 Achievements** (Schema Alignment):
- ✅ **Lot Status Lifecycle**: 7-state status enum (CREATED, QUARANTINE, RELEASED, HOLD, REJECTED, CONSUMED, FINISHED)
- ✅ **Step Index Tracking**: Canonical 11-step production flow (0-10) on lots and production runs
- ✅ **RunStepExecution Model**: Granular tracking of execution status per step (PENDING, IN_PROGRESS, COMPLETED, SKIPPED)
- ✅ **Extended LotType Enum**: SKU-specific types (SKW15, SKW30, FRZ15, FRZ30, FG15, FG30) + PAL, SHIP
- ✅ **Flow Version Governance**: REVIEW status + reviewed_by column for approval workflow
- ✅ **Enhanced RunStatus**: New states (IDLE, RUNNING, HOLD, COMPLETED, ABORTED, ARCHIVED) with migration from legacy values
- ✅ **Production Run Audit Trail**: started_by column, idempotency_key for duplicate prevention, completed_at timestamp
- ✅ **Flow Version Immutability**: Database trigger protecting published versions from accidental modification
- ✅ **5 Database migrations** with comprehensive schema validation and backward-compatible downgrades

**Phase 5 Achievements** (Security Hardening):
- ✅ Role-Based Access Control (RBAC) with FastAPI dependency injection
- ✅ Rate limiting with SlowAPI + Valkey (10/min login, 100-200/min endpoints)
- ✅ Enhanced JWT tokens with role claims for efficient authorization
- ✅ Comprehensive test coverage (487-line RBAC + 131-line rate limiting suites)
- ✅ ADR-0003 documenting RBAC design decisions
- ✅ 100% backward compatibility with existing frontend

**Phase 4 Achievements**:
- ✅ Hybrid API client with generated types and handwritten wrapper
- ✅ TanStack Query v5 for server state management
- ✅ JWT tokens in memory (XSS protection)
- ✅ React Error Boundary with global 401/403 handlers
- ✅ Environment-driven CORS configuration
- ✅ Vite proxy to FastAPI (port 8000)
- ❌ Node/Express (port 3000) and Supabase BaaS deprecated

---

## High-Level Architecture

```
+-------------------------------------------------------------------------+
|                              CLIENT LAYER                                |
|  +--------------------------------------------------------------------+ |
|  |                     React 19 + TypeScript                          | |
|  |  +-----------+ +-----------+ +-----------+ +---------------------+ | |
|  |  | Dashboard | |  Command  | | Validator | |     First Flow      | | |
|  |  |   (V1)    | |  Center   | |   (V3)    | |       (V4)          | | |
|  |  |           | |   (V2)    | |           | |                     | | |
|  |  |- FlowCanvas| |- Lot Forms| |- Audit Log| |- BufferLane (x4)    | | |
|  |  |- Phases   | |- QC Gates | |- Trace    | |- LotCard            | | |
|  |  |- Alerts   | |- Prod Ctrl| |- Reports  | |- GateStepper (7)    | | |
|  |  +-----------+ +-----------+ +-----------+ +---------------------+ | |
|  +--------------------------------------------------------------------+ |
|                                    |                                     |
|                    +---------------+---------------+                    |
|                    |    STATE MANAGEMENT (Phase 4) |                    |
|                    |  +------------+ +------------+|                    |
|                    |  |  Zustand   | | TanStack   ||                    |
|                    |  | (UI State) | |   Query    ||                    |
|                    |  |            | | (Server)   ||                    |
|                    |  | - Auth     | | - Lots     ||                    |
|                    |  | - Toast    | | - QC       ||                    |
|                    |  | - Flow UI  | | - Trace    ||                    |
|                    |  +------------+ +------------+|                    |
|                    +-------------------------------+                    |
|                                    |                                     |
|                    +---------------+---------------+                    |
|                    |    API CLIENT LAYER (Phase 4) |                    |
|                    |  +---------------------------+|                    |
|                    |  | client.ts                 ||                    |
|                    |  | - JWT injection (memory)  ||                    |
|                    |  | - Error handling          ||                    |
|                    |  | - 401 → redirect          ||                    |
|                    |  | - 403 → toast             ||                    |
|                    |  | - 5xx → error boundary    ||                    |
|                    |  +---------------------------+|                    |
|                    +-------------------------------+                    |
|  +--------------------------------------------------------------------+ |
|  |                    ErrorBoundary (Phase 4)                         | |
|  |  - React Error Boundary + TanStack Query integration               | |
|  +--------------------------------------------------------------------+ |
+-------------------------------------------------------------------------+
                                     |
                                     | Vite Proxy (/api → :8000)
                                     v
+-------------------------------------------------------------------------+
|                              API LAYER                                   |
|  +------------------------------------------------------------------+  |
|  |                    FastAPI (Port 8000)                           |  |
|  |  +------------------------------------------------------------+  |  |
|  |  | Endpoints (RBAC Protected - Phase 5)                       |  |  |
|  |  | - /api/v1/lots        - /api/v1/runs                       |  |  |
|  |  | - /api/v1/qc-gates    - /api/v1/auth                       |  |  |
|  |  | - /api/v1/traceability - /api/health                       |  |  |
|  |  +------------------------------------------------------------+  |  |
|  |  +------------------------------------------------------------+  |  |
|  |  | Middleware (Phase 4-5)                                     |  |  |
|  |  | - CORS (env-driven origins)                                |  |  |
|  |  | - JWT Authentication (role claims - Phase 5)               |  |  |
|  |  | - Rate Limiting (SlowAPI + Valkey - Phase 5)               |  |  |
|  |  | - Request Validation (Pydantic)                            |  |  |
|  |  +------------------------------------------------------------+  |  |
|  |  +------------------------------------------------------------+  |  |
|  |  | Components                                                 |  |  |
|  |  | - RBAC Dependencies (require_roles - Phase 5)              |  |  |
|  |  | - Pydantic Schemas (request/response validation)           |  |  |
|  |  | - SQLAlchemy Models (async ORM)                            |  |  |
|  |  | - Celery Tasks (background jobs)                           |  |  |
|  |  | - Services (business logic)                                |  |  |
|  |  +------------------------------------------------------------+  |  |
|  +------------------------------------------------------------------+  |
|                                                                         |
|  +------------------------------------------------------------------+  |
|  |           DEPRECATED (Phase 4)                                   |  |
|  |  - Node/Express (Port 3000) - removed                            |  |
|  |  - Supabase BaaS - replaced by FastAPI auth                      |  |
|  +------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                            DATA LAYER                                    |
|  +--------------------------+    +----------------------------------+   |
|  |     PostgreSQL 17        |    |         Valkey 8.1+              |   |
|  |                          |    |         (Redis OSS)              |   |
|  |  +--------------------+  |    |  +----------------------------+  |   |
|  |  | production_runs    |  |    |  | Session Cache              |  |   |
|  |  | lots               |  |    |  | Celery Task Queue          |  |   |
|  |  | lot_genealogy      |  |    |  | Rate Limiting              |  |   |
|  |  | qc_decisions       |  |    |  | Temporary Lot State        |  |   |
|  |  | qc_gates           |  |    |  +----------------------------+  |   |
|  |  | users / roles      |  |    |                                  |   |
|  |  +--------------------+  |    +----------------------------------+   |
|  +--------------------------+                                           |
+-------------------------------------------------------------------------+
```

---

## Core Components

### Frontend (React 19)

| Component | Purpose |
|-----------|---------|
| **FlowVizV1 (Dashboard)** | Real-time production flow visualization with phase navigation |
| **FlowVizV2 (Command Center)** | Operator interface for lot registration, QC decisions |
| **FlowVizV3 (Validator)** | Audit log and traceability graph for compliance |
| **FirstFlowPage (V4)** | Lane-based buffer visualization with QC gate progression (NEW) |
| **Presentation** | Demo/presentation mode for stakeholders |

### State Management (Phase 4: Zustand + TanStack Query)

**Architecture**: Clear separation between UI state and server state

#### Zustand Stores (UI State Only)

| Store | Responsibility |
|-------|----------------|
| `useAuthStore` | Authentication state, user session, role, **JWT token (memory)** |
| `useProductionStore` | Active run UI state, phase navigation |
| `useFlowStore` | Buffer lanes UI, QC gate progression for First Flow (V4) |
| `useUIStore` | Language, theme, navigation state |
| `useToastStore` | Notifications and alerts |

**Key Principle**: Zustand stores **never** hold server data. They only manage UI state, user preferences, and transient application state.

#### TanStack Query (Server State Only) - NEW in Phase 4

| Hook | Responsibility |
|------|----------------|
| `useLots` | Lot creation mutations with automatic cache invalidation |
| `useQC` | QC decision mutations |
| `useTraceability` | Traceability graph queries with lot code parameter |

**Features**:
- ✅ Automatic caching with 30s stale time
- ✅ Smart retry logic (no retry on 4xx, up to 2 retries on 5xx)
- ✅ Request deduplication
- ✅ Optimistic updates
- ✅ Global error handling via `queryClient.ts`

**Query Key Factories**:
```typescript
export const queryKeys = {
  lots: {
    all: ['lots'] as const,
    lists: () => [...queryKeys.lots.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.lots.all, 'detail', id] as const,
  },
  qc: {
    all: ['qc-decisions'] as const,
    byLot: (lotId: string) => [...queryKeys.qc.all, 'lot', lotId] as const,
  },
  traceability: {
    all: ['traceability'] as const,
    lot: (lotCode: string) => [...queryKeys.traceability.all, lotCode] as const,
  },
} as const;
```

### API Client Layer (Phase 4) - NEW

**Pattern**: Hybrid approach with generated types and handwritten fetch wrapper

| Component | Purpose |
|-----------|---------|
| **client.ts** | Base fetch wrapper with JWT injection, error handling, 401/403 logic |
| **types.ts** | TypeScript interfaces matching Pydantic schemas |
| **auth.ts** | Login function returning JWT token |
| **lots.ts** | Lot creation operations |
| **qc.ts** | QC decision operations |
| **traceability.ts** | Traceability graph queries |

**Key Features**:

1. **JWT Token Management** (XSS Protection):
   - Tokens stored in **memory** (module closure)
   - Never in `localStorage` or `sessionStorage`
   - Cleared on 401 response
   - Lost on page refresh (acceptable tradeoff)

2. **Global Error Handlers**:
   - **401 Unauthorized**: Clear token + redirect to `/login`
   - **403 Forbidden**: Show toast notification, don't disrupt view
   - **5xx Server Error**: Throw error for ErrorBoundary to catch

3. **Custom Error Class**:
   ```typescript
   export class ApiClientError extends Error {
     constructor(
       public readonly status: number,
       public readonly detail: string,
       public readonly body?: unknown
     ) { ... }

     isAuthError(): boolean { return this.status === 401; }
     isPermissionError(): boolean { return this.status === 403; }
     isServerError(): boolean { return this.status >= 500; }
   }
   ```

4. **Type Generation**:
   - Script: `npm run generate:api`
   - Generates types from FastAPI OpenAPI schema
   - Optional (can use handwritten types in `types.ts`)

### Backend (FastAPI) - Phases 1-5

| Component | Purpose |
|-----------|---------|
| **Routes** | `/api/v1/*` endpoints for lots, runs, QC, auth, traceability (RBAC protected - Phase 5) |
| **RBAC Dependencies** | `require_roles()` factory + role-specific type aliases (Phase 5) |
| **Rate Limiting** | SlowAPI limiter with Valkey backend (Phase 5) |
| **Models** | SQLAlchemy 2.0 async models for all domain entities |
| **Schemas** | Pydantic 2.11+ schemas for request/response validation |
| **Services** | Business logic layer (lot service, QC service, etc.) |
| **Tasks** | Celery background tasks for batch operations |
| **Middleware** | CORS (env-driven), JWT auth (role claims - Phase 5), rate limiting (Phase 5) |

### Database Schema

```
+---------------+     +----------------+     +-----------------+
|   scenarios   |<----|    streams     |     |    qc_gates     |
|               |     |                |     |                 |
| - id          |     | - stream_key   |     | - gate_type     |
| - name        |     | - color        |     | - is_ccp        |
| - version     |     | - sort_order   |     | - checklist     |
+---------------+     +----------------+     +-----------------+
       |                    |                    |
       |                    +--------+-----------+
       v                             |
+---------------+            +-------------------+
|    phases     |            |production_runs(p8)|
|               |            |                   |
| - phase_num   |            | - run_code        |
| - name        |            | - status(p8.1)    |
| - stream_id   |            | - flow_version_id |
+---------------+            | - current_step(p8)|
       |                      | - started_by(p8)  |
       +----------+-----------+ - completed_at(p8)|
                  |             - idempotency_key |
                  v             +-------------------+
           +-------------------+          |
           |   lots (Phase 8.1)|          |
           |                   |          |
           | - lot_code        |          +--------+
           | - lot_type(ext)   |                   |
           | - weight_kg       |    +------------+------+
           | - temp_c          |    |run_step_exec(p8.1)|
           | - step_index(p8)  |    |                   |
           | - status(p8.1)    |    | - run_id          |
           +-------------------+    | - step_index      |
                  |                 | - node_id         |
                  |<----------------| - status          |
                  |                 | - operator_id     |
                  |                 +-------------------+
                  |
                  +--------+
                           |
                  +--------v--------+
                  | lot_genealogy   |
                  | (parent -> child)|
                  +--------+--------+
                           |
                  +--------v--------+
                  | qc_decisions    |
                  |                 |
                  | - decision      |
                  | - notes         |
                  | - timestamp     |
                  +-----------------+

Flow Definitions (Phase 8.1 governance):
+------------------+     +------------------+
| flow_definitions |<----| flow_versions(p8)|
|                  |     |                  |
| - id             |     | - version_num    |
| - name           |     | - status(p8.1)   |
| - created_by     |     | - graph_schema   |
|                  |     | - reviewed_by(p8)|
+------------------+     | - published_by   |
                         +------------------+

Legend:
(p8)   = Phase 8.1 addition
(p8.1) = Phase 8.1 addition
(ext)  = Extended enum values
```

---

## Data Flow

### Production Run Lifecycle (Phase 8.1 Enhanced)

```
1. START RUN (Phase 8.1)
   +-> Create production_run record with status = IDLE
   +-> Assign flow_version (immutable, pinned at creation)
   +-> Set started_by user for audit trail
   +-> Generate idempotency_key for duplicate prevention
   +-> Initialize current_step_index to 0
   +-> Create 11 RunStepExecution records (indices 0-10, status = PENDING)

2. STEP PROGRESSION (Phase 8.1)
   +-> Advance current_step_index (0 → 10)
   +-> Update corresponding RunStepExecution status
   +-> Transition run status: IDLE → RUNNING
   +-> Operator assigned to step execution for audit

3. LOT REGISTRATION (Phase 8.1)
   +-> Create lot record with type, weight, temp
   +-> Assign step_index (0-10) reflecting current production step
   +-> Set status = CREATED (immutable audit trail)
   +-> Link parent lots via lot_genealogy
   +-> Associate with current phase and run

4. LOT STATUS TRANSITIONS (Phase 8.1)
   +-> CREATED → QUARANTINE (pending QC/testing)
   +-> QUARANTINE → RELEASED (QC approved)
   +-> RELEASED → CONSUMED (used in downstream processing)
   +-> Any → HOLD (blocking issue detected)
   +-> HOLD/QUARANTINE → REJECTED (failed criteria)
   +-> CONSUMED → FINISHED (production complete)

5. QC DECISION (Phase 8.1)
   +-> Record PASS/HOLD/FAIL at gate
   +-> Trigger lot status transition (RELEASED on PASS, HOLD on HOLD)
   +-> Trigger alerts for HOLD/FAIL
   +-> Block progression if blocking gate

6. END RUN (Phase 8.1)
   +-> Mark all RunStepExecutions with status != COMPLETED as SKIPPED
   +-> Generate summary statistics
   +-> Transition status: RUNNING → COMPLETED
   +-> Set completed_at timestamp
   +-> Display summary modal with step execution details
```

## Phase 8.1 Schema Details

### Lot Type Enumeration (Extended)

Phase 8.1 extends LotType to support SKU-specific variants and shipment tracking:

```python
class LotType(str, enum.Enum):
    RAW = "RAW"      # Raw material receipt
    DEB = "DEB"      # Deboned meat
    BULK = "BULK"    # Bulk buffer
    MIX = "MIX"      # Mixed batch
    # Legacy (backward compatible)
    SKW = "SKW"      # Skewered rod (legacy, any size)
    FRZ = "FRZ"      # Frozen (legacy, any size)
    FG = "FG"        # Finished goods (legacy, any size)
    # Phase 8.1: SKU-specific variants
    SKW15 = "SKW15"  # 15g skewer rod
    SKW30 = "SKW30"  # 30g skewer rod
    FRZ15 = "FRZ15"  # Frozen 15g
    FRZ30 = "FRZ30"  # Frozen 30g
    FG15 = "FG15"    # Finished goods 15g
    FG30 = "FG30"    # Finished goods 30g
    # Packaging & Shipping
    PAL = "PAL"      # Pallet
    SHIP = "SHIP"    # Shipment
```

### Lot Status Lifecycle (Phase 8.1)

| Status | Description | Allowed Transitions |
|--------|-------------|-------------------|
| `CREATED` | Initial state, lot just registered | QUARANTINE, HOLD |
| `QUARANTINE` | Awaiting QC testing/approval | RELEASED, REJECTED, HOLD |
| `RELEASED` | QC approved, ready for use | CONSUMED, HOLD, REJECTED |
| `CONSUMED` | Used in downstream processing | FINISHED |
| `HOLD` | Blocked pending investigation | RELEASED, REJECTED (after resolution) |
| `REJECTED` | Failed QC or quality gates | (terminal, no transitions) |
| `FINISHED` | Production complete | (terminal, no transitions) |

**Audit Trail**: All status transitions are append-only logged to `lot_status_history` (future phase).

### Production Run Status Lifecycle (Phase 8.1)

Phase 8.1 replaces legacy status (ACTIVE, CANCELLED) with new states:

| Status | Description | Valid Transitions |
|--------|-------------|-------------------|
| `IDLE` | Created but not yet started | RUNNING, ABORTED |
| `RUNNING` | Active execution in progress | COMPLETED, HOLD, ABORTED |
| `HOLD` | Paused due to issue (CCP gate failure, supply shortage) | RUNNING, ABORTED |
| `COMPLETED` | Successfully finished all steps | ARCHIVED |
| `ABORTED` | Terminated early (operator cancellation, critical error) | (terminal) |
| `ARCHIVED` | Historical record (removed from active views) | (terminal) |

**Migration**: Phase 8.1 alembic migration converts:
- `ACTIVE` → `RUNNING`
- `CANCELLED` → `ABORTED`

### Flow Version Status & Governance (Phase 8.1)

| Status | Description | Allowed Transitions | Immutability |
|--------|-------------|-------------------|-------------|
| `DRAFT` | Work in progress | REVIEW, DEPRECATED | Fully mutable |
| `REVIEW` | Pending approval (new in Phase 8.1) | PUBLISHED, DEPRECATED | Mutable (review notes only) |
| `PUBLISHED` | Active production version | DEPRECATED | **IMMUTABLE** (database trigger enforces) |
| `DEPRECATED` | Replaced by newer version | (terminal) | N/A |

**Governance Workflow (Phase 8.1)**:
1. Designer creates flow in DRAFT status
2. Designer requests review → transitions to REVIEW
3. Reviewer examines flow → adds reviewed_by audit trail
4. Reviewer approves → transitions to PUBLISHED
5. Published versions are protected from modification (trigger blocks UPDATE on graph_schema)
6. When superseded, status → DEPRECATED (non-blocking status change allowed)

### RunStepExecution Model (Phase 8.1)

Each production run creates 11 step execution records (one per canonical step 0-10):

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `run_id` | UUID | FK to production_runs.id |
| `step_index` | Integer | Position in 11-step flow (0-10) |
| `node_id` | String | Flow node ID (e.g., "node-3") for visual correlation |
| `status` | String | PENDING → IN_PROGRESS → COMPLETED (or SKIPPED) |
| `started_at` | Timestamp | When operator began this step |
| `completed_at` | Timestamp | When operator finished this step |
| `operator_id` | UUID | Which operator executed this step (audit trail) |
| `created_at` | Timestamp | Record creation time |

**Status Enum (StepExecutionStatus)**:
- `PENDING`: Not yet started
- `IN_PROGRESS`: Currently being executed
- `COMPLETED`: Finished successfully
- `SKIPPED`: Step was bypassed (marked when run ends early)

### Role Permissions Updated (Phase 8.1)

No new roles introduced, but permissions matrix refined:

| Operation | ADMIN | MANAGER | OPERATOR | AUDITOR | VIEWER |
|-----------|:-----:|:-------:|:--------:|:-------:|:------:|
| Create production run | ✓ | ✓ | ✓ | - | - |
| Advance step (current_step_index) | ✓ | ✓ | ✓ | - | - |
| Update lot status | ✓ | ✓ | ✓ | - | - |
| Approve flow version (REVIEW → PUBLISHED) | ✓ | ✓ | - | - | - |
| View run step executions | ✓ | ✓ | ✓ | ✓ | - |
| View lot status history | ✓ | ✓ | ✓ | ✓ | ✓ |

---

### Role-Based Access Control (Phase 5 - RBAC Enforcement)

**Implementation**: FastAPI dependency injection with `require_roles()` factory

| Role | Dashboard | Command | Validator | First Flow | Admin | API Permissions |
|------|:---------:|:-------:|:---------:|:----------:|:-----:|-----------------|
| VIEWER | View | - | - | View | - | GET only (traceability, lots) |
| OPERATOR | View | Interact | - | Interact | - | GET + POST (lots, QC decisions) |
| MANAGER | View | Interact | View | Interact | - | GET + POST (lots, QC decisions) |
| AUDITOR | View | - | View | View | - | GET + POST (QC decisions only) |
| ADMIN | View | Interact | View | Interact | Full | Full access (all endpoints) |

**RBAC Type Aliases** (Phase 5):
- `AdminOnly` — ADMIN role only
- `AdminOrManager` — ADMIN or MANAGER roles
- `CanCreateLots` — ADMIN, MANAGER, or OPERATOR roles
- `CanMakeQCDecisions` — ADMIN, MANAGER, AUDITOR, or OPERATOR roles
- `AllAuthenticated` — Any authenticated user (all 5 roles)

**Rate Limits** (Phase 5):
- Login: `10/minute` (brute-force protection)
- Lots (GET): `200/minute`
- Lots (POST): `100/minute` (normal factory throughput)
- QC Decisions: `100/minute`
- Traceability: `200/minute`
- Health: `200/minute`

---

## Technology Stack

### Frontend (Phase 4 Updated)
- **React 19** — UI framework
- **TypeScript 5.7** — Type safety
- **React Router v7** — Routing
- **Zustand 5** — UI state management
- **TanStack Query v5** — Server state management (NEW in Phase 4)
- **react-error-boundary** — Error boundary component (NEW in Phase 4)
- **Tailwind CSS** — Styling
- **Vite 6** — Build tool with proxy to FastAPI
- **Zod 4.x** — Schema validation (frontend)

### Backend (FastAPI - Phases 1-5)
- **Python 3.13+** — Runtime
- **FastAPI ≥0.125** — Web framework
- **SQLAlchemy 2.0.x** — Async ORM
- **Pydantic 2.11+** — Validation (backend)
- **Alembic 1.14+** — Database migrations
- **Celery 5.4+** — Task queue
- **Valkey 8.1+** — Caching + rate limiting storage (Redis OSS fork)
- **SlowAPI ≥0.1.9** — Rate limiting middleware (Phase 5)
- **python-jose** — JWT token handling (Phase 4-5)
- **bcrypt** — Password hashing
- **email-validator** — Email validation

### Backend (DEPRECATED - Phase 4)
- ❌ **Express.js** — API server (removed)
- ❌ **Supabase** — BaaS for auth/realtime (replaced by FastAPI auth)

### Database
- **PostgreSQL 17** — Primary database
- **Row Level Security** — Data access control (optional)

### Infrastructure
- **Docker** — Containerization
- **Docker Compose** — Local development
- **DevContainer** — VS Code development
- **Nginx** — Static file serving (production)
- **GitHub Actions** — CI/CD (6 workflows)

---

## Deployment Architecture

### Docker Compose (Development)

```yaml
services:
  postgres:    # PostgreSQL 17
  valkey:      # Valkey 8.1+ (Redis alternative)
  api:         # FastAPI backend (:8000)
  api-legacy:  # Express.js backend (:3001)
  web:         # Nginx + React app
  celery:      # Celery worker
```

### Production Architecture

```
+------------------+     +------------------+     +------------------+
|   CDN / Edge     |---->|   Load Balancer  |---->|   FastAPI (x3)   |
|   (Static SPA)   |     |   (nginx)        |     |   Containers     |
+------------------+     +------------------+     +------------------+
                                                           |
                                                           v
                                   +------------------+    +------------------+
                                   |   PostgreSQL 17  |    |   Valkey 8.1+    |
                                   |   (Primary +     |    |   (Cache +       |
                                   |    Replica)      |    |    Task Queue)   |
                                   +------------------+    +------------------+
```

---

## Security Considerations

### Phase 5 Security Enhancements (RBAC & Rate Limiting)

1. **Role-Based Access Control (RBAC)**:
   - ✅ FastAPI dependency injection with `require_roles()` factory
   - ✅ 5-tier role permissions (ADMIN, MANAGER, AUDITOR, OPERATOR, VIEWER)
   - ✅ Type-safe role aliases (`CanCreateLots`, `CanMakeQCDecisions`, etc.)
   - ✅ 403 responses with `X-Required-Roles` header for debugging
   - ✅ Comprehensive test coverage (487-line RBAC test suite)
   - ✅ ADR-0003 documenting design decisions

2. **Rate Limiting** (Brute-Force Prevention):
   - ✅ SlowAPI middleware with Valkey backend
   - ✅ Per-endpoint limits (10/min login, 100-200/min API endpoints)
   - ✅ Fixed-window strategy with distributed storage
   - ✅ Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)
   - ✅ 429 responses with `Retry-After` header
   - ✅ Comprehensive test coverage (131-line rate limiting test suite)

3. **Enhanced JWT Tokens**:
   - ✅ Role claims embedded in token payload for efficient authorization
   - ✅ No database lookup required for role validation
   - ✅ Backward compatible with Phase 4 frontend
   - ✅ Token payload: `{"sub": "user-id", "role": "OPERATOR", "exp": 1234567890}`

### Phase 4 Security Enhancements

4. **JWT Token Management** (XSS Protection):
   - ✅ Tokens stored in **memory** (module closure in `client.ts`)
   - ✅ Never in `localStorage` or `sessionStorage` (vulnerable to XSS)
   - ✅ Cleared on 401 response
   - ✅ Lost on page refresh (acceptable tradeoff)
   - ⏳ Future: Refresh tokens with HttpOnly cookies (Phase 6)

5. **CORS Configuration** (Environment-Driven):
   - ✅ Explicit origin list (not `["*"]`)
   - ✅ `allow_credentials=True` requires explicit origins
   - ✅ Environment-driven via `ALLOWED_ORIGINS` env var
   - ✅ Development: `http://localhost:5173,http://localhost:3000`
   - ✅ Production: `https://flowviz.example.com`

6. **Error Handling** (Security-Aware):
   - ✅ 401 → Automatic redirect to `/login` (no sensitive data exposed)
   - ✅ 403 → Toast notification (no stack traces)
   - ✅ 5xx → Generic error message (no internal details leaked)
   - ✅ Error boundaries prevent app crashes

### General Security Practices

7. **Authentication** — JWT tokens with bcrypt password hashing

8. **Authorization** — Role-based access control (RBAC) with FastAPI dependencies (Phase 5)

9. **Row Level Security** — Database-level access policies (optional)

10. **API Security** — Rate limiting (Phase 5), CORS, input validation

11. **Data Validation** — Pydantic schemas (backend), Zod schemas (frontend)

12. **Secrets Management** — Environment variables, never committed (Phase 6: AWS Secrets Manager)

### Security Best Practices

| Practice | Implementation |
|----------|----------------|
| **RBAC** | FastAPI dependency injection (Phase 5) |
| **Rate Limiting** | SlowAPI + Valkey (Phase 5) |
| **Token Storage** | Memory (module closure), not localStorage |
| **JWT Claims** | Role embedded for efficient authorization (Phase 5) |
| **CORS** | Env-driven explicit origins |
| **Password Hashing** | bcrypt with salt rounds |
| **JWT Expiry** | 30 minutes (configurable) |
| **HTTPS** | Required in production |
| **Input Validation** | Pydantic (backend) + Zod (frontend) |
| **SQL Injection** | SQLAlchemy parameterized queries |
| **XSS Protection** | React auto-escaping + CSP headers |
| **Brute-Force Prevention** | 10/min login rate limit (Phase 5) |

---

## API Versioning

The FastAPI backend uses URL-based versioning:

```
/api/v1/lots          # Current stable API
/api/v1/runs
/api/v1/qc-gates
/api/v1/traceability
/api/v1/auth
/api/health           # Health check endpoint
```

**Phase 4 Changes**:
- ✅ Frontend now uses `/api/v1/*` endpoints exclusively
- ✅ Vite proxy forwards `/api` to `http://localhost:8000`
- ❌ Legacy Node/Express endpoints removed
- ❌ Supabase BaaS endpoints deprecated

**Type Generation**:
```bash
# Generate TypeScript types from OpenAPI schema
npm run generate:api

# Output: src/lib/api/schema.d.ts
```

---

## Related Documentation

### Phase Documentation
- [Phase 1 Backend Summary](phase/phase-1_backend.md) — FastAPI backend scaffold
- [Phase 2 API Backend Summary](phase/phase-2_api-backend.md) — Core API endpoints
- [Phase 3 First Flow Summary](phase/phase-3_first-flow.md) — Lane-based UI
- [Phase 4 Frontend-FastAPI Integration](phase/phase-4_frontend-fastapi-integration.md)
- [Phase 5 Security Hardening](phase/phase-5_security-hardening-rbac-ratelimit.md)
- [Phase 8.1 Schema Alignment](phase/phase-8_schema-alignment.md) — **NEW** ✨ (Step tracking, lot status lifecycle, flow governance)

### Technical Documentation
- [ENVIRONMENT.md](ENVIRONMENT.md) — Environment variables
- [RUNBOOK.md](RUNBOOK.md) — Error scenarios and recovery
- [CLAUDE.md - AI Coding Guide](../CLAUDE.md)
- [Architecture Decision Records](decisions/)
  - [ADR-0003: RBAC Enforcement](decisions/0003-rbac-enforcement.md) — **NEW** ✨ (Phase 5)

### Code Documentation
- [Database Migrations](../backend/alembic/) — **UPDATED** Phase 8.1 (5 new migrations)
  - [20260124_phase81_01: Lot step_index and status](../backend/alembic/versions/20260124_phase81_01_add_lot_step_index_status.py)
  - [20260124_phase81_02: Flow version governance](../backend/alembic/versions/20260124_phase81_02_enhance_flow_version_status.py)
  - [20260124_phase81_03: Production run enhancements](../backend/alembic/versions/20260124_phase81_03_enhance_production_runs.py)
  - [20260124_phase81_04: RunStepExecution model](../backend/alembic/versions/20260124_phase81_04_add_run_step_executions.py)
  - [20260124_phase81_05: Flow version immutability](../backend/alembic/versions/20260124_phase81_05_add_flow_version_immutability_trigger.py)
- [API Tests](../backend/tests/)
  - [RBAC Test Suite](../backend/tests/test_rbac.py) (Phase 5)
  - [Rate Limiting Tests](../backend/tests/test_rate_limiting.py) (Phase 5)
- [Backend Models](../backend/app/models/) — **UPDATED** Phase 8.1
  - [lot.py](../backend/app/models/lot.py) — LotType (extended), LotStatus (new), Lot model (step_index, status)
  - [production.py](../backend/app/models/production.py) — RunStatus (updated), ProductionRun (enhanced)
  - [run.py](../backend/app/models/run.py) — **NEW** RunStepExecution model
  - [flow.py](../backend/app/models/flow.py) — FlowVersionStatus (REVIEW, DEPRECATED), reviewed_by column
  - [user.py](../backend/app/models/user.py) — New relationship fields (flow_versions_reviewed, step_executions)
- [Frontend Types](../flow-viz-react/src/types/)
- [Flow Types](../flow-viz-react/src/types/flow.ts)
- [API Client](../flow-viz-react/src/lib/api/)
- [Query Hooks](../flow-viz-react/src/hooks/)
- [RBAC Dependencies](../backend/app/api/deps.py) (Phase 5)
- [Rate Limiter Config](../backend/app/rate_limit.py) (Phase 5)

### PRPs (Pydantic AI Agent Templates)
- [Phase 5 Security Hardening PRP](../PRPs/phase5-security-hardening-rbac-ratelimit.md) - **NEW** ✨
- [Phase 4 Frontend-FastAPI Integration PRP](../PRPs/phase4-frontend-fastapi-integration.md)
- [Phase 4 Security & Error Handling PRP](../PRPs/phase4-security-error-handling.md)
