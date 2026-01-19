# Production Deployment: Load Testing & Pilot Launch

> **Phase:** 4.3b - Load Testing & Pilot  
> **Sprint:** Week 9-10  
> **Priority:** HIGH (Production gate)  
> **Date:** January 19, 2026  
> **Version:** 1.0  
> **Prerequisite:** INITIAL-8a.md (Cloud Infrastructure)

---

## FEATURE:

Execute comprehensive load testing and controlled pilot launch for the Food Production WMS:

1. **Load Testing:** Simulate 20k lots/day (2x production target) to verify P99 <500ms, error rate <0.1%

2. **Deployment Scripts:** Blue-green deployment with zero-downtime and 15-minute rollback capability

3. **Pilot Launch:** Shadow mode comparison, operator training, real-time monitoring

**Success Criteria:**
- Load test passed: 20k lots/day sustained for 1 hour
- P99 latency <500ms, error rate <0.1%
- Rollback tested and documented (<15 minutes recovery)
- Operators trained (2-hour session completed)

---

## TOOLS:

- **asyncio.gather(*tasks)**: Python async parallel execution for concurrent HTTP requests

- **httpx.AsyncClient**: Async HTTP client with connection pooling for load testing

- **Locust**: Realistic user behavior simulation for load testing

---

## IMPLEMENTATION:

### Load Test Script

```python
# backend/tests/load_test.py
"""
Load testing script for FlowViz WMS.
Target: 20k lots/day = ~1 lot every 4 seconds during 8-hour shift
Test: 2x capacity (40k lots compressed to 1 hour)
"""
import asyncio
import httpx
import time
import json
from datetime import datetime
from statistics import mean, stdev
from dataclasses import dataclass
from typing import List, Tuple
import random


@dataclass
class LoadTestResult:
    total_requests: int
    successful: int
    failed: int
    duration_seconds: float
    latencies: List[float]
    errors: List[str]
    
    @property
    def success_rate(self) -> float:
        return self.successful / self.total_requests * 100
    
    @property
    def p99(self) -> float:
        return sorted(self.latencies)[int(len(self.latencies) * 0.99)]


async def create_lot(client: httpx.AsyncClient, token: str, lot_num: int) -> Tuple[int, float, str]:
    """Simulate single lot registration."""
    start = time.time()
    try:
        resp = await client.post(
            "/api/v1/lots",
            json={
                "lot_code": f"LOAD-{datetime.now():%Y%m%d}-{lot_num:08d}",
                "lot_type": random.choice(["RAW", "WIP", "FINISHED"]),
                "weight_kg": round(random.uniform(10, 500), 2),
                "temperature_c": round(random.uniform(2, 8), 1),
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        return resp.status_code, time.time() - start, ""
    except Exception as e:
        return 0, time.time() - start, str(e)


async def load_test(
    base_url: str = "http://localhost:8000",
    total_requests: int = 20000,
    concurrency: int = 100,
) -> LoadTestResult:
    """Execute load test simulating production traffic."""
    print(f"=== FlowViz Load Test ===")
    print(f"Target: {total_requests} requests, Concurrency: {concurrency}")
    
    latencies, errors = [], []
    successful = 0
    
    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:
        # Authenticate
        resp = await client.post("/api/login", json={
            "email": "load-test@flowviz.com",
            "password": "load-test-password"
        })
        token = resp.json()["access_token"]
        
        start_time = time.time()
        batch_size = min(concurrency, total_requests // 100)
        
        for batch_num in range(total_requests // batch_size):
            tasks = [create_lot(client, token, batch_num * batch_size + i) 
                     for i in range(batch_size)]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for result in results:
                if isinstance(result, Exception):
                    errors.append(str(result))
                else:
                    status, duration, error = result
                    latencies.append(duration)
                    if status == 201:
                        successful += 1
                    elif error:
                        errors.append(error)
            
            await asyncio.sleep(0.1)
    
    return LoadTestResult(
        total_requests=total_requests,
        successful=successful,
        failed=total_requests - successful,
        duration_seconds=time.time() - start_time,
        latencies=latencies,
        errors=errors[:100],
    )


def print_results(result: LoadTestResult):
    """Print formatted load test results."""
    print(f"\n{'='*50}")
    print(f"Success Rate: {result.success_rate:.2f}%")
    print(f"P99 Latency: {result.p99*1000:.0f}ms")
    
    passed = result.success_rate >= 99.9 and result.p99 <= 0.5
    print(f"VERDICT: {'✅ PASSED' if passed else '❌ FAILED'}")


if __name__ == "__main__":
    result = asyncio.run(load_test())
    print_results(result)
```

### Locust Configuration

