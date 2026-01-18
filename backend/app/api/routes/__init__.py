"""API route modules."""

from fastapi import APIRouter

from app.api.routes import auth, health, lots, qc, traceability

api_router = APIRouter()

# Include all route modules
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(lots.router)
api_router.include_router(qc.router)
api_router.include_router(traceability.router)
