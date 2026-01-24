"""Flow definition and version models for the visual workflow editor."""

import enum
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import JSONB_TYPE, UUID_TYPE, Base

if TYPE_CHECKING:
    from app.models.production import ProductionRun
    from app.models.user import User


class FlowVersionStatus(str, enum.Enum):
    """Flow version lifecycle states per INITIAL-11."""

    DRAFT = "DRAFT"
    REVIEW = "REVIEW"         # Phase 8.1: Pending approval
    PUBLISHED = "PUBLISHED"
    DEPRECATED = "DEPRECATED"  # Phase 8.1: Replaced by newer version


class FlowDefinition(Base):
    """
    Abstract flow definition (e.g., "Standard Production Line").

    Maps to public.flow_definitions table.
    """

    __tablename__ = "flow_definitions"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    name: Mapped[dict[str, Any]] = mapped_column(
        JSONB_TYPE,
        nullable=False,
    )  # LocalizedString: {hu: str, en: str}
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("users.id"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    creator: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[created_by], back_populates="flow_definitions"
    )
    versions: Mapped[list["FlowVersion"]] = relationship(
        "FlowVersion", back_populates="flow_definition", cascade="all, delete-orphan"
    )


class FlowVersion(Base):
    """
    Immutable snapshot of a flow definition.

    Maps to public.flow_versions table.
    The graph_schema JSONB field stores the React Flow JSON structure:
    { nodes: [], edges: [], viewport: {} }

    IMPORTANT: Once status is PUBLISHED, the version becomes immutable
    (enforced by database trigger). Only status change to DEPRECATED is allowed.
    """

    __tablename__ = "flow_versions"

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    flow_definition_id: Mapped[UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("flow_definitions.id", ondelete="CASCADE"),
        nullable=False,
    )
    version_num: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50),
        default=FlowVersionStatus.DRAFT.value,
    )

    # The Core Graph Definition (React Flow JSON structure)
    graph_schema: Mapped[dict[str, Any]] = mapped_column(
        JSONB_TYPE,
        nullable=False,
        default=lambda: {"nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}},
    )

    created_by: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("users.id"),
        nullable=True,
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    published_by: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("users.id"),
        nullable=True,
    )

    # Phase 8.1: Reviewed by (for REVIEW → PUBLISHED transition)
    reviewed_by: Mapped[UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("users.id"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Relationships
    flow_definition: Mapped["FlowDefinition"] = relationship(
        "FlowDefinition", back_populates="versions"
    )
    creator: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[created_by], back_populates="flow_versions_created"
    )
    publisher: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[published_by], back_populates="flow_versions_published"
    )
    reviewer: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[reviewed_by], back_populates="flow_versions_reviewed"
    )

    # Phase 8.1: Production runs using this version
    production_runs: Mapped[list["ProductionRun"]] = relationship(
        "ProductionRun", back_populates="flow_version"
    )
