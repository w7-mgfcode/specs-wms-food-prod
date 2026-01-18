# System Architecture

## Overview

Flow-Viz React is a **food production traceability system** designed for manufacturing environments. The system provides real-time visualization of production flows, lot tracking with full genealogy, and quality control gate management.

### Migration Strategy (Phase 1+)

We are migrating from Node/Express to **FastAPI** using the **strangler pattern**:
- New FastAPI backend runs alongside existing Node server
- Endpoints are gradually migrated to FastAPI
- Frontend transparently switches between backends via routing

---

## High-Level Architecture

```
+-------------------------------------------------------------------------+
|                              CLIENT LAYER                                |
|  +--------------------------------------------------------------------+ |
|  |                     React 19 + TypeScript                          | |
|  |  +--------------+  +--------------+  +--------------------------+ | |
|  |  |  Dashboard   |  |   Command    |  |       Validator          | | |
|  |  |    (V1)      |  |   Center     |  |         (V3)             | | |
|  |  |              |  |    (V2)      |  |                          | |  |
|  |  | - FlowCanvas |  | - Lot Forms  |  | - Audit Log              | |  |
|  |  | - Phases     |  | - QC Gates   |  | - Traceability Graph     | |  |
|  |  | - Alerts     |  | - Prod Ctrl  |  | - Compliance Reports     | |  |
|  |  +--------------+  +--------------+  +--------------------------+ |  |
|  +--------------------------------------------------------------------+ |
|                                    |                                     |
|                    +---------------+---------------+                    |
|                    |       STATE MANAGEMENT        |                    |
|                    |    Zustand + TanStack Query   |                    |
|                    |  +-----+ +-----+ +-----+     |                    |
|                    |  |Auth | |Prod | |Toast|     |                    |
|                    |  |Store| |Store| |Store|     |                    |
|                    |  +-----+ +-----+ +-----+     |                    |
|                    +-------------------------------+                    |
+-------------------------------------------------------------------------+
                                     |
                                     | HTTPS/REST
                                     v
+-------------------------------------------------------------------------+
|                              API LAYER                                   |
|  +---------------------------+    +-----------------------------------+ |
|  |   FastAPI (New - :8000)   |    |   Node/Express (Legacy - :3001)   | |
|  |  +---------------------+  |    |  +-----------------------------+  | |
|  |  | /api/v1/lots        |  |    |  | /api/lots (deprecated)      |  | |
|  |  | /api/v1/runs        |  |    |  | /api/runs (deprecated)      |  | |
|  |  | /api/v1/qc-gates    |  |    |  | /api/qc-decisions           |  | |
|  |  | /api/v1/auth        |  |    |  +-----------------------------+  | |
|  |  | /api/v1/traceability|  |    |                                   | |
|  |  +---------------------+  |    |   Supabase BaaS (Auth/Realtime)   | |
|  |  +---------------------+  |    |  +-----------------------------+  | |
|  |  | Pydantic Schemas    |  |    |  | - JWT Auth                  |  | |
|  |  | SQLAlchemy Models   |  |    |  | - PostgREST                 |  | |
|  |  | Celery Tasks        |  |    |  | - Realtime WebSocket        |  | |
|  |  +---------------------+  |    |  +-----------------------------+  | |
|  +---------------------------+    +-----------------------------------+ |
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
| **Presentation** | Demo/presentation mode for stakeholders |

### State Management (Zustand)

| Store | Responsibility |
|-------|----------------|
| `useAuthStore` | Authentication state, user session, role |
| `useProductionStore` | Active run, lots, phases, QC gates, auto-registration |
| `useUIStore` | Language, theme, navigation state |
| `useToastStore` | Notifications and alerts |

### Backend (FastAPI) - NEW in Phase 1

| Component | Purpose |
|-----------|---------|
| **Routes** | `/api/v1/*` endpoints for lots, runs, QC, auth, traceability |
| **Models** | SQLAlchemy 2.0 async models for all domain entities |
| **Schemas** | Pydantic 2.11+ schemas for request/response validation |
| **Services** | Business logic layer (lot service, QC service, etc.) |
| **Tasks** | Celery background tasks for batch operations |

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

| Role | Dashboard | Command | Validator | Admin |
|------|:---------:|:-------:|:---------:|:-----:|
| VIEWER | ✅ | ❌ | ❌ | ❌ |
| OPERATOR | ✅ | ✅ | ❌ | ❌ |
| MANAGER | ✅ | ✅ | ✅ | ❌ |
| AUDITOR | ✅ | ❌ | ✅ | ❌ |
| ADMIN | ✅ | ✅ | ✅ | ✅ |

---

## Technology Stack

### Frontend
- **React 19** — UI framework
- **TypeScript 5.7** — Type safety
- **React Router v7** — Routing
- **Zustand** — State management
- **TanStack Query** — Server state
- **Tailwind CSS** — Styling
- **Vite 6** — Build tool
- **Zod** — Schema validation

### Backend (NEW - FastAPI)
- **Python 3.13+** — Runtime
- **FastAPI ≥0.125** — Web framework
- **SQLAlchemy 2.0.x** — Async ORM
- **Pydantic 2.11+** — Validation
- **Alembic 1.14+** — Migrations
- **Celery 5.4+** — Task queue
- **Valkey 8.1+** — Caching (Redis OSS fork)

### Backend (Legacy - Node/Express)
- **Express.js** — API server (being migrated)
- **Supabase** — BaaS for auth/realtime

### Database
- **PostgreSQL 17** — Primary database
- **Row Level Security** — Data access control

### Infrastructure
- **Docker** — Containerization
- **Docker Compose** — Local development
- **DevContainer** — VS Code development
- **Nginx** — Static file serving
- **GitHub Actions** — CI/CD

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

1. **Authentication** — JWT tokens with bcrypt password hashing
2. **Authorization** — Role-based access control (RBAC)
3. **Row Level Security** — Database-level access policies
4. **API Security** — Rate limiting, CORS, input validation
5. **Data Validation** — Pydantic schemas (backend), Zod schemas (frontend)
6. **Secrets Management** — Environment variables, never committed

---

## API Versioning

The FastAPI backend uses URL-based versioning:

```
/api/v1/lots          # Current stable API
/api/v1/runs          
/api/v1/qc-gates      
/api/v1/traceability  
/api/v1/auth          
```

Legacy Node/Express endpoints (deprecated):
```
/api/lots             # Will be removed in Phase 3
/api/runs             
/api/qc-decisions     
```

---

## Related Documentation

- [Architecture Decision Records](decisions/)
- [Phase 1 Backend Summary](phase/phase-1_backend.md)
- [CLAUDE.md - AI Coding Guide](../CLAUDE.md)
- [Database Migrations](../backend/alembic/)
- [API Tests](../backend/tests/)
- [Frontend Types](../flow-viz-react/src/types/)
