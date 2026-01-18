# CLAUDE.md — specs-wms-food-prod

> 📋 **Food Production WMS Specification & Enterprise System Design**
>
> This file provides comprehensive guidance to Claude Code when working in this repository.

---

## 1. Project Overview

### Purpose

This is a **specification repository** for customizing a Warehouse Management System (WMS) for **Food Production companies**. It contains:

- System design specifications
- Full traceability requirements
- HACCP compliance documentation
- A React prototype (`flow-viz-react/`)
- Pydantic AI agent templates (`PRPs/`)

### Repository Structure

```
specs-wms-food-prod/
├── CLAUDE.md                   # This file - AI coding guidance
├── README.md                   # Project overview
├── CONTRIBUTING.md             # Phase-based workflow
├── INITIAL.md                  # Backend refactor spec
├── docs/
│   ├── architecture.md         # System architecture
│   ├── SETUP.md                # Development setup
│   ├── decisions/              # Architecture Decision Records (ADRs)
│   └── refactor/               # Migration plans
├── flow-viz-react/             # React 19 prototype application
│   ├── src/
│   │   ├── components/         # UI components
│   │   ├── stores/             # Zustand state management
│   │   ├── types/              # TypeScript type definitions
│   │   └── lib/                # Utilities & schemas
│   └── server/                 # Node/Express API (to be migrated)
├── PRPs/                       # Pydantic AI agent templates
│   ├── examples/               # Reference implementations
│   └── templates/              # PRP templates
└── scripts/                    # Automation scripts
```

### Tech Stack

| Layer | Current | Target (Migration) |
|-------|---------|-------------------|
| **Frontend** | React 19, TypeScript 5.7, Vite 6 | — |
| **State** | Zustand, TanStack Query | — |
| **Validation** | Zod 4.x (frontend), Pydantic 2.11+ (backend) | — |
| **Backend** | Node/Express + Supabase | Python 3.13+, FastAPI ≥0.125 |
| **ORM** | — | SQLAlchemy 2.0.x (async) |
| **Database** | PostgreSQL (Supabase) | PostgreSQL 17.x |
| **Cache** | — | Valkey 8.1+ |
| **Tasks** | — | Celery 5.4+ |
| **Auth** | Supabase Auth | bcrypt + python-jose |

---

## 2. Development Philosophy

### Core Principles

