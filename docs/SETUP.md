# Repository Setup Guide

This guide walks through the initial setup of the repository following the **Phase-Based Branching Model**.

---

## 1. Branch Structure Setup

### Quick Setup (Automated)

```bash
chmod +x scripts/setup-branches.sh
./scripts/setup-branches.sh
```

### Manual Setup

```bash
# Ensure you're on main with initial commit
git checkout main

# Create develop branch
git checkout -b develop
git checkout main

# Create phase/0 from develop
git checkout develop
git checkout -b phase/0-before-dev
```

### Push to Remote

```bash
git push -u origin main
git push -u origin develop
git push -u origin phase/0-before-dev
```

---

## 2. Branch Protection Rules (GitHub)

Navigate to **Settings → Branches → Add branch protection rule**

### `main` Branch (Strict)

| Setting | Value |
|---------|-------|
| Branch name pattern | `main` |
| Require a pull request before merging | ✅ |
| Required approving reviews | 1 (or 2 for teams) |
| Dismiss stale pull request approvals | ✅ |
| Require status checks to pass | ✅ |
| Required status checks | `All Tests Passed` |
| Require branches to be up to date | ✅ |
| Require linear history | ✅ (recommended) |
| Restrict who can push | ✅ (admins only) |
| Allow force pushes | ❌ |
| Allow deletions | ❌ |

### `develop` Branch (Moderate)

| Setting | Value |
|---------|-------|
| Branch name pattern | `develop` |
| Require a pull request before merging | ✅ |
| Required approving reviews | 0 or 1 |
| Require status checks to pass | ✅ |
| Required status checks | `All Tests Passed` |

### `phase/*` Branches (Light)

| Setting | Value |
|---------|-------|
| Branch name pattern | `phase/**` |
| Require a pull request before merging | ✅ |
| Require status checks to pass | ✅ |
| Allow deletions | ❌ (preserve for audit) |

---

## 3. Development Environment Setup

### Option A: DevContainer (Recommended)

1. **Prerequisites**: Docker Desktop, VS Code with Remote - Containers extension

2. **Open in Container**:
   ```bash
   # Clone the repository
   git clone https://github.com/w7-mgfcode/specs-wms-food-prod.git
   cd specs-wms-food-prod
   
   # Open in VS Code
   code .
   # Then: Ctrl+Shift+P → "Dev Containers: Reopen in Container"
   ```

3. **What's Included**:
   - Python 3.13 with UV package manager
   - Node.js 22 with pnpm
   - PostgreSQL 17 client tools
   - Pre-configured extensions (Pylance, ESLint, Prettier)

### Option B: Manual Setup

#### Backend (Python/FastAPI)

```bash
# Navigate to backend
cd backend

# Install UV (fast Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create virtual environment and install dependencies
uv venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

uv pip install -e ".[dev]"

# Start database services
docker compose -f docker/docker-compose.yml up -d postgres valkey

# Run database migrations
alembic upgrade head

# Start the API server
uvicorn app.main:app --reload --port 8000
```

#### Frontend (React/TypeScript)

```bash
# Navigate to frontend
cd flow-viz-react

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Environment Variables

Copy the example environment file and configure:

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp flow-viz-react/.env.example flow-viz-react/.env.local
```

**Required Backend Variables**:
```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/wms_food_prod
VALKEY_URL=valkey://localhost:6379/0
SECRET_KEY=your-secret-key-here
DEBUG=true
```

**Required Frontend Variables**:
```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

---

## 4. Docker Compose (Full Stack)

```bash
# Start all services
docker compose up -d

# Services available:
# - PostgreSQL 17:   localhost:5432
# - Valkey 8.1+:     localhost:6379
# - FastAPI:         localhost:8000
# - React (Vite):    localhost:5173
```

### Service Architecture

```
+------------------+     +------------------+
|   React (5173)   |---->|  FastAPI (8000)  |
+------------------+     +------------------+
                                  |
                    +-------------+-------------+
                    |                           |
             +------+------+             +------+------+
             | PostgreSQL  |             |   Valkey    |
             |    (5432)   |             |   (6379)    |
             +-------------+             +-------------+
```

---

## 5. GitHub Settings

### Enable Features

- **Settings → General → Features**
  - ✅ Issues
  - ✅ Projects
  - ✅ Discussions (optional)
  - ✅ Wiki (optional)

### Default Branch

- **Settings → General → Default branch**: `main`

### Merge Button Settings

- **Settings → General → Pull Requests**
  - ✅ Allow squash merging (for feature PRs)
  - ✅ Allow merge commits (for phase PRs)
  - ❌ Allow rebase merging (optional)
  - Default: Squash merge

---

## 6. Required Secrets (CI/CD)

Navigate to **Settings → Secrets and variables → Actions**

| Secret | Description | Required For |
|--------|-------------|--------------|
| `DIGITALOCEAN_HOST` | DO droplet IP | Deployment |
| `DIGITALOCEAN_SSH_KEY` | SSH private key | Deployment |
| `DIGITALOCEAN_USERNAME` | SSH username | Deployment |
| `DEPLOYMENT_PATH` | App path on server | Deployment |

---

## 7. Labels Setup

Create these labels for consistent PR/Issue management:

| Label | Color | Description |
|-------|-------|-------------|
| `phase-0` | `#0E8A16` | Bootstrap/setup work |
| `phase-1` | `#1D76DB` | Architecture work |
| `phase-2` | `#5319E7` | Core features |
| `bug` | `#D73A4A` | Something isn't working |
| `feature` | `#A2EEEF` | New feature request |
| `breaking` | `#B60205` | Breaking change |
| `docs` | `#0075CA` | Documentation |
| `ci` | `#FBCA04` | CI/CD related |

---

## 8. First Phase Workflow

```bash
# Start work on phase/0
git checkout phase/0-before-dev

# Make changes, commit with conventional commits
git add .
git commit -m "chore: add project configuration files"

# Push and create PR
git push -u origin phase/0-before-dev

# Create PR: phase/0-before-dev → develop
# After approval and CI pass, merge

# For release: create PR develop → main
# Tag the release
git checkout main
git pull
git tag -a v0.1.0 -m "Phase 0: Repository Bootstrap"
git push origin v0.1.0
```

---

## 9. Running Tests

### Backend Tests

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/characterization/test_lot_routes.py -v
```

### Frontend Tests

```bash
cd flow-viz-react

# Run unit tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run E2E tests (requires running app)
pnpm test:e2e
```

---

## Checklist

### Initial Setup
- [ ] Branch structure created (main, develop, phase/0)
- [ ] Branch protection rules configured
- [ ] CI workflow triggers on develop branch
- [ ] CODEOWNERS configured
- [ ] Required secrets added
- [ ] Labels created
- [ ] Initial phase-0 PR merged to develop

### Development Environment
- [ ] Docker Desktop installed
- [ ] VS Code with recommended extensions
- [ ] DevContainer opens successfully (or manual setup complete)
- [ ] PostgreSQL 17 running
- [ ] Valkey 8.1+ running
- [ ] Backend API starts on :8000
- [ ] Frontend dev server starts on :5173
- [ ] Environment variables configured

### Verification
- [ ] `curl http://localhost:8000/health` returns OK
- [ ] Frontend connects to API successfully
- [ ] Database migrations run without errors
- [ ] Tests pass locally
