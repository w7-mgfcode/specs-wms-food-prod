# FlowViz Backend (FastAPI)

FastAPI backend for the FlowViz Food Production WMS, migrated from Node/Express using the strangler pattern.

## Tech Stack

- **Python 3.13+**
- **FastAPI** - Web framework
- **SQLAlchemy 2.0** - Async ORM
- **PostgreSQL 17** - Database
- **Alembic** - Migrations
- **Pydantic v2** - Validation
- **bcrypt + python-jose** - Authentication
- **Valkey/Redis** - Caching
- **Celery** - Background tasks

## Quick Start

### Prerequisites

- Python 3.13+
- Docker & Docker Compose
- uv (recommended) or pip

### Development Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Create virtual environment and install dependencies
uv venv
source .venv/bin/activate  # Linux/Mac
# or: .venv\Scripts\activate  # Windows

uv pip install -e ".[dev]"

# 3. Copy environment file
cp .env.example .env

# 4. Start services with Docker
docker compose -f docker/docker-compose.yml up -d postgres valkey

# 5. Run migrations
alembic upgrade head

# 6. Start the development server
uvicorn app.main:app --reload --port 8000
```

### Docker Deployment

```bash
# Start all services (API + DB + Cache + Worker)
docker compose -f docker/docker-compose.yml up --build -d

# Check logs
docker compose -f docker/docker-compose.yml logs -f api

# Stop services
docker compose -f docker/docker-compose.yml down
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/login` | POST | User authentication |
| `/api/lots` | POST | Create new lot |
| `/api/qc-decisions` | POST | Record QC decision |
| `/api/traceability/{lot_code}` | GET | Get lot genealogy |

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=term-missing

# Run characterization tests only
pytest tests/characterization/ -v
```

## Code Quality

```bash
# Linting and formatting
ruff check . --fix
ruff format .

# Type checking
mypy app/
```

## Project Structure

```plaintext
backend/
├── app/
│   ├── api/
│   │   ├── routes/          # API endpoints
│   │   └── deps.py          # Dependencies (auth, db)
│   ├── models/              # SQLAlchemy models
│   ├── schemas/             # Pydantic schemas
│   ├── services/            # Business logic
│   ├── tasks/               # Celery background tasks
│   ├── config.py            # Settings
│   ├── database.py          # DB connection
│   ├── cache.py             # Redis/Valkey client
│   └── main.py              # FastAPI app
├── alembic/                 # Database migrations
├── tests/                   # Test suite
├── docker/                  # Docker configs
└── pyproject.toml           # Dependencies
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://...` |
| `SECRET_KEY` | JWT signing key | (required) |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `JWT_EXPIRE_MINUTES` | Token expiration | `30` |
| `REDIS_URL` | Valkey/Redis URL | `redis://localhost:6379/0` |
| `ENVIRONMENT` | Environment name | `development` |
| `DEBUG` | Enable debug mode | `true` |

## API Parity

This backend maintains 100% response shape parity with the original Node/Express server. All endpoints return identical JSON structures to ensure zero frontend changes during cutover.

See [PRPs/backend-migration-fastapi.md](../PRPs/backend-migration-fastapi.md) for the full migration specification.
