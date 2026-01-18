"""Celery task queue configuration."""

from celery import Celery

from app.config import settings

# Create Celery app
# Note: Using redis:// scheme works with Valkey (workaround for celery[valkey] not existing)
celery_app = Celery(
    "flowviz",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.traceability"],
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max per task
    worker_prefetch_multiplier=1,  # One task at a time for fairness
)
