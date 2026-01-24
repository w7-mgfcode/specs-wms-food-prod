"""User models matching the database schema."""

import os

import enum
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, UUID_TYPE

if TYPE_CHECKING:
    from app.models.flow import FlowDefinition, FlowVersion
    from app.models.lot import Lot
    from app.models.production import ProductionRun
    from app.models.qc import QCDecision


class UserRole(str, enum.Enum):
    """User roles matching database CHECK constraint."""

    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    AUDITOR = "AUDITOR"
    OPERATOR = "OPERATOR"
    VIEWER = "VIEWER"


IS_SQLITE_TEST = os.getenv("SQLITE_TESTS") == "1"
AUTH_USERS_TABLE = "auth_users" if IS_SQLITE_TEST else "auth.users"


class AuthUser(Base):
    """
    Mock Supabase auth.users table.

    This simulates the Supabase auth schema for local development.
    """

    __tablename__ = "auth_users" if IS_SQLITE_TEST else "users"
    __table_args__ = {} if IS_SQLITE_TEST else {"schema": "auth"}

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    email: Mapped[Optional[str]] = mapped_column(Text, unique=True, nullable=True)
    encrypted_password: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class User(Base):
    """
    Public user profile linked to auth.users.

    Maps to public.users table.
    """

    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey(f"{AUTH_USERS_TABLE}.id"),
        primary_key=True,
    )
    email: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", create_constraint=False),
        default=UserRole.VIEWER,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    production_runs: Mapped[list["ProductionRun"]] = relationship(
        "ProductionRun", back_populates="operator"
    )
    lots: Mapped[list["Lot"]] = relationship("Lot", back_populates="operator")
    qc_decisions: Mapped[list["QCDecision"]] = relationship(
        "QCDecision", back_populates="operator"
    )
    flow_definitions: Mapped[list["FlowDefinition"]] = relationship(
        "FlowDefinition", back_populates="creator"
    )
    flow_versions_created: Mapped[list["FlowVersion"]] = relationship(
        "FlowVersion", foreign_keys="FlowVersion.created_by", back_populates="creator"
    )
    flow_versions_published: Mapped[list["FlowVersion"]] = relationship(
        "FlowVersion", foreign_keys="FlowVersion.published_by", back_populates="publisher"
    )
