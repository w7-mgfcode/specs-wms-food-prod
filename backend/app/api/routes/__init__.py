"""API route modules."""

from fastapi import APIRouter

from app.api.routes import (
    auth,
    buffers,
    flows,
    health,
    inventory,
    lots,
    qc,
    runs,
    traceability,
)

api_router = APIRouter()

# Include all route modules
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(lots.router)
api_router.include_router(qc.router)
api_router.include_router(traceability.router)
api_router.include_router(flows.router)
api_router.include_router(runs.router)
api_router.include_router(buffers.router)
api_router.include_router(inventory.router)
