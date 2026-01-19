# Phase 5 Staging Deployment Guide

**Version:** v0.5.0  
**Date:** 2026-01-19  
**Status:** Ready for Staging Deployment

---

## 📋 Pre-Deployment Checklist

### ✅ Completed
- [x] All tests passing (118/118) — See [Test Results](phase-5_test-results.md)
- [x] Code merged to `develop` branch
- [x] Documentation updated (README, architecture.md)
- [x] Phase 5 summary created
- [x] ADR-0003 documented
- [x] No critical linting errors

### 🔄 Pending
- [ ] Staging environment provisioned
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Valkey/Redis instance running
- [ ] SSL/TLS certificates configured
- [ ] Smoke tests executed

---

## 🏗️ Staging Environment Requirements

### Infrastructure

| Component | Requirement | Notes |
|-----------|-------------|-------|
| **Compute** | 2 vCPU, 4GB RAM | Minimum for staging |
| **Database** | PostgreSQL 17 | Port 5432 |
| **Cache** | Valkey 8.1+ or Redis 7+ | Port 6379 (rate limiting) |
| **Web Server** | Nginx or Caddy | Reverse proxy + SSL |
| **Python** | 3.12+ | FastAPI runtime |
| **Node.js** | 18+ | Frontend build |

### Network

- **Frontend:** Port 443 (HTTPS) or 80 (HTTP redirect)
- **Backend API:** Port 8000 (internal, proxied)
- **Database:** Port 5432 (internal only)
- **Cache:** Port 6379 (internal only)

---

## 🔧 Deployment Steps

### Step 1: Provision Staging Server

**Option A: Docker Compose (Recommended for Staging)**

```bash
# Clone repository
git clone https://github.com/w7-mgfcode/specs-wms-food-prod.git
cd specs-wms-food-prod
git checkout develop

# Start services
cd backend
docker compose -f docker/docker-compose.yml up -d

# Verify services
docker compose -f docker/docker-compose.yml ps
```

**Option B: Manual Setup**

```bash
# Install dependencies
sudo apt update
sudo apt install -y python3.12 python3-pip postgresql-17 redis-server nginx

# Create virtual environment
python3.12 -m venv venv
source venv/bin/activate
pip install -e ".[dev]"
```

---

### Step 2: Configure Environment Variables

Create `.env` file in `backend/` directory:

```bash
# Database
DATABASE_URL=postgresql+asyncpg://flowviz:flowviz@localhost:5432/flowviz_staging

# Redis/Valkey (for rate limiting)
REDIS_URL=redis://localhost:6379/0

# JWT Secret (CHANGE THIS!)
SECRET_KEY=your-staging-secret-key-min-32-chars-long

# CORS (Frontend URL)
ALLOWED_ORIGINS=https://staging.flowviz.example.com,http://localhost:5173

# Environment
ENVIRONMENT=staging

# Optional: Sentry, logging, etc.
# SENTRY_DSN=https://...
```

**⚠️ Security Notes:**
- Generate a strong `SECRET_KEY` (min 32 characters)
- Use environment-specific database credentials
- Restrict `ALLOWED_ORIGINS` to staging domain only

---

### Step 3: Database Setup

```bash
# Apply migrations
cd backend
alembic upgrade head

# Seed test data (optional for staging)
psql -h localhost -U flowviz -d flowviz_staging -f docker/init.sql
psql -h localhost -U flowviz -d flowviz_staging -f docker/seed_traceability.sql
```

**Verify:**
```bash
psql -h localhost -U flowviz -d flowviz_staging -c "SELECT COUNT(*) FROM users;"
# Expected: 2 users (admin, operator)
```

---

### Step 4: Start Backend API

**Option A: Docker (Recommended)**
```bash
cd backend
docker compose -f docker/docker-compose.yml up -d api
```

**Option B: Manual**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Verify:**
```bash
curl http://localhost:8000/api/health
# Expected: {"status": "ok", "version": "1.0.0"}
```

---

### Step 5: Build and Deploy Frontend

```bash
cd flow-viz-react

# Install dependencies
npm install

# Build for production
npm run build

# Serve with Nginx or Caddy
# (Copy dist/ to /var/www/flowviz-staging/)
```

**Nginx Configuration Example:**
```nginx
server {
    listen 80;
    server_name staging.flowviz.example.com;

    # Frontend
    root /var/www/flowviz-staging;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### Step 6: SSL/TLS Configuration

**Using Certbot (Let's Encrypt):**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d staging.flowviz.example.com
```

**Verify:**
```bash
curl https://staging.flowviz.example.com/api/health
```

---

## 🧪 Smoke Tests

### 1. Health Check
```bash
curl https://staging.flowviz.example.com/api/health
# Expected: {"status": "ok", "version": "1.0.0"}
```

### 2. Login (RBAC)
```bash
curl -X POST https://staging.flowviz.example.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@flowviz.com"}'
# Expected: 200 OK with JWT token
```

### 3. Rate Limiting
```bash
# Test login rate limit (10/min)
for i in {1..12}; do
  curl -X POST https://staging.flowviz.example.com/api/login \
    -H "Content-Type: application/json" \
    -d '{"email": "test@example.com"}' \
    -w "\nStatus: %{http_code}\n"
done
# Expected: First 10 succeed, 11th and 12th return 429
```

### 4. RBAC Enforcement
```bash
# Try to create lot without auth
curl -X POST https://staging.flowviz.example.com/api/lots \
  -H "Content-Type: application/json" \
  -d '{"lot_code": "TEST-001", "lot_type": "RAW", "weight_kg": 100, "temperature_c": 4}'
# Expected: 401 Unauthorized

# Try with VIEWER role (should fail)
TOKEN=$(curl -X POST https://staging.flowviz.example.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email": "viewer@flowviz.com"}' | jq -r '.token')

curl -X POST https://staging.flowviz.example.com/api/lots \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"lot_code": "TEST-001", "lot_type": "RAW", "weight_kg": 100, "temperature_c": 4}'
# Expected: 403 Forbidden with X-Required-Roles header
```

---

## 📊 Monitoring

### Application Logs
```bash
# Docker logs
docker logs flowviz_api_fastapi -f

# Manual deployment
tail -f /var/log/flowviz/app.log
```

### Database Connections
```bash
psql -h localhost -U flowviz -d flowviz_staging -c "SELECT count(*) FROM pg_stat_activity;"
```

### Redis/Valkey Status
```bash
redis-cli ping
# Expected: PONG

redis-cli info stats
# Check: total_commands_processed, keyspace_hits
```

---

## 🔄 Rollback Plan

If issues are detected in staging:

```bash
# Stop services
docker compose -f docker/docker-compose.yml down

# Rollback database (if needed)
alembic downgrade -1

# Checkout previous version
git checkout <previous-commit-hash>

# Restart services
docker compose -f docker/docker-compose.yml up -d
```

---

## ✅ Validation Checklist

After deployment, verify:

- [ ] Health endpoint responds (200 OK)
- [ ] Login works with test users
- [ ] Rate limiting enforced (429 after limit)
- [ ] RBAC blocks unauthorized actions (403)
- [ ] Frontend loads and connects to API
- [ ] Database migrations applied
- [ ] SSL/TLS certificate valid
- [ ] Logs show no errors
- [ ] All 5 user roles tested

---

## 📝 Next Steps

1. ✅ Deploy to staging
2. 🔄 Run smoke tests
3. 🔄 Perform manual QA testing
4. 🔄 Load testing (Phase 8b)
5. 📋 Production deployment planning

---

_Last Updated: 2026-01-19_

