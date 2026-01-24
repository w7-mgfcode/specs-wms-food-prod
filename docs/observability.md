# FlowViz Observability Guide

## Overview

FlowViz uses Prometheus + Grafana for monitoring with the RED method:
- **R**ate: Request throughput
- **E**rrors: Error rate percentage  
- **D**uration: Latency percentiles (P50, P95, P99)

## Quick Start

```bash
# Start the full observability stack
cd backend/docker
docker compose up -d

# Verify all services
./test-observability.sh
```

## Accessing Dashboards

| Service | URL | Credentials |
|---------|-----|-------------|
| **Grafana** | http://localhost:3001 | admin / admin |
| **Prometheus** | http://localhost:9090 | (no auth) |
| **FastAPI Metrics** | http://localhost:8000/metrics | (no auth) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Compose Stack                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────┐    ┌───────────┐    ┌────────────┐               │
│   │ FastAPI │───▶│ PgBouncer │───▶│ PostgreSQL │               │
│   │   API   │    │  (6432)   │    │   (5433)   │               │
│   └────┬────┘    └───────────┘    └────────────┘               │
│        │                                                         │
│        │ /metrics                                                │
│        ▼                                                         │
│   ┌─────────────┐         ┌─────────────────────┐              │
│   │ Prometheus  │────────▶│ postgres-exporter   │              │
│   │   (9090)    │         │     (9187)          │              │
│   └──────┬──────┘         └─────────────────────┘              │
│          │                                                       │
│          ▼                                                       │
│   ┌─────────────┐                                               │
│   │   Grafana   │   ◀── Dashboards + Alerts                    │
│   │   (3001)    │                                               │
│   └─────────────┘                                               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Custom Metrics

### Business Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `flowviz_lots_registered_total` | Counter | lot_type | Total lots registered (raw, intermediate, finished) |
| `flowviz_qc_decisions_total` | Counter | decision | QC decisions by outcome (PASS, HOLD, FAIL) |
| `flowviz_traceability_query_duration_seconds` | Histogram | - | Traceability query latency distribution |
| `flowviz_active_operators` | Gauge | - | Active operators in last 15 minutes |
| `flowviz_pending_sync_lots` | Gauge | - | Lots pending offline sync |

### Database Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `flowviz_db_pool_connections_active` | Gauge | Active connections in pool |
| `flowviz_db_pool_connections_idle` | Gauge | Idle connections in pool |

### HTTP Metrics (Auto-generated)

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by method, path, status |
| `http_request_duration_seconds` | Histogram | Request latency distribution |
| `http_requests_inprogress` | Gauge | Requests currently being processed |

## Grafana Dashboards

### Application Dashboard
- Request rate over time
- Error rate percentage (5xx)
- P99 latency trends
- Lots registered per hour
- QC decisions breakdown (pie chart)
- Traceability query duration

## Alerting Rules

### Critical Alerts

| Alert | Condition | Duration |
|-------|-----------|----------|
| HighErrorRate | Error rate > 5% | 2 minutes |
| HighLatencyP99 | P99 latency > 500ms | 5 minutes |
| DatabaseDown | postgres-exporter unreachable | 1 minute |
| APIDown | FastAPI unreachable | 1 minute |

### Business Alerts

| Alert | Condition | Duration |
|-------|-----------|----------|
| HighQCFailureRate | QC failure rate > 10% | 1 hour |
| NoLotsRegistered | No lots registered | 2 hours |

## PgBouncer Connection Pooling

### Configuration

- **Pool Mode:** transaction (connection returned after each transaction)
- **Max Client Connections:** 1000
- **Default Pool Size:** 25
- **Reserve Pool:** 5 extra connections for burst

### Monitoring PgBouncer

```bash
# Connect to PgBouncer admin console
PGPASSWORD=password psql -h localhost -p 6432 -U admin pgbouncer

# Show pool status
SHOW POOLS;

# Show client connections
SHOW CLIENTS;

# Show server connections
SHOW SERVERS;

# Show stats
SHOW STATS;
```

## Prometheus Queries

### Common PromQL Queries

```promql
# Request rate per second
sum(rate(http_requests_total[5m]))

# Error rate percentage
sum(rate(http_requests_total{status=~"5.."}[5m])) 
/ sum(rate(http_requests_total[5m])) * 100

# P99 latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Lots registered in last hour by type
sum by (lot_type) (increase(flowviz_lots_registered_total[1h]))

# QC pass rate
sum(rate(flowviz_qc_decisions_total{decision="PASS"}[1h]))
/ sum(rate(flowviz_qc_decisions_total[1h])) * 100
```

## Troubleshooting

### Prometheus Not Scraping

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'

# Check API metrics endpoint
curl http://localhost:8000/metrics | head -20
```

### Grafana Dashboard Empty

1. Check Prometheus datasource: http://localhost:3001/datasources
2. Verify Prometheus is scraping: http://localhost:9090/targets
3. Check for data: Run query in Prometheus UI

### PgBouncer Connection Issues

```bash
# Check PgBouncer logs
docker logs flowviz_pgbouncer

# Verify direct PostgreSQL access
PGPASSWORD=password psql -h localhost -p 5433 -U admin -d flowviz -c "SELECT 1"

# Verify PgBouncer access
PGPASSWORD=password psql -h localhost -p 6432 -U admin -d flowviz -c "SELECT 1"
```

## Data Retention

| Component | Retention | Storage |
|-----------|-----------|---------|
| Prometheus | 30 days | Docker volume (prometheus_data) |
| Grafana | Permanent | Docker volume (grafana_data) |

To adjust Prometheus retention:
```yaml
# In docker-compose.yml
command:
  - '--storage.tsdb.retention.time=30d'  # Change as needed
```

## Best Practices

### DO

- Use low-cardinality labels (lot_type, decision, status)
- Monitor the RED metrics: Rate, Errors, Duration
- Set up alerts for business-critical thresholds
- Use histograms for latency tracking

### DON'T

- Use high-cardinality labels (lot_code, user_id, timestamps)
- Connect directly to PostgreSQL when PgBouncer is available
- Expose metrics endpoints without considering security
- Ignore alert fatigue - tune thresholds appropriately

## Related Documentation

- [Disaster Recovery Runbook](runbooks/disaster-recovery.md)
- [Phase 6 Status](phase/phase-6_infrastructure-status.md)
