"""Characterization tests for health endpoint with snapshot validation."""

from datetime import datetime

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint_returns_200(client: AsyncClient):
    """Health endpoint should return 200 OK."""
    response = await client.get("/api/health")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_health_response_shape(client: AsyncClient):
    """
    Health endpoint response shape must match Node/Express.

    Expected: {"status": "ok", "timestamp": "<ISO8601>"}
    """
    response = await client.get("/api/health")
    data = response.json()

    # Must have exactly these keys
    assert set(data.keys()) == {"status", "timestamp"}

    # Status must be "ok"
    assert data["status"] == "ok"

    # Timestamp must be valid ISO8601
    timestamp = data["timestamp"]
    assert isinstance(timestamp, str)

    # Parse ISO8601 timestamp (should not raise)
    parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    assert parsed is not None


@pytest.mark.asyncio
async def test_health_snapshot(client: AsyncClient, snapshot):
    """
    Snapshot test: Health endpoint success response.

    Golden snapshot captures response shape with normalized timestamp.
    """
    response = await client.get("/api/health")
    assert response.status_code == 200

    data = response.json()
    # Normalize timestamp for snapshot comparison (timestamps vary)
    data["timestamp"] = "NORMALIZED"

    assert data == snapshot
