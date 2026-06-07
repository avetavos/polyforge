import logging

from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.deps import get_db
from api.router import router
from core.handlers import register_exception_handlers

logger = logging.getLogger(__name__)

app = FastAPI(title="Order Service")
register_exception_handlers(app)
app.include_router(router)


@app.get("/")
def healthz(db: Session = Depends(get_db)) -> dict[str, str]:
    db_status = "UP"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Database health check failed")
        db_status = "DOWN"
    return {"service": "UP", "database": db_status}
