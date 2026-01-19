# specs-wms-food-prod

> 📋 Food Production WMS Specification & Enterprise System Design

[![CI/CD Pipeline](https://github.com/w7-mgfcode/specs-wms-food-prod/actions/workflows/run-tests.yml/badge.svg)](https://github.com/w7-mgfcode/specs-wms-food-prod/actions/workflows/run-tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.125+-009688.svg)](https://fastapi.tiangolo.com/)

**Specification repository** for customizing a Warehouse Management System (WMS) for Food Production companies. Includes full traceability design, HACCP compliance, lot tracking, QC gates, and audit logging specifications.

---

## What's New (v0.4.0) 🎉

- **Frontend-FastAPI Integration** — Complete migration from Supabase/mock to FastAPI backend
- **API Client Layer** — Hybrid approach with generated types and handwritten fetch wrapper
- **TanStack Query v5** — Server state management with smart caching and error handling
- **Security Enhancements** — JWT tokens in memory (XSS protection), env-driven CORS
- **Error Boundaries** — React Error Boundary with global 401/403 handlers
- **Type Generation** — `npm run generate:api` script for OpenAPI type sync
- **Documentation** — ENVIRONMENT.md (128 lines) and RUNBOOK.md (309 lines)
- See [Phase 4 Summary](docs/phase/phase-4_frontend-fastapi-integration.md) for details

### Previous Releases

<details>
<summary>v0.3.0 - First Flow Lane UI</summary>

- **First Flow (V4)** — Interactive lane-based production flow visualization
- **Buffer Lane UI** — 4 buffer zones (LK, MIX, SKW15, SKW30) with real-time lot tracking
- **QC Gate Stepper** — 7-gate progression from Receipt to Packaging
- **Flow Store** — New Zustand store for flow state management
- **Temperature Badges** — Color-coded temperature status indicators
- See [Phase 3 Summary](docs/phase/phase-3_first-flow.md) for details

</details>

<details>
<summary>v0.2.0 - Backend Migration Foundation</summary>

- **FastAPI Backend** — Python 3.13+ backend scaffold for Node/Express migration
- **CLAUDE.md** — Comprehensive AI coding guidance (674 lines)
- **DevContainer** — VS Code remote development environment
- **Characterization Tests** — API parity test framework
- See [Phase 1 Summary](docs/phase/phase-1_backend.md) for details

</details>

---

## Features

- **Real-time Flow Visualization** — Track production across 3 parallel streams (A, B, C)
- **First Flow (V4)** — Lane-based buffer visualization with QC gate progression (NEW)
- **Lot Traceability** — Full parent/child genealogy with weight and temperature tracking
- **QC Gates** — Quality control checkpoints with PASS/HOLD/FAIL decisions and CCP support
- **Temperature Monitoring** — Color-coded badges with ok/warning/critical thresholds
- **Role-Based Access Control** — ADMIN, MANAGER, AUDITOR, OPERATOR, VIEWER roles
- **Multi-Language Support** — Hungarian (hu) and English (en)
- **Production Run Management** — Start/stop runs, auto-registration, summaries

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (frontend)
- Python 3.13+ (backend)
- Docker & Docker Compose
- UV package manager (recommended for Python)

### Backend Development (FastAPI) - Start First!

```bash
# Navigate to backend
cd specs-wms-food-prod/backend

# Start Docker services (PostgreSQL 17 + Valkey)
docker-compose -f docker/docker-compose.yml up -d

# Install Python dependencies with UV
uv sync

# Run FastAPI server (port 8000)
uv run uvicorn app.main:app --reload --port 8000

# Verify backend is running
curl http://localhost:8000/api/health
```

### Frontend Development

```bash
# Clone the repository (if not already done)
git clone https://github.com/w7-mgfcode/specs-wms-food-prod.git
cd specs-wms-food-prod/flow-viz-react

# Install dependencies
npm install

# Start development server (port 5173)
# Automatically proxies /api requests to FastAPI (port 8000)
npm run dev

# Optional: Generate TypeScript types from OpenAPI schema
npm run generate:api
```

**Note**: The frontend now requires the FastAPI backend to be running. The Vite dev server proxies all `/api` requests to `http://localhost:8000`.

### Using DevContainer (Recommended)

1. Open in VS Code
2. Click "Reopen in Container" when prompted
3. All dependencies pre-installed

### Environment Variables

**Frontend (Vite)**:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_API_URL` | API base URL | No | Empty (uses Vite proxy) |
| `VITE_DB_MODE` | Database mode | No | `mock` |
| `VITE_USE_MOCK` | Enable simulation mode | No | `false` |
| `VITE_SUPABASE_URL` | Supabase project URL (legacy) | No | - |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key (legacy) | No | - |

**Backend (FastAPI)**:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes (prod) | `postgresql+asyncpg://...` |
| `SECRET_KEY` | JWT signing key (min 32 chars) | Yes (prod) | `INSECURE-DEV-ONLY-CHANGE-ME` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | No | `http://localhost:5173,...` |
| `JWT_ALGORITHM` | JWT algorithm | No | `HS256` |
| `JWT_EXPIRE_MINUTES` | JWT token expiry | No | `30` |
| `REDIS_URL` | Redis/Valkey connection URL | No | `redis://localhost:6379/0` |
| `DEBUG` | Enable debug mode | No | `true` |

See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for complete documentation.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Frontend (React 19)                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌─────────────┐  │
│  │Dashboard│  │ Command │  │Validator│  │First Flow│  │ Presentation│  │
│  │  (V1)   │  │  (V2)   │  │  (V3)   │  │   (V4)   │  │    Mode     │  │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬─────┘  └──────┬──────┘  │
│       └────────────┴────────────┴────────────┴───────────────┘         │
│                          │                                               │
│       ┌──────────────────┴──────────────────┐                          │
│       │      State Management (Phase 4)      │                          │
│       │  ┌────────────┐  ┌────────────────┐ │                          │
│       │  │  Zustand   │  │ TanStack Query │ │                          │
│       │  │ (UI State) │  │ (Server State) │ │                          │
│       │  └────────────┘  └────────┬───────┘ │                          │
│       └─────────────────────────────────────┘                          │
│                                    │                                     │
│                          ┌─────────▼─────────┐                          │
│                          │   API Client      │                          │
│                          │  - JWT (memory)   │                          │
│                          │  - Error handling │                          │
│                          │  - 401/403 logic  │                          │
│                          └─────────┬─────────┘                          │
└────────────────────────────────────┼──────────────────────────────────┘
                                     │
                          ┌──────────▼──────────┐
                          │  Vite Dev Proxy     │
                          │  /api → :8000       │
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │    FastAPI          │
                          │    Port 8000        │
                          │  - CORS (env)       │
                          │  - JWT Auth         │
                          │  - Pydantic         │
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │  PostgreSQL 17      │
                          │  + Valkey 8.1       │
                          └─────────────────────┘
```

**Key Changes in Phase 4**:
- ✅ **State Separation**: Zustand (UI) + TanStack Query (Server)
- ✅ **API Client**: Hybrid pattern with JWT in memory (XSS protection)
- ✅ **Vite Proxy**: Frontend proxies `/api` to FastAPI port 8000
- ✅ **Security**: Environment-driven CORS, no localStorage tokens
- ❌ **Deprecated**: Node/Express (port 3000), Supabase BaaS

See [docs/architecture.md](docs/architecture.md) for detailed documentation.

---

## Project Structure

```
specs-wms-food-prod/
├── CLAUDE.md                 # AI coding guidance (674 lines)
├── INITIAL.md                # Backend refactor specification
├── flow-viz-react/           # React 19 frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── flow/         # First Flow components (V4)
│   │   │   │   ├── FirstFlowPage.tsx
│   │   │   │   ├── BufferLane.tsx
│   │   │   │   ├── LotCard.tsx
│   │   │   │   ├── GateStepper.tsx
│   │   │   │   └── TempBadge.tsx
│   │   │   ├── command/      # Command Center (V2)
│   │   │   ├── validator/    # Validator (V3)
│   │   │   ├── ErrorBoundary.tsx  # Error boundary (Phase 4) - NEW
│   │   │   └── ui/           # Reusable UI primitives
│   │   ├── stores/           # Zustand state management (UI only)
│   │   │   ├── useFlowStore.ts
│   │   │   ├── useAuthStore.ts
│   │   │   ├── useProductionStore.ts
│   │   │   └── useToastStore.ts
│   │   ├── hooks/            # TanStack Query hooks (Phase 4) - NEW
│   │   │   ├── useLots.ts
│   │   │   ├── useQC.ts
│   │   │   └── useTraceability.ts
│   │   ├── lib/
│   │   │   ├── api/          # API client layer (Phase 4) - NEW
│   │   │   │   ├── client.ts      # Base fetch wrapper + JWT
│   │   │   │   ├── types.ts       # TypeScript interfaces
│   │   │   │   ├── auth.ts        # Login function
│   │   │   │   ├── lots.ts        # Lot operations
│   │   │   │   ├── qc.ts          # QC decisions
│   │   │   │   └── traceability.ts
│   │   │   ├── queryClient.ts     # TanStack Query config - NEW
│   │   │   ├── db.ts         # DEPRECATED (legacy adapter)
│   │   │   └── supabase.ts   # DEPRECATED (legacy BaaS)
│   │   └── types/
│   │       ├── flow.ts       # Flow type definitions
│   │       └── database.types.ts
│   ├── public/scenarios/     # Seed configuration data
│   │   └── first-flow-config.json
│   └── .env.example          # Environment template (Phase 4) - NEW
├── backend/                  # FastAPI backend
│   ├── app/
│   │   ├── api/routes/       # API endpoints
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── services/         # Business logic
│   │   ├── config.py         # Settings (CORS env-driven) - UPDATED
│   │   └── tasks/            # Celery tasks
│   ├── alembic/              # Database migrations
│   ├── docker/               # Docker Compose
│   └── tests/                # Characterization tests
├── PRPs/                     # Pydantic AI agent templates
│   ├── phase4-frontend-fastapi-integration.md  # Phase 4 PRP - NEW
│   └── phase4-security-error-handling.md       # Phase 4 Security - NEW
├── docs/
│   ├── architecture.md       # System architecture
│   ├── SETUP.md              # Setup guide
│   ├── ENVIRONMENT.md        # Environment variables (Phase 4) - NEW
│   ├── RUNBOOK.md            # Error scenarios (Phase 4) - NEW
│   ├── phase/                # Phase summaries
│   │   ├── phase-1_backend.md
│   │   ├── phase-2_api-backend.md
│   │   ├── phase-3_first-flow.md
│   │   └── phase-4_frontend-fastapi-integration.md  # Phase 4 - NEW
│   └── decisions/            # ADRs
└── .github/                  # CI/CD workflows
```

---

## 🧪 Testing

```bash
# Frontend linting
npm run lint

# Build check
npm run build

# E2E tests (Playwright)
npx playwright test
```

---

## 🔄 Branching Model

This project follows a **phase-based branching model**:

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready, tagged releases only |
| `develop` | Integration branch for all phases |
| `phase/X-*` | Logical delivery phases |

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed workflow.

---

## 📄 License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting pull requests.
