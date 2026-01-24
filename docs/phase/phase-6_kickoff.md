# Phase 6: Infrastructure Monitoring - Kickoff

**Branch**: `phase/6-infrastructure-monitoring`  
**Created**: 2026-01-19  
**Status**: 🚀 **In Progress**  
**Previous Phase**: Phase 5 (Security Hardening - v0.5.0)

---

## 🎯 Phase 6 Objectives

### Primary Goals

1. **PgBouncer Connection Pooling**
   - Deploy PgBouncer for 10x connection capacity improvement
   - Enable 1000+ concurrent connections
   - Protect PostgreSQL from connection exhaustion
   - Support horizontal scaling of API instances

2. **Prometheus + Grafana Observability**
   - Implement RED method monitoring (Rate, Errors, Duration)
   - Custom business metrics (lot registration, QC decisions, production throughput)
   - Alerting for critical thresholds
   - Production-ready dashboards

---

## 📋 Success Criteria

- [ ] PgBouncer deployed and handling all database connections
- [ ] Connection pool supports 1000+ concurrent clients
- [ ] FastAPI `/metrics` endpoint exposes Prometheus metrics
- [ ] Grafana dashboards operational with RED metrics + business KPIs
- [ ] Alerting configured for critical thresholds:
  - Error rate >5%
  - Latency >1s
  - P99 >500ms
- [ ] P99 latency <500ms under load
- [ ] All existing tests continue to pass (118/118)
- [ ] Docker Compose stack starts cleanly with new services

---

## 📚 Available Resources

### PRP Document

**File**: `PRPs/phase6-infrastructure-pgbouncer-prometheus-grafana.md` (1,186 lines)

**Contents**:
- PgBouncer configuration and deployment
- Prometheus metrics instrumentation
- Grafana dashboard templates
- Alerting rules
- Docker Compose integration
- Testing strategies

### Specification Document

**File**: `INITIAL-7b.md` (464 lines)

**Contents**:
- Monitoring stack architecture
- Metrics collection strategy
- Dashboard design
- Alerting philosophy

---

## 🏗️ Implementation Plan

### Step 1: PgBouncer Setup

**Tasks**:
1. Add PgBouncer service to Docker Compose
2. Configure connection pooling (pool_mode=transaction)
3. Update DATABASE_URL to point to PgBouncer
4. Test connection pooling with load tests
5. Document configuration and tuning

**Files to Modify**:
- `backend/docker/docker-compose.yml`
- `backend/app/config.py`
- `backend/app/database.py`

**New Files**:
- `backend/docker/pgbouncer/pgbouncer.ini`
- `backend/docker/pgbouncer/userlist.txt`

### Step 2: Prometheus Metrics

**Tasks**:
1. Add `prometheus-fastapi-instrumentator` dependency
2. Instrument FastAPI app with metrics
3. Add custom business metrics (lots, QC decisions)
4. Expose `/metrics` endpoint
5. Add Prometheus service to Docker Compose

**Files to Modify**:
- `backend/pyproject.toml`
- `backend/app/main.py`
- `backend/app/api/routes/lots.py`
- `backend/app/api/routes/qc.py`

**New Files**:
- `backend/app/metrics.py`
- `backend/docker/prometheus/prometheus.yml`

### Step 3: Grafana Dashboards

**Tasks**:
1. Add Grafana service to Docker Compose
2. Create RED method dashboard
3. Create business metrics dashboard
4. Configure data sources
5. Export dashboard JSON

**New Files**:
- `backend/docker/grafana/dashboards/red-metrics.json`
- `backend/docker/grafana/dashboards/business-metrics.json`
- `backend/docker/grafana/provisioning/datasources.yml`
- `backend/docker/grafana/provisioning/dashboards.yml`

### Step 4: Alerting

**Tasks**:
1. Configure Prometheus alerting rules
2. Set up AlertManager (optional)
3. Test alert triggers
4. Document alert runbook

**New Files**:
- `backend/docker/prometheus/alerts.yml`
- `docs/runbooks/alerts.md`

### Step 5: Testing & Documentation

**Tasks**:
1. Load test with 1000+ concurrent connections
2. Verify metrics accuracy
3. Test alert triggers
4. Update documentation
5. Create Phase 6 summary

**Files to Create**:
- `docs/phase/phase-6_infrastructure-monitoring.md`
- `docs/MONITORING.md`

---

## 🔧 Technical Details

### PgBouncer Configuration

**Pool Mode**: `transaction` (best for FastAPI async)  
**Max Client Connections**: 1000  
**Default Pool Size**: 20 per database  
**Reserve Pool Size**: 5

### Prometheus Metrics

**RED Metrics**:
- `http_requests_total` - Request rate
- `http_request_duration_seconds` - Latency (P50, P95, P99)
- `http_requests_errors_total` - Error rate

**Business Metrics**:
- `lots_created_total` - Lot registration rate
- `qc_decisions_total{decision="PASS|HOLD|FAIL"}` - QC decision rate
- `active_operators` - Current logged-in operators
- `production_runs_active` - Active production runs

### Grafana Dashboards

**Dashboard 1: RED Metrics**
- Request rate (requests/sec)
- Error rate (%)
- Latency (P50, P95, P99)
- Status code distribution

**Dashboard 2: Business Metrics**
- Lots created per hour
- QC decisions per hour
- Active operators
- Production run status

---

## 📊 Current State

### Branch Information

```
Branch: phase/6-infrastructure-monitoring
Base: develop (0549174)
Status: ✅ Up to date with origin
Working Tree: Clean
```

### Existing Infrastructure

- ✅ PostgreSQL 17 (port 5433)
- ✅ Valkey/Redis (port 6379) - for rate limiting
- ✅ FastAPI backend (port 8000)
- ✅ Celery worker (background tasks)

### New Services to Add

- 🔄 PgBouncer (port 6432)
- 🔄 Prometheus (port 9090)
- 🔄 Grafana (port 3001)

---

## 🎯 Next Steps

### Immediate Actions

1. ✅ **Create phase/6 branch** - COMPLETE
2. 🔄 **Review PRP document** - Read `PRPs/phase6-infrastructure-pgbouncer-prometheus-grafana.md`
3. 🔄 **Add PgBouncer service** - Update Docker Compose
4. 🔄 **Configure connection pooling** - Update database.py
5. 🔄 **Test PgBouncer** - Verify connection pooling works

### Follow-up Tasks

6. 🔄 Add Prometheus instrumentation
7. 🔄 Add Grafana dashboards
8. 🔄 Configure alerting
9. 🔄 Load testing
10. 🔄 Documentation

---

## 🔗 Related Documentation

- **PRP**: `PRPs/phase6-infrastructure-pgbouncer-prometheus-grafana.md` (1,186 lines)
- **Spec**: `INITIAL-7b.md` (464 lines)
- **Git Workflow**: `docs/GIT-WORKFLOW.md`
- **Architecture**: `docs/architecture.md`

---

## ⚠️ Important Notes

### Backward Compatibility

- ✅ All existing tests must continue to pass (118/118)
- ✅ No breaking changes to API endpoints
- ✅ Frontend requires no changes
- ✅ Existing environment variables remain valid

### Performance Targets

- **P99 Latency**: <500ms under load
- **Connection Pool**: Support 1000+ concurrent clients
- **Error Rate**: <1% under normal load
- **Uptime**: 99.9% availability

---

_Created: 2026-01-19 | Branch: phase/6-infrastructure-monitoring_

