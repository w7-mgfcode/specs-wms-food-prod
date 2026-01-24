#!/bin/bash
# Integration test for observability stack
# Run from backend/docker directory after docker compose up

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== FlowViz Observability Integration Tests ==="
echo ""

PASSED=0
FAILED=0

test_result() {
    if [ $1 -eq 0 ]; then
        echo "✓ $2"
        ((PASSED++))
    else
        echo "✗ $2"
        ((FAILED++))
    fi
}

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 5

# Test 1: FastAPI metrics endpoint
echo ""
echo "[1/6] Testing FastAPI /metrics endpoint..."
curl -sf http://localhost:8000/metrics | grep -q "http_requests" 2>/dev/null
test_result $? "FastAPI metrics endpoint"

# Test 2: Prometheus is running
echo "[2/6] Testing Prometheus health..."
curl -sf http://localhost:9090/-/ready 2>/dev/null
test_result $? "Prometheus health"

# Test 3: Prometheus is scraping targets
echo "[3/6] Testing Prometheus targets..."
curl -sf http://localhost:9090/api/v1/targets | grep -q "fastapi" 2>/dev/null
test_result $? "Prometheus scraping FastAPI"

# Test 4: Grafana is running
echo "[4/6] Testing Grafana health..."
curl -sf http://localhost:3001/api/health | grep -q "ok" 2>/dev/null
test_result $? "Grafana health"

# Test 5: PgBouncer is handling connections
echo "[5/6] Testing PgBouncer connectivity..."
PGPASSWORD=password psql -h localhost -p 6432 -U admin -d flowviz -c "SELECT 1" > /dev/null 2>&1
test_result $? "PgBouncer connectivity"

# Test 6: PostgreSQL exporter
echo "[6/6] Testing PostgreSQL exporter..."
curl -sf http://localhost:9187/metrics | grep -q "pg_up" 2>/dev/null
test_result $? "PostgreSQL exporter metrics"

# Summary
echo ""
echo "=== Test Summary ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "Some tests failed. Check service logs with:"
    echo "  docker compose logs <service_name>"
    exit 1
else
    echo "All integration tests passed! ✓"
    exit 0
fi
