"""Authentication endpoints."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession
from app.models.user import User
from app.schemas.user import LoginResponse, UserLogin, UserResponse
from app.services.auth import create_access_token

router = APIRouter(tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(
    credentials: UserLogin,
    db: DBSession,
) -> LoginResponse:
    """
    Login endpoint - matches Node/Express behavior.

    Node/Express does a simple email lookup (passwordless for demo).
    We maintain parity but use real JWT tokens.

    Response shape matches Node/Express:
    {
        "user": {...user fields...},
        "token": "<JWT>"
    }
    """
    # Find user by email
    stmt = select(User).where(User.email == credentials.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Create JWT token with user ID
    token = create_access_token(data={"sub": str(user.id)})

    return LoginResponse(
        user=UserResponse.model_validate(user),
        token=token,
    )
