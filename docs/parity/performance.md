# Performance Baselines

> API latency thresholds for Node/Express to FastAPI migration parity validation.
>
> **Status:** Active | **Version:** 1.0 | **Date:** 2026-01-18

---

## Overview

This document defines performance baselines for each API endpoint. These thresholds ensure that the FastAPI migration does not introduce performance regressions compared to the original Node/Express implementation.

**Measurement Methodology:**
- All measurements taken on development hardware (isolated Docker containers)
- Database: PostgreSQL 17 with test data fixtures
- Network: localhost (no network latency)
- Load: Single concurrent request (baseline, not load testing)

---

## Latency Thresholds by Endpoint

| Endpoint | P50 | P95 | P99 | Max | Notes |
|----------|-----|-----|-----|-----|-------|
| `GET /api/health` | 5ms | 20ms | 50ms | 100ms | No database access |
| `POST /api/login` | 50ms | 150ms | 300ms | 500ms | Includes bcrypt verification |
| `POST /api/lots` | 20ms | 80ms | 200ms | 400ms | Single INSERT operation |
| `POST /api/qc-decisions` | 20ms | 80ms | 200ms | 400ms | Single INSERT + validation |
| `GET /api/traceability/{lot_code}` | 30ms | 100ms | 250ms | 500ms | 3 JOINs (parents + children) |

---

## Threshold Rationale

### Health Endpoint
- **Complexity:** No database access, no authentication
- **Expected:** Sub-10ms response for healthy service
- **P99 Threshold:** 50ms allows for GC pauses and cold starts

### Login Endpoint
- **Complexity:** Database lookup + bcrypt password verification
- **Note:** bcrypt is intentionally slow (~100ms) for security
- **P99 Threshold:** 300ms accounts for bcrypt + potential retry

### Lots Endpoint
- **Complexity:** Single INSERT with Pydantic validation
- **Expected:** Fast write operation with RETURNING clause
- **P99 Threshold:** 200ms allows for database write latency

### QC Decisions Endpoint
- **Complexity:** Single INSERT with custom validation (notes check)
- **Expected:** Similar to lots endpoint
- **P99 Threshold:** 200ms accounts for validation overhead

### Traceability Endpoint
- **Complexity:** 3 database queries with JOINs
  - 1. Fetch central lot by lot_code
  - 2. Fetch parents via lot_genealogy JOIN
  - 3. Fetch children via lot_genealogy JOIN
- **P99 Threshold:** 250ms allows for complex genealogy trees

---

## Percentile Definitions

| Percentile | Meaning |
|------------|---------|
| **P50** | Median response time (50% of requests are faster) |
| **P95** | 95th percentile (only 5% of requests are slower) |
| **P99** | 99th percentile (only 1% of requests are slower) |
| **Max** | Absolute maximum acceptable response time |

---

## Regression Detection

A performance regression is detected when:

1. **P50 increases by >50%** - Indicates overall slowdown
2. **P99 exceeds threshold** - Indicates tail latency issues
3. **Max exceeds 2x threshold** - Indicates potential timeout risk

### Acceptable Variance

| Metric | Acceptable Variance |
|--------|---------------------|
| P50 | ±20% |
| P95 | ±30% |
| P99 | ±50% |

---

## Benchmark Test Strategy

### Local Development Benchmarks

```bash
# Using pytest-benchmark (optional dependency)
uv run pytest tests/performance/ --benchmark-only

# Expected output format:
# Name                          Mean      StdDev    Min       Max
# test_health_latency           2.3ms     0.5ms     1.8ms     4.2ms
# test_login_latency            85.2ms    12.3ms    72.1ms    112.5ms
```

### CI/CD Performance Gates

For CI/CD pipelines, use P95 thresholds as hard gates:

```yaml
# Example GitHub Actions job
- name: Performance Tests
  run: |
    uv run pytest tests/performance/ --benchmark-json=benchmark.json
    python scripts/check_performance.py benchmark.json
```

---

## Known Performance Differences

### FastAPI vs Node/Express

| Aspect | Node/Express | FastAPI | Impact |
|--------|--------------|---------|--------|
| Startup | Faster cold start | Slower cold start | One-time cost |
| JSON serialization | V8 native | Pydantic | +5-10ms overhead |
| Async I/O | Event loop | asyncio | Comparable |
| Database driver | pg (sync) | asyncpg (async) | FastAPI faster under load |

### Expected Improvements

- **Traceability:** FastAPI with async SQLAlchemy should be faster under concurrent load
- **Validation:** Pydantic validation may add 1-5ms overhead but catches errors earlier

---

## Monitoring in Production

### Recommended Metrics

```plaintext
# Prometheus metrics to track
http_request_duration_seconds{endpoint="/api/health", quantile="0.5"}
http_request_duration_seconds{endpoint="/api/health", quantile="0.95"}
http_request_duration_seconds{endpoint="/api/health", quantile="0.99"}
```

### Alerting Thresholds

| Alert | Condition | Action |
|-------|-----------|--------|
| Warning | P95 > threshold | Investigate |
| Critical | P99 > 2x threshold | Immediate investigation |
| Incident | Max > 5x threshold | Rollback consideration |

---

## Cutover Performance Criteria

Before cutover to FastAPI:

- [ ] All endpoints meet P99 thresholds in staging
- [ ] No P50 regressions >50% compared to Node/Express
- [ ] Load test (100 concurrent users) shows no degradation
- [ ] Memory usage stable under sustained load

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-18 | 1.0 | Initial performance baselines |

---

_Last updated: 2026-01-18 | Phase 2: API Parity Validation_