```python
# backend/tests/locustfile.py
from locust import HttpUser, task, between
import random


class OperatorUser(HttpUser):
    """Simulates factory floor operator behavior."""
    wait_time = between(2, 5)
    
    def on_start(self):
        response = self.client.post("/api/login", json={
            "email": f"operator{random.randint(1, 10)}@factory.local",
            "password": "operator-password"
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.lot_codes = []
    
    @task(10)
    def register_lot(self):
        lot_code = f"LOT-{random.randint(100000, 999999)}"
        response = self.client.post("/api/v1/lots", 
            json={
                "lot_code": lot_code,
                "lot_type": random.choice(["RAW", "WIP", "FINISHED"]),
                "weight_kg": round(random.uniform(50, 500), 2),
            },
            headers=self.headers,
            name="/api/v1/lots"
        )
        if response.status_code == 201:
            self.lot_codes.append(lot_code)
    
    @task(5)
    def make_qc_decision(self):
        if not self.lot_codes:
            return
        self.client.post("/api/v1/qc-decisions",
            json={
                "lot_code": random.choice(self.lot_codes[-10:]),
                "gate_id": random.randint(1, 7),
                "decision": random.choices(["PASS", "HOLD", "FAIL"], [85, 10, 5])[0],
            },
            headers=self.headers
        )
    
    @task(1)
    def traceability_query(self):
        if self.lot_codes:
            self.client.get(f"/api/v1/traceability/{random.choice(self.lot_codes)}",
                headers=self.headers)
```

---

### Deployment Scripts

**Pre-Launch Checklist:**
```bash
#!/bin/bash
# backend/scripts/pre-launch-check.sh
set -e

FAILED=0

check() {
    printf "%-50s" "$1..."
    if eval "$2" > /dev/null 2>&1; then
        echo "✅ PASS"
    else
        echo "❌ FAIL"
        FAILED=$((FAILED + 1))
    fi
}

echo "=== Infrastructure Checks ==="
check "API health endpoint" "curl -sf http://localhost:8000/health"
check "PostgreSQL connection" "pg_isready -h localhost -p 5432"
check "Redis connection" "redis-cli ping | grep -q PONG"
check "Prometheus scraping" "curl -sf http://localhost:9090/api/v1/targets | grep -q up"

echo ""
echo "=== Application Checks ==="
check "Database migrations current" "cd backend && alembic current | grep -q head"
check "All services healthy" "docker ps | grep -c healthy | grep -q 4"

echo ""
if [ $FAILED -eq 0 ]; then
    echo "✅ All checks passed!"
    exit 0
else
    echo "❌ $FAILED check(s) failed."
    exit 1
fi
```

**Blue-Green Deployment:**
```bash
#!/bin/bash
# backend/scripts/deploy-blue-green.sh
set -euo pipefail

ENVIRONMENT="${1:-production}"
ALB_ARN=$(aws elbv2 describe-load-balancers --names "flowviz-alb-${ENVIRONMENT}" --query 'LoadBalancers[0].LoadBalancerArn' --output text)

CURRENT_TG=$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --query 'Listeners[0].DefaultActions[0].TargetGroupArn' --output text)
if [[ "$CURRENT_TG" == *"blue"* ]]; then
    NEW_TG_NAME="flowviz-green-${ENVIRONMENT}"
else
    NEW_TG_NAME="flowviz-blue-${ENVIRONMENT}"
fi

NEW_TG_ARN=$(aws elbv2 describe-target-groups --names "$NEW_TG_NAME" --query 'TargetGroups[0].TargetGroupArn' --output text)

echo "Deploying to $NEW_TG_NAME..."

# Wait for healthy instances
while true; do
    HEALTHY=$(aws elbv2 describe-target-health --target-group-arn "$NEW_TG_ARN" --query 'TargetHealthDescriptions[?TargetHealth.State==`healthy`] | length(@)')
    [ "$HEALTHY" -ge 2 ] && break
    sleep 30
done

# Switch traffic
LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --query 'Listeners[0].ListenerArn' --output text)
aws elbv2 modify-listener --listener-arn "$LISTENER_ARN" --default-actions "Type=forward,TargetGroupArn=$NEW_TG_ARN"

echo "✅ Deployment complete!"
```

**Rollback:**
```bash
#!/bin/bash
# backend/scripts/rollback.sh
set -euo pipefail

ENVIRONMENT="${1:-production}"
ALB_ARN=$(aws elbv2 describe-load-balancers --names "flowviz-alb-${ENVIRONMENT}" --query 'LoadBalancers[0].LoadBalancerArn' --output text)
LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --query 'Listeners[0].ListenerArn' --output text)

BLUE_TG=$(aws elbv2 describe-target-groups --names "flowviz-blue-${ENVIRONMENT}" --query 'TargetGroups[0].TargetGroupArn' --output text)
GREEN_TG=$(aws elbv2 describe-target-groups --names "flowviz-green-${ENVIRONMENT}" --query 'TargetGroups[0].TargetGroupArn' --output text)

CURRENT_TG=$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --query 'Listeners[0].DefaultActions[0].TargetGroupArn' --output text)
ROLLBACK_TG=$( [ "$CURRENT_TG" == "$BLUE_TG" ] && echo "$GREEN_TG" || echo "$BLUE_TG" )

aws elbv2 modify-listener --listener-arn "$LISTENER_ARN" --default-actions "Type=forward,TargetGroupArn=$ROLLBACK_TG"
echo "✅ Rollback complete!"
```

