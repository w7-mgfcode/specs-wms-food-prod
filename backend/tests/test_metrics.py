"""Tests for Prometheus metrics instrumentation."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_metrics_endpoint_accessible(client: AsyncClient) -> None:
    """Metrics endpoint should be publicly accessible."""
    response = await client.get("/metrics")
    assert response.status_code == 200
    assert "text/plain" in response.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_metrics_contain_http_metrics(client: AsyncClient) -> None:
    """Metrics should include HTTP request metrics."""
    # Make a request first to generate metrics
    await client.get("/api/v1/health")

    response = await client.get("/metrics")
    content = response.text

    # Check for prometheus-fastapi-instrumentator default metrics
    assert "http_requests_total" in content or "http_request_duration" in content


@pytest.mark.asyncio
async def test_business_metrics_registered(client: AsyncClient) -> None:
    """Business metrics should be registered."""
    response = await client.get("/metrics")
    content = response.text

    # Check custom business metrics are defined
    assert "flowviz_lots_registered_total" in content
    assert "flowviz_qc_decisions_total" in content
    assert "flowviz_traceability_query_duration" in content


@pytest.mark.asyncio
async def test_database_metrics_registered(client: AsyncClient) -> None:
    """Database pool metrics should be registered."""
    response = await client.get("/metrics")
    content = response.text

    # Check database pool metrics
    assert "flowviz_db_pool_connections" in content or "flowviz_active_operators" in content


@pytest.mark.asyncio
async def test_metrics_format_prometheus_compatible(client: AsyncClient) -> None:
    """Metrics should be in valid Prometheus exposition format."""
    response = await client.get("/metrics")
    content = response.text

    # Check for standard Prometheus format markers
    assert "# HELP" in content
    assert "# TYPE" in content

    # Verify at least one metric has a value
    lines = [line for line in content.split("\n") if line and not line.startswith("#")]
    assert len(lines) > 0, "Should have at least one metric value"
