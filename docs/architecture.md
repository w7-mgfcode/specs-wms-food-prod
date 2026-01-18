# System Architecture

## Overview

Flow-Viz React is a **food production traceability system** designed for manufacturing environments. The system provides real-time visualization of production flows, lot tracking with full genealogy, and quality control gate management.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     React 19 + TypeScript                          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │ │
│  │  │Dashboard │  │ Command  │  │Validator │  │   Presentation     │ │ │
│  │  │  (V1)    │  │  Center  │  │  (V3)    │  │      Mode          │ │ │
│  │  │          │  │  (V2)    │  │          │  │                    │ │ │
│  │  │ • Flow   │  │ • Lot    │  │ • Audit  │  │ • Slides           │ │ │
│  │  │   Canvas │  │   Forms  │  │   Log    │  │ • Demo             │ │ │
│  │  │ • Phases │  │ • QC     │  │ • Trace  │  │                    │ │ │
│  │  │ • Alerts │  │   Gates  │  │   Graph  │  │                    │ │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                    ┌───────────────┴───────────────┐                    │
│                    │       STATE MANAGEMENT        │                    │
│                    │         (Zustand)             │                    │
│                    │  ┌─────┐ ┌─────┐ ┌─────┐     │                    │
│                    │  │Auth │ │Prod │ │ UI  │     │                    │
│                    │  │Store│ │Store│ │Store│     │                    │
│                    │  └─────┘ └─────┘ └─────┘     │                    │
│                    └───────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ HTTPS
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                   │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    Supabase (BaaS)                                 │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │ │
│  │  │   Auth       │  │  REST API    │  │    Realtime              │ │ │
│  │  │  • JWT       │  │  • PostgREST │  │    • WebSocket           │ │ │
│  │  │  • RBAC      │  │  • RLS       │  │    • Subscriptions       │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    PostgreSQL 15                                   │ │
│  │                                                                    │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐│ │
│  │  │   users     │  │  scenarios  │  │   production_runs           ││ │
│  │  │   • roles   │  │  • streams  │  │   • lots                    ││ │
│  │  │   • auth    │  │  • phases   │  │   • lot_genealogy           ││ │
│  │  │             │  │  • qc_gates │  │   • qc_decisions            ││ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────────┘│ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
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

### Database Schema

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   scenarios  │────<│   streams    │     │   qc_gates   │
│              │     │              │     │              │
│ • id         │     │ • stream_key │     │ • gate_type  │
│ • name       │     │ • color      │     │ • is_ccp     │
│ • version    │     │ • sort_order │     │ • checklist  │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │                    └────────┬───────────┘
       │                             │
       ▼                             ▼
┌──────────────┐            ┌──────────────┐
│    phases    │            │production_run│
│              │            │              │
│ • phase_num  │            │ • run_code   │
│ • name       │            │ • status     │
│ • stream_id  │            │ • operator_id│
└──────────────┘            └──────────────┘
       │                             │
       └──────────┬──────────────────┘
                  │
                  ▼
           ┌──────────────┐
           │     lots     │
           │              │◄─────────────────┐
           │ • lot_code   │                  │
           │ • lot_type   │     ┌────────────┴────┐
           │ • weight_kg  │     │ lot_genealogy   │
           │ • temp_c     │     │ (parent → child)│
           └──────────────┘     └─────────────────┘
                  │
                  ▼
           ┌──────────────┐
           │ qc_decisions │
           │              │
           │ • decision   │
           │ • notes      │
           │ • timestamp  │
           └──────────────┘
```

---

## Data Flow

### Production Run Lifecycle

```
1. START RUN
   └─► Create production_run record
   └─► Initialize phase to 0

2. PHASE PROGRESSION
   └─► Operator advances phases
   └─► Auto-registration creates lots (if enabled)
   └─► QC gates trigger decisions

3. LOT REGISTRATION
   └─► Create lot record with type, weight, temp
   └─► Link parent lots via lot_genealogy
   └─► Associate with current phase

4. QC DECISION
   └─► Record PASS/HOLD/FAIL at gate
   └─► Trigger alerts for HOLD/FAIL
   └─► Block progression if blocking gate

5. END RUN
   └─► Generate summary statistics
   └─► Mark run as COMPLETED
   └─► Display summary modal
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
- **TypeScript** — Type safety
- **React Router v7** — Routing
- **Zustand** — State management
- **TanStack Query** — Server state
- **Tailwind CSS** — Styling
- **Vite 6** — Build tool

### Backend
- **Supabase** — Backend as a Service
- **PostgreSQL 15** — Database
- **PostgREST** — Auto-generated REST API
- **Row Level Security** — Data access control

### Infrastructure
- **Docker** — Containerization
- **Nginx** — Static file serving
- **GitHub Actions** — CI/CD

---

## Deployment Architecture

### Docker Compose (Development)

```yaml
services:
  postgres:    # PostgreSQL 15
  api:         # Express.js backend
  web:         # Nginx + React app
```

### Production (Supabase)

```
┌──────────────────┐     ┌──────────────────┐
│   CDN / Edge     │────>│   Supabase       │
│   (Static SPA)   │     │   Cloud          │
└──────────────────┘     │                  │
                         │  • Auth          │
                         │  • Database      │
                         │  • Storage       │
                         │  • Realtime      │
                         └──────────────────┘
```

---

## Security Considerations

1. **Authentication** — Supabase Auth with JWT tokens
2. **Authorization** — Row Level Security (RLS) policies
3. **Role Enforcement** — Frontend + backend role checks
4. **API Security** — Rate limiting, CORS configuration
5. **Data Validation** — Zod schemas on frontend, DB constraints on backend

---

## Related Documentation

- [Architecture Decision Records](decisions/)
- [Database Schema](../flow-viz-react/supabase/migrations/)
- [API Documentation](../flow-viz-react/server/)