---

## TESTING:

### Smoke Tests
```python
# backend/tests/test_smoke.py
import pytest
import httpx


class TestSmokeTests:
    @pytest.fixture
    async def authenticated_client(self):
        async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
            resp = await client.post("/api/login", json={
                "email": "smoke-test@flowviz.com",
                "password": "smoke-test-password"
            })
            client.headers["Authorization"] = f"Bearer {resp.json()['access_token']}"
            yield client
    
    @pytest.mark.asyncio
    async def test_can_create_lot(self, authenticated_client):
        resp = await authenticated_client.post("/api/v1/lots", json={
            "lot_code": "SMOKE-TEST-001",
            "lot_type": "RAW",
            "weight_kg": 100.0,
        })
        assert resp.status_code == 201
    
    @pytest.mark.asyncio
    async def test_can_create_qc_decision(self, authenticated_client):
        lot_resp = await authenticated_client.post("/api/v1/lots", json={
            "lot_code": "SMOKE-QC-001",
            "lot_type": "WIP",
        })
        resp = await authenticated_client.post("/api/v1/qc-decisions", json={
            "lot_id": lot_resp.json()["id"],
            "gate_id": 1,
            "decision": "PASS",
        })
        assert resp.status_code == 201
```

### Deployment Health Tests
```python
# backend/tests/test_deployment.py
import pytest
import httpx
import asyncio


class TestDeploymentHealth:
    @pytest.mark.asyncio
    async def test_health_endpoint(self):
        async with httpx.AsyncClient() as client:
            resp = await client.get("http://localhost:8000/health")
            assert resp.status_code == 200
            assert resp.json()["database"] == "connected"
    
    @pytest.mark.asyncio
    async def test_response_latency(self):
        async with httpx.AsyncClient() as client:
            latencies = []
            for _ in range(10):
                start = asyncio.get_event_loop().time()
                await client.get("http://localhost:8000/health")
                latencies.append(asyncio.get_event_loop().time() - start)
            
            p99 = sorted(latencies)[9]
            assert p99 < 0.1, f"P99 latency {p99:.3f}s exceeds 100ms"
```

---

## EXAMPLES:

- `.github/workflows/run-tests.yml` - CI pipeline patterns
- Locust Load Testing: https://docs.locust.io/

---

## DOCUMENTATION:

- `docs/deployment-checklist.md` - Production launch checklist (to be created)
- `docs/runbooks/rollback.md` - Rollback procedures (to be created)
- `docs/parity/load-test-results.md` - Load test documentation (to be created)

---

## OTHER CONSIDERATIONS:

### Action Items (Week 9-10)

**Week 9 (Mar 17-21, 2026):**
- [ ] Day 1-2: Deploy application to cloud infrastructure
- [ ] Day 3: Run load test (20k lots, 1 hour)
- [ ] Day 4: Analyze results, fix bottlenecks
- [ ] Day 5: Re-run load test, document results

**Week 10 - PILOT LAUNCH (Mar 24-28, 2026):**
- [ ] Day 1-2: Shadow mode (run parallel with legacy)
- [ ] Day 3: Pre-launch checklist verification
- [ ] Day 4: **GO-LIVE** (single shift, 8am-4pm)
- [ ] Day 5: Post-launch review, lessons learned

### Risk Mitigation

**Risk: Load test reveals bottleneck**
- Mitigation: 2 days buffer in Week 9
- Fallback: Delay pilot by 1 week

**Risk: Production issue during pilot**
- Mitigation: 15-minute rollback procedure tested
- Fallback: Switch all traffic back to legacy

**Risk: Operator resistance**
- Mitigation: 2-hour training session
- Fallback: Assign champion operator

### Deliverables

- [ ] `backend/tests/load_test.py` - Load testing script
- [ ] `backend/tests/locustfile.py` - Locust configuration
- [ ] `backend/scripts/pre-launch-check.sh` - Pre-launch checklist
- [ ] `backend/scripts/deploy-blue-green.sh` - Deployment script
- [ ] `backend/scripts/rollback.sh` - Rollback script
- [ ] `backend/tests/test_smoke.py` - Smoke test suite

**Effort Estimate:** 10 days (1 DevOps + 1 Backend + 0.5 Frontend for training)

---

**Phase:** 4.3b - Load Testing & Pilot Launch  
**Last Updated:** January 19, 2026  
**Previous Part:** INITIAL-8a.md (Cloud Infrastructure)  
**Next Phase:** INITIAL-9.md (Scale & Intelligence)
