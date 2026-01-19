#!/bin/bash
# Simple performance test for FastAPI endpoints

BASE_URL="http://localhost:8000"
REQUESTS=100

echo "=== FastAPI Performance Test ==="
echo "Running $REQUESTS requests per endpoint..."
echo ""

# Test health endpoint
echo "Testing GET /api/health..."
START=$(date +%s%N)
for i in $(seq 1 $REQUESTS); do
  curl -s "${BASE_URL}/api/health" > /dev/null
done
END=$(date +%s%N)
DURATION=$((($END - $START) / 1000000))  # Convert to milliseconds
HEALTH_AVG=$(($DURATION / $REQUESTS))
echo "  Total: ${DURATION}ms, Average: ${HEALTH_AVG}ms per request"
echo ""

# Test traceability endpoint with existing lot
echo "Testing GET /api/traceability/RAW-BEEF-001..."
START=$(date +%s%N)
for i in $(seq 1 $REQUESTS); do
  curl -s "${BASE_URL}/api/traceability/RAW-BEEF-001" > /dev/null
done
END=$(date +%s%N)
DURATION=$((($END - $START) / 1000000))
TRACE_AVG=$(($DURATION / $REQUESTS))
echo "  Total: ${DURATION}ms, Average: ${TRACE_AVG}ms per request"
echo ""

echo "=== Performance Summary ==="
echo "Health endpoint: ${HEALTH_AVG}ms average (Target P50: <5ms)"
echo "Traceability endpoint: ${TRACE_AVG}ms average (Target P50: <30ms)"
echo ""
echo "Note: These are sequential tests. Concurrent load tests would show true performance."
