# Cutover Checklist

> Node/Express to FastAPI migration cutover and rollback procedures.
>
> **Status:** Active | **Version:** 1.0 | **Date:** 2026-01-18

---

## Overview

This checklist defines the steps required to safely switch production traffic from the Node/Express backend to the FastAPI backend, including validation gates and rollback procedures.

---

## Pre-Cutover Checklist

### Parity Validation

- [ ] All characterization tests pass (`pytest tests/characterization/ -v`)
- [ ] Snapshot diffs are clean (no unreviewed changes)
- [ ] All 5 endpoints have documented response contracts
- [ ] Negative test coverage complete for all error scenarios
- [ ] JSON diff artifacts reviewed and approved in PR

### Performance Validation

- [ ] All endpoints meet P99 latency thresholds
- [ ] No P50 regressions >50% vs Node/Express
- [ ] Memory usage stable under sustained load
- [ ] Database connection pooling configured correctly

### Environment Readiness

- [ ] FastAPI container builds successfully (`docker build`)
- [ ] Environment variables configured in production
- [ ] Database migrations applied (`alembic upgrade head`)
- [ ] Health check endpoint responding (`/api/health`)
- [ ] Logging and monitoring configured
- [ ] Secrets rotated (JWT_SECRET_KEY different from dev)

### Rollback Preparation

- [ ] Node/Express container still available and tagged
- [ ] Rollback script tested in staging
- [ ] Database is backward compatible (no breaking migrations)
- [ ] Team aware of rollback procedure

---

## Cutover Procedure

### Phase 1: Final Validation (T-1 hour)

```bash
# 1. Run full test suite against staging
uv run pytest tests/characterization/ -v --tb=short

# 2. Verify health endpoint
curl https://staging.flowviz.com/api/health
# Expected: {"status": "ok", "timestamp": "..."}

# 3. Test key flows manually
# - Login with test user
# - Create a lot
# - Record a QC decision
# - Query traceability
```

- [ ] All tests pass in staging
- [ ] Manual smoke tests successful
- [ ] On-call engineer notified

### Phase 2: Traffic Switch (T-0)

```bash
# Switch reverse proxy/load balancer to FastAPI
# Example: nginx configuration update

# Before (Node/Express)
# upstream backend {
#     server node-express:3000;
# }

# After (FastAPI)
# upstream backend {
#     server fastapi:8000;
# }

# Reload nginx
nginx -s reload
```

- [ ] Load balancer updated to route to FastAPI (port 8000)
- [ ] DNS TTL considered (if applicable)
- [ ] Traffic switch confirmed in logs

### Phase 3: Monitoring (T+0 to T+15 min)

```bash
# Monitor error rates
# Example: Datadog/Prometheus query
rate(http_requests_total{status=~"5.."}[5m])

# Monitor latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

- [ ] Error rate < 0.1%
- [ ] P99 latency within thresholds
- [ ] No 5xx errors in logs
- [ ] User-facing functionality verified

### Phase 4: Verification (T+15 min)

- [ ] Login flow working for real users
- [ ] Lot creation successful
- [ ] QC decisions recording correctly
- [ ] Traceability queries returning expected data
- [ ] No customer complaints received

---

## Rollback Procedure

### Trigger Conditions

Initiate rollback if ANY of the following occur:

1. Error rate > 1% for more than 5 minutes
2. P99 latency > 2x threshold for more than 10 minutes
3. Critical functionality broken (login, lot creation, etc.)
4. Data integrity issues detected

### Rollback Steps

```bash
# 1. Switch traffic back to Node/Express
# Update load balancer configuration

# Before (FastAPI)
# upstream backend {
#     server fastapi:8000;
# }

# After (Node/Express)
# upstream backend {
#     server node-express:3000;
# }

# Reload nginx
nginx -s reload

# 2. Verify Node/Express is responding
curl https://api.flowviz.com/api/health
# Expected: {"status": "ok", "timestamp": "..."}

# 3. Monitor for stabilization
# Check error rates and latency for 5 minutes
```

- [ ] Traffic switched back to Node/Express (port 3000)
- [ ] Node/Express responding to health checks
- [ ] Error rate normalized
- [ ] Stakeholders notified of rollback

### Post-Rollback

- [ ] Document failure reason
- [ ] Capture logs and metrics
- [ ] Create post-mortem ticket
- [ ] Plan remediation before next attempt

---

## Post-Cutover Checklist

### Immediate (T+0 to T+1 hour)

- [ ] All endpoints functioning correctly
- [ ] No unexpected errors in logs
- [ ] Performance within baselines
- [ ] Monitoring dashboards green

### Short-term (T+1 to T+24 hours)

- [ ] Monitor error rates continuously
- [ ] Compare performance metrics to baseline
- [ ] Verify background jobs (Celery) if applicable
- [ ] Check database connection pool health

### Medium-term (T+24 hours to T+1 week)

- [ ] Analyze usage patterns and performance trends
- [ ] Address any minor issues discovered
- [ ] Update documentation with production learnings
- [ ] Plan Node/Express retirement

### Retirement (T+2 weeks)

- [ ] Confirm no traffic to Node/Express for 1+ week
- [ ] Schedule Node/Express container removal
- [ ] Archive Node/Express codebase
- [ ] Update architecture documentation

---

## Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| On-call Engineer | TBD | Slack: #flowviz-oncall |
| Platform Lead | TBD | Slack: #platform |
| Database Admin | TBD | Slack: #database |

---

## Rollback Decision Matrix

| Symptom | Severity | Action |
|---------|----------|--------|
| Single 5xx error | Low | Monitor, no action |
| Error rate > 0.5% | Medium | Investigate, prepare rollback |
| Error rate > 1% for 5 min | High | Initiate rollback |
| P99 > 2x threshold | Medium | Investigate root cause |
| Login failing | Critical | Immediate rollback |
| Data corruption | Critical | Immediate rollback + incident |

---

## Validation Scripts

### Health Check Script

```bash
#!/bin/bash
# health_check.sh

ENDPOINT="${1:-https://api.flowviz.com/api/health}"
MAX_RETRIES=5
RETRY_DELAY=2

for i in $(seq 1 $MAX_RETRIES); do
    response=$(curl -s -o /dev/null -w "%{http_code}" "$ENDPOINT")
    if [ "$response" = "200" ]; then
        echo "Health check passed (attempt $i)"
        exit 0
    fi
    echo "Health check failed (attempt $i), retrying in ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
done

echo "Health check failed after $MAX_RETRIES attempts"
exit 1
```

### Quick Smoke Test Script

```bash
#!/bin/bash
# smoke_test.sh

BASE_URL="${1:-https://api.flowviz.com}"

echo "Testing health endpoint..."
curl -s "$BASE_URL/api/health" | jq .

echo "Testing login endpoint..."
curl -s -X POST "$BASE_URL/api/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "test@flowviz.com"}' | jq .

echo "Testing lot creation..."
curl -s -X POST "$BASE_URL/api/lots" \
    -H "Content-Type: application/json" \
    -d '{"lot_code": "SMOKE-TEST-001", "lot_type": "RAW"}' | jq .

echo "Smoke tests complete"
```

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-18 | 1.0 | Initial cutover checklist |

---

_Last updated: 2026-01-18 | Phase 2: API Parity Validation_
