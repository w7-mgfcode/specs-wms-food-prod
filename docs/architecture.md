# System Architecture

## Overview

Flow-Viz React is a **food production traceability system** designed for manufacturing environments. The system provides real-time visualization of production flows, lot tracking with full genealogy, and quality control gate management.

### Migration Strategy (Phase 1-4)

**Status**: ✅ **Phase 4 Complete** — Frontend fully integrated with FastAPI backend

Migration from Node/Express + Supabase to **FastAPI** using the **strangler pattern**:

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1** | ✅ Complete | FastAPI backend scaffold, characterization tests |
| **Phase 2** | ✅ Complete | Core API endpoints (lots, runs, QC, auth, traceability) |
| **Phase 3** | ✅ Complete | First Flow lane-based UI with buffer visualization |
| **Phase 4** | ✅ Complete | Frontend-FastAPI integration, API client layer, TanStack Query |
| **Phase 5** | 🔄 Planned | Component migration, refresh tokens, offline support |

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
|  |  | Endpoints                                                  |  |  |
|  |  | - /api/v1/lots        - /api/v1/runs                       |  |  |
|  |  | - /api/v1/qc-gates    - /api/v1/auth                       |  |  |
|  |  | - /api/v1/traceability - /api/health                       |  |  |
|  |  +------------------------------------------------------------+  |  |
|  |  +------------------------------------------------------------+  |  |
|  |  | Middleware (Phase 4)                                       |  |  |
|  |  | - CORS (env-driven origins)                                |  |  |
|  |  | - JWT Authentication                                       |  |  |
|  |  | - Request Validation (Pydantic)                            |  |  |
|  |  +------------------------------------------------------------+  |  |
|  |  +------------------------------------------------------------+  |  |
|  |  | Components                                                 |  |  |
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

### Backend (FastAPI) - Phases 1-4

| Component | Purpose |
|-----------|---------|
| **Routes** | `/api/v1/*` endpoints for lots, runs, QC, auth, traceability |
| **Models** | SQLAlchemy 2.0 async models for all domain entities |
| **Schemas** | Pydantic 2.11+ schemas for request/response validation |
| **Services** | Business logic layer (lot service, QC service, etc.) |
| **Tasks** | Celery background tasks for batch operations |
| **Middleware** | CORS (env-driven), JWT auth, request validation (Phase 4) |

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
+---------------+            +---------------+
|    phases     |            |production_run |
|               |            |               |
| - phase_num   |            | - run_code    |
| - name        |            | - status      |
| - stream_id   |            | - operator_id |
+---------------+            +---------------+
       |                             |
       +-------------+---------------+
                     |
                     v
              +---------------+
              |     lots      |
              |               |<------------------+
              | - lot_code    |                   |
              | - lot_type    |     +-------------+-----+
              | - weight_kg   |     | lot_genealogy     |
              | - temp_c      |     | (parent -> child) |
              +---------------+     +-------------------+
                     |
                     v
              +---------------+
              | qc_decisions  |
              |               |
              | - decision    |
              | - notes       |
              | - timestamp   |
              +---------------+
```

---

## Data Flow

### Production Run Lifecycle

```
1. START RUN
   +-> Create production_run record
   +-> Initialize phase to 0

2. PHASE PROGRESSION
   +-> Operator advances phases
   +-> Auto-registration creates lots (if enabled)
   +-> QC gates trigger decisions

3. LOT REGISTRATION
   +-> Create lot record with type, weight, temp
   +-> Link parent lots via lot_genealogy
   +-> Associate with current phase

4. QC DECISION
   +-> Record PASS/HOLD/FAIL at gate
   +-> Trigger alerts for HOLD/FAIL
   +-> Block progression if blocking gate

5. END RUN
   +-> Generate summary statistics
   +-> Mark run as COMPLETED
   +-> Display summary modal
