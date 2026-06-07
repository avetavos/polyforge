from collections.abc import Generator
from typing import Optional

from fastapi import Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.session import SessionLocal


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class UserContext(BaseModel):
    user_id: str
    role: Optional[str] = None

    @property
    def scoped_customer_id(self) -> Optional[str]:
        """None for administrators (see all orders), else the caller's own id."""
        return None if self.role == "administrator" else self.user_id


def get_current_user(
    x_user_id: str = Header(),
    x_user_role: Optional[str] = Header(default=None),
) -> UserContext:
    return UserContext(user_id=x_user_id, role=x_user_role)
