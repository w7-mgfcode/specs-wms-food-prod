"""User and authentication schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.user import UserRole


class UserLogin(BaseModel):
    """Login request schema - matches Node/Express input."""

    email: EmailStr


class UserResponse(BaseModel):
    """User response schema - matches Node/Express output."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str | None = None
    role: UserRole
    created_at: datetime
    last_login: datetime | None = None


class Token(BaseModel):
    """JWT token response."""

    access_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    """
    Login response schema - matches Node/Express exactly.

    Node/Express returns:
    {
        "user": {...user fields...},
        "token": "mock-jwt-token-for-mode-c"
    }
    """

    user: UserResponse
    token: str
