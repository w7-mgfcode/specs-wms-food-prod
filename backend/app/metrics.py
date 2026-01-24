"""Prometheus metrics for FlowViz WMS.

Business metrics for lot registration, QC decisions, and traceability queries.
Follows RED method: Rate, Errors, Duration.
"""

from prometheus_client import Counter, Gauge, Histogram

# --- Business Metrics ---

lots_registered_total = Counter(
    "flowviz_lots_registered_total",
    "Total number of lots registered in the system",
    ["lot_type"],  # Labels: RAW, DEB, BULK, MIX, SKW, FRZ, FG
)

qc_decisions_total = Counter(
    "flowviz_qc_decisions_total",
    "Total QC decisions made",
    ["decision"],  # Labels: PASS, HOLD, FAIL
)

traceability_query_duration = Histogram(
    "flowviz_traceability_query_duration_seconds",
    "Time spent processing traceability queries",
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

# --- Operational Metrics ---

active_operators = Gauge(
    "flowviz_active_operators",
    "Number of operators active in last 15 minutes",
)

pending_sync_lots = Gauge(
    "flowviz_pending_sync_lots",
    "Number of lots pending offline sync",
)

# --- Database Metrics ---

db_pool_connections_active = Gauge(
    "flowviz_db_pool_connections_active",
    "Active database connections in pool",
)

db_pool_connections_idle = Gauge(
    "flowviz_db_pool_connections_idle",
    "Idle database connections in pool",
)
