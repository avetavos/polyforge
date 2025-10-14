from fastapi import Depends, FastAPI
from sqlalchemy.orm import Session
from sqlalchemy import text
from api.deps import get_db
from api.router import router

app = FastAPI()

@app.get("/")
def healthz(db: Session = Depends(get_db)):
    db_status = "UP"
    try:
        db.execute(text("SELECT 1"))
        pass
    except Exception as e:
        db_status = "DOWN"

    return {"service": "UP", "database": db_status}

app.include_router(router)