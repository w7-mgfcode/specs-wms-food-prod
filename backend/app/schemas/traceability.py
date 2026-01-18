"""Traceability schemas for lot genealogy."""

from pydantic import BaseModel

from app.schemas.lot import LotResponse


class TraceabilityResponse(BaseModel):
    """
    Traceability response schema - matches Node/Express output exactly.

    Node/Express returns:
    {
        "central": {...lot fields...},
        "parents": [...parent lots...],
        "children": [...child lots...]
    }
    """

    central: LotResponse
    parents: list[LotResponse]
    children: list[LotResponse]
