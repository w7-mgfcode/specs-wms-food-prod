# specs-wms-food-prod

> 📋 Food Production WMS Specification & Enterprise System Design

[![CI/CD Pipeline](https://github.com/w7-mgfcode/specs-wms-food-prod/actions/workflows/run-tests.yml/badge.svg)](https://github.com/w7-mgfcode/specs-wms-food-prod/actions/workflows/run-tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Specification repository** for customizing a Warehouse Management System (WMS) for Food Production companies. Includes full traceability design, HACCP compliance, lot tracking, QC gates, and audit logging specifications.

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

- Node.js 18+
- Docker & Docker Compose (for local database)
- Supabase account (for production) or local PostgreSQL

### Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/w7-mgfcode/specs-wms-food-prod.git
cd specs-wms-food-prod/flow-viz-react

# 2. Install dependencies
npm install

# 3. Start local database (optional - uses mock mode by default)
docker-compose up -d postgres

# 4. Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 5. Start development server
npm run dev
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | For DB mode |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | For DB mode |
| `VITE_USE_MOCK` | Enable simulation mode (`true`/`false`) | No (default: `false`) |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React 19)                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │Dashboard│  │ Command │  │Validator│  │  Presentation   │ │
│  │  (V1)   │  │  (V2)   │  │  (V3)   │  │     Mode        │ │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────────┬────────┘ │
│       └────────────┴────────────┴────────────────┘          │
│                          │                                   │
│              ┌───────────┴───────────┐                      │
│              │    Zustand Stores     │                      │
│              │  (Auth, Production,   │                      │
│              │    UI, Toast)         │                      │
│              └───────────┬───────────┘                      │
└──────────────────────────┼──────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │   Supabase (PostgreSQL) │
              │  • Users & Auth         │
              │  • Scenarios & Phases   │
              │  • Lots & Genealogy     │
              │  • QC Gates & Decisions │
              └─────────────────────────┘
```

See [docs/architecture.md](docs/architecture.md) for detailed documentation.

---

## 📁 Project Structure

```
w7-specsWH-DUNA_v2/
├── flow-viz-react/           # Main React application
│   ├── src/
│   │   ├── components/       # UI components (shell, flow, forms, widgets)
│   │   ├── pages/            # Route pages (FlowVizV1, V2, V3, Login)
│   │   ├── stores/           # Zustand state management
│   │   ├── types/            # TypeScript type definitions
│   │   └── lib/              # Utilities and database client
│   ├── server/               # Express.js API backend
│   ├── supabase/             # Database migrations
│   └── docker/               # Docker configs & SQL seeds
├── PRPs/                     # Pydantic AI agent templates
│   ├── examples/             # Reference implementations
│   └── templates/            # PRP base templates
├── docs/                     # Documentation
│   ├── architecture.md       # System architecture
│   └── decisions/            # Architecture Decision Records
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
