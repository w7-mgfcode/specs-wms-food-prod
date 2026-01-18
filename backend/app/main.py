"""FastAPI application entry point for FlowViz WMS."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    # Database connection pool will be initialized when first used
    yield
    # Shutdown
    # Cleanup resources if needed


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="FlowViz WMS API",
        description="Food Production Warehouse Management System API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    # CORS middleware
    # Note: allow_credentials=True is invalid with allow_origins=["*"]
    # In debug mode, we use permissive settings without credentials
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.debug else ["https://flowviz.example.com"],
        allow_credentials=not settings.debug,  # False in debug (wildcard), True in prod
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Import and include API routes
    from app.api.routes import api_router

    app.include_router(api_router, prefix="/api")

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
    )
