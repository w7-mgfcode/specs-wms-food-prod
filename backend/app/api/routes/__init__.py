"""API route modules."""

from fastapi import APIRouter

from app.api.routes import (
    audit,
    auth,
    buffers,
    flows,
    genealogy,
    health,
    inventory,
    lots,
    qc,
    qc_inspections,
    runs,
    temperature_logs,
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

# Phase 8.4: QC & Genealogy Unification routes
api_router.include_router(qc_inspections.router)
api_router.include_router(temperature_logs.router)
api_router.include_router(genealogy.router)
api_router.include_router(audit.router)
