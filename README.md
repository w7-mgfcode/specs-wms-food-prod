# specs-wms-food-prod

> 📋 Food Production WMS Specification & Enterprise System Design

[![CI/CD Pipeline](https://github.com/w7-mgfcode/specs-wms-food-prod/actions/workflows/run-tests.yml/badge.svg)](https://github.com/w7-mgfcode/specs-wms-food-prod/actions/workflows/run-tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.125+-009688.svg)](https://fastapi.tiangolo.com/)

**Specification repository** for customizing a Warehouse Management System (WMS) for Food Production companies. Includes full traceability design, HACCP compliance, lot tracking, QC gates, and audit logging specifications.

---

## 🆕 What's New (v0.2.0)

- **FastAPI Backend** — Python 3.13+ backend scaffold for Node/Express migration
- **CLAUDE.md** — Comprehensive AI coding guidance (674 lines)
- **DevContainer** — VS Code remote development environment
- **Characterization Tests** — API parity test framework
- See [Phase 1 Summary](docs/phase/phase-1_backend.md) for details

---

## 🏭 Features

- **Real-time Flow Visualization** — Track production across 3 parallel streams (A, B, C)
- **Lot Traceability** — Full parent/child genealogy with weight and temperature tracking
- **QC Gates** — Quality control checkpoints with PASS/HOLD/FAIL decisions and CCP support
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

### Frontend Development

```bash
# Clone the repository
git clone https://github.com/w7-mgfcode/specs-wms-food-prod.git
cd specs-wms-food-prod/flow-viz-react

# Install dependencies
npm install

# Start development server
npm run dev
```

### Backend Development (FastAPI)

```bash
# Navigate to backend
cd specs-wms-food-prod/backend

# Start Docker services (PostgreSQL 17 + Valkey)
docker-compose -f docker/docker-compose.yml up -d

# Install Python dependencies with UV
uv sync

# Run FastAPI server
uv run uvicorn app.main:app --reload --port 8000
```

### Using DevContainer (Recommended)

1. Open in VS Code
2. Click "Reopen in Container" when prompted
3. All dependencies pre-installed

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | For DB mode |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | For DB mode |
| `VITE_USE_MOCK` | Enable simulation mode (`true`/`false`) | No (default: `false`) |
| `DATABASE_URL` | PostgreSQL connection string | Backend |
| `VALKEY_URL` | Valkey/Redis connection string | Backend |
| `JWT_SECRET_KEY` | Secret for JWT tokens | Backend |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Frontend (React 19)                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐             │
│  │Dashboard│  │ Command │  │Validator│  │  Presentation   │             │
│  │  (V1)   │  │  (V2)   │  │  (V3)   │  │     Mode        │             │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────────┬────────┘             │
│       └────────────┴────────────┴────────────────┘                      │
│                          │                                               │
│              ┌───────────┴───────────┐                                  │
│              │    Zustand Stores     │                                  │
│              └───────────┬───────────┘                                  │
└──────────────────────────┼──────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Node/Express   │ │    FastAPI      │ │    Supabase     │
│  (Legacy)       │ │    (New)        │ │    (BaaS)       │
│  Port 3000      │ │    Port 8000    │ │                 │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┴───────────────────┘
                             │
                    ┌────────┴────────┐
                    │  PostgreSQL 17  │
                    │  + Valkey 8.1   │
                    └─────────────────┘
```

See [docs/architecture.md](docs/architecture.md) for detailed documentation.

---

## 📁 Project Structure

```
specs-wms-food-prod/
├── CLAUDE.md                 # AI coding guidance (674 lines)
├── INITIAL.md                # Backend refactor specification
├── flow-viz-react/           # React 19 frontend application
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── stores/           # Zustand state management
│   │   ├── types/            # TypeScript definitions
│   │   └── lib/              # Utilities & schemas
│   └── server/               # Node/Express API (legacy)
├── backend/                  # FastAPI backend (new)
│   ├── app/
│   │   ├── api/routes/       # API endpoints
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── services/         # Business logic
│   │   └── tasks/            # Celery tasks
│   ├── alembic/              # Database migrations
│   ├── docker/               # Docker Compose
│   └── tests/                # Characterization tests
├── PRPs/                     # Pydantic AI agent templates
├── docs/
│   ├── architecture.md       # System architecture
│   ├── SETUP.md              # Setup guide
│   ├── phase/                # Phase summaries
│   │   └── phase-1_backend.md
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