```

### Role-Based Access Control

| Role | Dashboard | Command | Validator | First Flow | Admin |
|------|:---------:|:-------:|:---------:|:----------:|:-----:|
| VIEWER | View | - | - | View | - |
| OPERATOR | View | Interact | - | Interact | - |
| MANAGER | View | Interact | View | Interact | - |
| AUDITOR | View | - | View | View | - |
| ADMIN | View | Interact | View | Interact | Full |

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

### Backend (FastAPI - Phases 1-4)
- **Python 3.13+** — Runtime
- **FastAPI ≥0.125** — Web framework
- **SQLAlchemy 2.0.x** — Async ORM
- **Pydantic 2.11+** — Validation (backend)
- **Alembic 1.14+** — Database migrations
- **Celery 5.4+** — Task queue
- **Valkey 8.1+** — Caching (Redis OSS fork)
- **python-jose** — JWT token handling (Phase 4)
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

### Phase 4 Security Enhancements

1. **JWT Token Management** (XSS Protection):
   - ✅ Tokens stored in **memory** (module closure in `client.ts`)
   - ✅ Never in `localStorage` or `sessionStorage` (vulnerable to XSS)
   - ✅ Cleared on 401 response
   - ✅ Lost on page refresh (acceptable tradeoff)
   - ⏳ Future: Refresh tokens with HttpOnly cookies (Phase 5)

2. **CORS Configuration** (Environment-Driven):
   - ✅ Explicit origin list (not `["*"]`)
   - ✅ `allow_credentials=True` requires explicit origins
   - ✅ Environment-driven via `ALLOWED_ORIGINS` env var
   - ✅ Development: `http://localhost:5173,http://localhost:3000`
   - ✅ Production: `https://flowviz.example.com`

3. **Error Handling** (Security-Aware):
   - ✅ 401 → Automatic redirect to `/login` (no sensitive data exposed)
   - ✅ 403 → Toast notification (no stack traces)
   - ✅ 5xx → Generic error message (no internal details leaked)
   - ✅ Error boundaries prevent app crashes

4. **Authentication** — JWT tokens with bcrypt password hashing

5. **Authorization** — Role-based access control (RBAC)

6. **Row Level Security** — Database-level access policies (optional)

7. **API Security** — Rate limiting, CORS, input validation

8. **Data Validation** — Pydantic schemas (backend), Zod schemas (frontend)

9. **Secrets Management** — Environment variables, never committed

### Security Best Practices

| Practice | Implementation |
|----------|----------------|
| **Token Storage** | Memory (module closure), not localStorage |
| **CORS** | Env-driven explicit origins |
| **Password Hashing** | bcrypt with salt rounds |
| **JWT Expiry** | 30 minutes (configurable) |
| **HTTPS** | Required in production |
| **Input Validation** | Pydantic (backend) + Zod (frontend) |
| **SQL Injection** | SQLAlchemy parameterized queries |
| **XSS Protection** | React auto-escaping + CSP headers |

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
- [Phase 4 Frontend-FastAPI Integration](phase/phase-4_frontend-fastapi-integration.md) — **NEW** ✨

### Technical Documentation
- [ENVIRONMENT.md](ENVIRONMENT.md) — Environment variables (Phase 4) - **NEW**
- [RUNBOOK.md](RUNBOOK.md) — Error scenarios and recovery (Phase 4) - **NEW**
- [CLAUDE.md - AI Coding Guide](../CLAUDE.md)
- [Architecture Decision Records](decisions/)

### Code Documentation
- [Database Migrations](../backend/alembic/)
- [API Tests](../backend/tests/)
- [Frontend Types](../flow-viz-react/src/types/)
- [Flow Types](../flow-viz-react/src/types/flow.ts)
- [API Client](../flow-viz-react/src/lib/api/) — Phase 4 - **NEW**
- [Query Hooks](../flow-viz-react/src/hooks/) — Phase 4 - **NEW**

### PRPs (Pydantic AI Agent Templates)
- [Phase 4 Frontend-FastAPI Integration PRP](../PRPs/phase4-frontend-fastapi-integration.md) - **NEW**
- [Phase 4 Security & Error Handling PRP](../PRPs/phase4-security-error-handling.md) - **NEW**
