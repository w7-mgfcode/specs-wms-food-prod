"""Run code generation service."""

import re
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.production import ProductionRun


async def generate_run_code(db: AsyncSession, site_code: str = "DUNA") -> str:
    """
    Generate run code: RUN-YYYYMMDD-SITE-####

    Example: RUN-20260124-DUNA-0001

    The sequence number resets daily.
    """
    today = date.today()
    date_str = today.strftime("%Y%m%d")
    prefix = f"RUN-{date_str}-{site_code}-"

    # Get max sequence for today
    stmt = select(func.max(ProductionRun.run_code)).where(
        ProductionRun.run_code.like(f"{prefix}%")
    )
    result = await db.execute(stmt)
    max_code = result.scalar_one_or_none()

    if max_code:
        # Extract sequence number and increment
        try:
            seq = int(max_code[-4:]) + 1
        except ValueError:
            seq = 1
    else:
        seq = 1

    return f"{prefix}{seq:04d}"


def validate_run_code(code: str) -> bool:
    """Validate run code format."""
    pattern = r"^RUN-\d{8}-[A-Z]{4}-\d{4}$"
    return bool(re.match(pattern, code))
