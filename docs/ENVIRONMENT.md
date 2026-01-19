# Environment Variables

This document describes all environment variables used in the FlowViz WMS system.

---

## Frontend (Vite)

All frontend variables must be prefixed with `VITE_` to be exposed to the client.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | (empty) | API base URL. Empty in dev (uses Vite proxy). |
| `VITE_DB_MODE` | No | `mock` | Database mode: `mock`, `postgres`, `supabase` |
| `VITE_USE_MOCK` | No | `false` | Enable simulation mode |
| `VITE_SUPABASE_URL` | No | - | Supabase project URL (if using supabase mode) |
| `VITE_SUPABASE_ANON_KEY` | No | - | Supabase anonymous key (if using supabase mode) |

### Development (.env.development)

```bash
# Development uses Vite proxy - no explicit API URL needed
VITE_API_URL=
VITE_DB_MODE=postgres
```

### Production (.env.production)

```bash
# Production requires explicit API URL
VITE_API_URL=https://api.flowviz.example.com
VITE_DB_MODE=postgres
```

---

## Backend (FastAPI)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes (prod) | `postgresql+asyncpg://admin:password@localhost:5432/flowviz` | PostgreSQL connection string |
| `SECRET_KEY` | Yes (prod) | `INSECURE-DEV-ONLY-CHANGE-ME` | JWT signing key (min 32 chars in prod) |
| `JWT_ALGORITHM` | No | `HS256` | JWT algorithm |
| `JWT_EXPIRE_MINUTES` | No | `30` | JWT token expiry in minutes |
| `ALLOWED_ORIGINS` | No | `http://localhost:5173,http://localhost:3000` | Comma-separated CORS origins |
| `REDIS_URL` | No | `redis://localhost:6379/0` | Redis/Valkey connection URL |
| `CELERY_BROKER_URL` | No | `redis://localhost:6379/0` | Celery broker URL |
| `CELERY_RESULT_BACKEND` | No | `redis://localhost:6379/0` | Celery result backend URL |
| `DEBUG` | No | `true` | Enable debug mode |
| `ENVIRONMENT` | No | `development` | Environment name |

### Development

```bash
DATABASE_URL=postgresql+asyncpg://admin:password@localhost:5432/flowviz
SECRET_KEY=dev-secret-key-not-for-production
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
DEBUG=true
ENVIRONMENT=development
```

### Production

```bash
DATABASE_URL=postgresql+asyncpg://user:pass@prod-db:5432/flowviz
SECRET_KEY=<secure-random-string-min-32-chars>
ALLOWED_ORIGINS=https://flowviz.example.com,https://staging.flowviz.example.com
DEBUG=false
ENVIRONMENT=production
```

---

## Docker Compose

When using Docker Compose, environment variables can be set in:

1. `.env` file in the project root
2. `docker-compose.yml` environment section
3. Shell environment (exported variables)

### Example .env file

```bash
# Database
POSTGRES_USER=admin
POSTGRES_PASSWORD=password
POSTGRES_DB=flowviz

# Backend
SECRET_KEY=your-secure-secret-key
ALLOWED_ORIGINS=http://localhost:5173

# Redis/Valkey
REDIS_URL=redis://valkey:6379/0
```

---

## Security Notes

### Production Checklist

- [ ] `SECRET_KEY` is at least 32 characters and randomly generated
- [ ] `DEBUG=false` is set
- [ ] `ENVIRONMENT=production` is set
- [ ] `ALLOWED_ORIGINS` contains only trusted domains
- [ ] Database credentials are not using defaults
- [ ] No sensitive values are hardcoded or committed to version control

### Generating a Secure Secret Key

```bash
# Using Python
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Using OpenSSL
openssl rand -base64 32
```

---

## Related Documentation

- [Architecture Overview](architecture.md)
- [Error Handling Runbook](RUNBOOK.md)
- [Setup Guide](SETUP.md)