- **KISS (Keep It Simple, Stupid)**: Choose straightforward solutions over complex ones.
- **YAGNI (You Aren't Gonna Need It)**: Implement features only when needed.
- **Specification-First**: Document and validate requirements before implementation.
- **Fail Fast**: Check for errors early; raise exceptions immediately when issues occur.

### Design Principles

- **Dependency Inversion**: High-level modules depend on abstractions, not implementations.
- **Open/Closed**: Open for extension, closed for modification.
- **Single Responsibility**: Each function, class, and module has one clear purpose.

### Safe Refactor Workflow (Backend Migration)

Follow this sequence for the Node→FastAPI migration:

```
1. BASELINE    → Capture golden outputs (response snapshots)
2. CHARACTERIZE → Add HTTP-level tests locking in existing behavior
3. REFACTOR    → Small, SRP-scoped changes
4. VALIDATE    → Run tests, compare snapshots after each step
5. CLEANUP     → Remove dead code when parity confirmed
6. FINAL       → Coverage check + diff review
```

---

## 3. Code Structure & Limits

### File and Function Limits

| Metric | Limit | Action if Exceeded |
|--------|-------|-------------------|
| File length | 500 lines | Split into modules |
| Function length | 50 lines | Extract helper functions |
| Class length | 100 lines | Split responsibilities |
| Line length | 100 characters | Wrap appropriately |

### Frontend Architecture (React)

```
src/
├── components/
│   ├── auth/           # Authentication components
│   ├── command/        # Operator controls (QC, registration)
│   ├── flow/           # Flow visualization
│   ├── shell/          # App shell, navigation
│   ├── ui/             # Reusable UI primitives
│   ├── validator/      # Audit & traceability
│   └── widgets/        # Domain-specific widgets
├── stores/             # Zustand stores (one per domain)
├── types/              # TypeScript definitions
├── lib/                # Utilities, schemas
└── pages/              # Route-level components
```

### Backend Architecture (FastAPI Target)

```
src/
├── main.py             # FastAPI app entry
├── config/             # Settings, environment
├── models/             # SQLAlchemy models
├── schemas/            # Pydantic request/response models
├── api/
│   ├── routes/         # API route handlers
│   └── deps.py         # Dependency injection
├── services/           # Business logic layer
├── tasks/              # Celery async tasks
└── tests/              # Co-located tests
```

---

## 4. TypeScript/React Conventions

### Zustand Store Pattern

```typescript
// stores/useExampleStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ExampleState {
    items: Record<string, Item>;
    isLoading: boolean;
    // Actions
    addItem: (item: Item) => void;
    reset: () => void;
}

export const useExampleStore = create<ExampleState>()(
    devtools(
        (set) => ({
            items: {},
            isLoading: false,
            addItem: (item) => set((state) => ({
                items: { ...state.items, [item.id]: item }
            })),
            reset: () => set({ items: {}, isLoading: false })
        }),
        { name: 'ExampleStore' }
    )
);
```

### Zod Validation Pattern

```typescript
// lib/schemas.ts
import { z } from 'zod';

export const lotRegistrationSchema = z.object({
    lotType: z.enum(['RAW', 'DEB', 'BULK', 'MIX', 'SKW', 'FRZ', 'FG']),
    barcode: z.string().regex(/^[A-Z]{2,4}-\d{8}-[A-Z]{4}-\d{4}$/),
    weight: z.number().min(0.1).max(1000).multipleOf(0.01),
    temperature: z.number().min(-40).max(40).multipleOf(0.1),
}).refine(
    (data) => data.lotType !== 'RAW' || !!data.supplierId,
    { message: 'Supplier required for RAW lots', path: ['supplierId'] }
);

export type LotRegistrationInput = z.infer<typeof lotRegistrationSchema>;
```

### Database Types (Row/Insert/Update Pattern)

```typescript
// types/database.types.ts
export interface Database {
    public: {
        Tables: {
            lots: {
                Row: {
                    id: string;
                    lot_code: string;
                    lot_type: 'RAW' | 'DEB' | 'BULK' | 'MIX' | 'SKW' | 'FRZ' | 'FG';
                    weight_kg: number;
                    temperature_c: number;
                    created_at: string;
                };
                Insert: Omit<Row, 'id' | 'created_at'> & { id?: string };
                Update: Partial<Insert>;
            };
        };
    };
}
```

### i18n LocalizedString Pattern

```typescript
export type Language = 'hu' | 'en';

export interface LocalizedString {
    hu: string;
    en: string;
}

// Usage
const title: LocalizedString = {
    hu: 'Gyártási Folyamat',
    en: 'Production Flow'
};
```

---

## 5. Python Conventions

### Pydantic v2 Model Pattern

```python
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional
from decimal import Decimal

class LotCreate(BaseModel):
    """Request model for creating a new lot."""
    lot_type: str = Field(..., pattern=r"^(RAW|DEB|BULK|MIX|SKW|FRZ|FG)$")
    weight_kg: Decimal = Field(..., gt=0, le=1000, decimal_places=2)
    temperature_c: Decimal = Field(..., ge=-40, le=40, decimal_places=1)
    parent_lot_ids: list[str] = Field(default_factory=list)
    
    @field_validator('lot_type')
    @classmethod
    def validate_lot_type(cls, v: str) -> str:
        return v.upper()
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "lot_type": "RAW",
                "weight_kg": "250.50",
                "temperature_c": "4.0"
            }
        }
    }
```

### FastAPI Route Pattern

```python
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Annotated

router = APIRouter(prefix="/api/lots", tags=["lots"])

@router.post("/", response_model=LotResponse, status_code=status.HTTP_201_CREATED)
async def create_lot(
    lot: LotCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)]
) -> LotResponse:
    """
    Create a new production lot.
    
    Requires: OPERATOR or higher role.
    """
    if current_user.role not in ('ADMIN', 'MANAGER', 'OPERATOR'):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    lot_db = await lot_service.create(db, lot, user_id=current_user.id)
    return LotResponse.model_validate(lot_db)
```

### Async SQLAlchemy Pattern

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

async def get_lot_by_code(db: AsyncSession, lot_code: str) -> Lot | None:
    """Retrieve a lot by its code."""
    stmt = select(Lot).where(Lot.lot_code == lot_code)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
```

### Docstring Standard (Google Style)

```python
def calculate_yield(
    input_weight: Decimal,
    output_weight: Decimal,
    loss_tolerance: Decimal = Decimal("0.05")
) -> tuple[Decimal, bool]:
    """
    Calculate production yield percentage.

    Args:
        input_weight: Total input weight in kg.
        output_weight: Total output weight in kg.
        loss_tolerance: Acceptable loss percentage (default 5%).

    Returns:
        Tuple of (yield_percentage, within_tolerance).

    Raises:
        ValueError: If weights are not positive.

    Example:
        >>> calculate_yield(Decimal("100"), Decimal("92"))
        (Decimal('0.92'), True)
    """
```

---

## 6. Food Production Domain

### Lot Types & Lifecycle

```
RAW → DEB → BULK → MIX → SKW → FRZ → FG
 │      │      │      │      │      │     │
 ▼      ▼      ▼      ▼      ▼      ▼     ▼
Receipt Deboned Buffer Mixed  Skewer Frozen Finished
        Meat            Batch  Rod          Goods
```

| Lot Type | Description | Temp Range | Weight Range |
|----------|-------------|------------|--------------|
| `RAW` | Raw material receipt | 2-6°C | 200-500 kg |
| `DEB` | Deboned meat | 2-5°C | 150-400 kg |
| `BULK` | Bulk buffer | 1-4°C | 400-600 kg |
| `MIX` | Mixed batch | 2-4°C | 700-900 kg |
| `SKW` | Skewered rod | 2-4°C | 15-30 kg |
| `FRZ` | Frozen | -25 to -18°C | 15-30 kg |
| `FG` | Finished goods | -22 to -18°C | 15-30 kg |

### Production Phases

```
0: START → 1: Receipt → 2: Deboning → 3: Buffer → 4: Mixing →
5: Skewering → 6: SKU Split → 7: Freezing → 8: Packaging →
9: Palletizing → 10: Shipment
```

### QC Gates & Decisions

- **Gate Types**: Receipt, Processing, Packaging, Shipment
- **CCP (Critical Control Point)**: Temperature-critical gates
- **Decisions**: `PASS`, `HOLD`, `FAIL`

```typescript
// HOLD/FAIL require notes (min 10 chars)
const qcDecisionSchema = z.object({
    decision: z.enum(['PASS', 'HOLD', 'FAIL']),
    notes: z.string().optional()
}).refine(
    (data) => data.decision === 'PASS' || (data.notes && data.notes.length >= 10),
    { message: 'Notes required for HOLD/FAIL (min 10 chars)' }
);
```

### Roles & Permissions

| Role | Permissions |
|------|-------------|
| `ADMIN` | Full system access, user management |
| `MANAGER` | Production oversight, QC overrides |
| `AUDITOR` | Read-only access to all data, audit logs |
| `OPERATOR` | Lot registration, QC decisions |
| `VIEWER` | Dashboard view only |

### HACCP Requirements

- All CCP gates must log temperature readings
- QC decisions are immutable (append-only audit log)
- Lot genealogy must be traceable end-to-end
- Time-temperature logs preserved for regulatory compliance

---

## 7. Database Standards

### Entity Naming (PostgreSQL/Supabase)

```sql
-- Primary keys: {entity}_id (UUID)
lots.lot_id UUID PRIMARY KEY
production_runs.run_id UUID PRIMARY KEY

-- Foreign keys: {referenced_entity}_id
lots.run_id REFERENCES production_runs(run_id)

-- Timestamps: {action}_at
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ

-- Booleans: is_{state}
is_active, is_ccp, is_closed

-- JSONB for flexible structures
config JSONB DEFAULT '{}'::jsonb
```

### Lot Genealogy Table

```sql
CREATE TABLE lot_genealogy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_lot_id UUID REFERENCES lots(lot_id),
    child_lot_id UUID REFERENCES lots(lot_id),
    quantity_used DECIMAL(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see lots from their assigned scenarios
CREATE POLICY "Users see own scenario lots" ON lots
    FOR SELECT USING (
        scenario_id IN (
            SELECT scenario_id FROM user_scenarios 
            WHERE user_id = auth.uid()
        )
    );
```

---

## 8. Git Workflow (Phase-Based)

### Branch Hierarchy

```
main (production) 🔒
  │
  └── develop (integration) 🔒
        │
        ├── phase/0-before-dev 🔒 (bootstrap - preserved)
        ├── phase/1-backend-migration
        ├── phase/2-frontend-enhancements
        └── phase/X-...
```

### Branch Protection

| Branch | Protection Level |
|--------|------------------|
| `main` | Strict: PR + 1 approval + CI + no force-push |
| `develop` | Moderate: PR + CI |
| `phase/*` | Light: No deletion (audit trail preserved) |

### Workflow Commands

```bash
# Create new phase branch
git checkout develop
git pull origin develop
git checkout -b phase/X-feature-name

# Conventional commit
git commit -m "feat(lots): add genealogy tracking"

# Push and create PR
git push -u origin phase/X-feature-name
gh pr create --base develop

# After merge to develop, sync main
gh pr create --base main --head develop --title "release: vX.Y.Z"
```

### Conventional Commits

| Type | Description |
|------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `refactor:` | Code change that neither fixes nor adds |
| `test:` | Adding or updating tests |
| `chore:` | Maintenance tasks |
| `ci:` | CI/CD changes |

---

## 9. API Standards

### RESTful Route Patterns

```python
# Collection
GET    /api/lots              # List lots
POST   /api/lots              # Create lot

# Resource
GET    /api/lots/{lot_id}     # Get lot
PUT    /api/lots/{lot_id}     # Update lot
DELETE /api/lots/{lot_id}     # Delete lot

# Sub-resources
GET    /api/lots/{lot_id}/children    # Get child lots
GET    /api/lots/{lot_id}/qc-decisions
```

### API Parity Validation

During migration, ensure response shape parity:

```python
# tests/characterization/test_lots_api.py
import pytest
from httpx import AsyncClient

@pytest.fixture
def golden_response():
    return {
        "lot_id": "uuid-pattern",
        "lot_code": "str-pattern",
        "lot_type": "RAW|DEB|BULK|MIX|SKW|FRZ|FG",
        "weight_kg": "decimal",
        "temperature_c": "decimal"
    }

async def test_get_lot_response_shape(client: AsyncClient, golden_response):
    """Validate response matches golden output shape."""
    response = await client.get("/api/lots/test-lot-id")
    assert response.status_code == 200
    assert_shape_matches(response.json(), golden_response)
```

---

## 10. Documentation Standards

### Architecture Decision Records (ADRs)

Location: `docs/decisions/NNNN-title.md`

```markdown
# ADR NNNN: [Title]

**Status:** Proposed | Accepted | Deprecated | Superseded
**Date:** YYYY-MM-DD
**Decision Makers:** [Names]

## Context
[Why is this decision needed?]

## Decision
[What is the change being proposed?]

## Alternatives Considered
[What other options were evaluated?]

## Consequences
[What are the trade-offs?]
```

### Specification Documents

All specifications should include:

1. **Constraints** — Hard requirements and limitations
2. **Research Options** — 3-5 alternatives considered
3. **Tradeoffs** — Cost/Risk/Time analysis
4. **MVP Decision** — Chosen approach with rationale
5. **Milestones** — Phased delivery plan
6. **Validation Checkpoints** — How to verify success

---

## 11. Testing Requirements

### Frontend (Playwright + Vitest)

```bash
# Run E2E tests
npm run test:e2e

# Run unit tests
npm run test:unit
```

### Backend (pytest)

```bash
# Run all tests
uv run pytest

# Run with coverage
uv run pytest --cov=src --cov-report=html

# Run characterization tests only
uv run pytest tests/characterization/
```

### Characterization Test Matrix

| Endpoint | Scenarios |
|----------|-----------|
| `GET /api/health` | Status code + JSON shape |
| `POST /api/login` | Valid/invalid credentials |
| `GET /api/traceability/{lot_code}` | Exists / Not found |
| `POST /api/lots` | Valid / Invalid schema |
| `POST /api/qc-decisions` | PASS / HOLD / FAIL |

---

## 12. Search Commands

**Use `rg` (ripgrep) instead of `grep`:**

```bash
# ❌ Don't use
grep -r "pattern" .

# ✅ Use instead
rg "pattern"
rg "pattern" --type ts
rg "pattern" -g "*.py"
```

---

## ⚠️ Critical Reminders

1. **NEVER assume** — Verify file paths and context before making changes
2. **Specification-first** — Document before implementing
3. **Phase branches are preserved** — Never delete them
4. **QC decisions are immutable** — Append-only audit log
5. **HACCP compliance** — Temperature logging at all CCPs
6. **API parity** — Validate response shapes during migration
7. **Test coverage** — No feature is complete without tests

---

## 🔗 Quick References

| Resource | Location |
|----------|----------|
| Architecture | [docs/architecture.md](docs/architecture.md) |
| Setup Guide | [docs/SETUP.md](docs/SETUP.md) |
| ADRs | [docs/decisions/](docs/decisions/) |
| Backend Plan | [docs/refactor/re/1_plan-BACKEND](docs/refactor/re/1_plan-BACKEND) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |

---

_This document is a living guide. Update it as the project evolves._
