# Order Service Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `services/order-service` to Python best practices — fix two real bugs, make error handling consistent via exception handlers, remove N+1 queries, centralize config with pydantic-settings, add ruff, and add a pytest suite.

**Architecture:** Keep the layered FastAPI structure (routes → service → ORM). Routes become thin (no try/except); domain exceptions are translated to a uniform `BaseResponseModel` JSON envelope by registered FastAPI exception handlers. Service functions own data access with eager-loaded relationships. No repository layer (KISS). Directory names unchanged: `models/` = Pydantic DTOs, `schemas/` = SQLAlchemy ORM.

**Tech Stack:** Python 3.9 (prod Dockerfile target), FastAPI 0.115, SQLAlchemy 2.0, pydantic 2.10, pydantic-settings, pytest, ruff. Tests run on in-memory SQLite.

**Compatibility note:** Prod runs Python 3.9 (`dockerfile`). Use `Optional[...]` / `typing` unions for any annotation FastAPI/Pydantic evaluates at runtime — **do NOT use PEP 604 `X | None`** (fails on 3.9). `list[...]`/`dict[...]` builtins are fine on 3.9. Ruff `target-version = "py39"` keeps the `UP` rules from suggesting `X | None`.

All commands assume the working directory is `services/order-service` and the project virtualenv is active:
```bash
cd services/order-service && source env/bin/activate
```

---

### Task 1: Tooling & dependencies

**Files:**
- Modify: `services/order-service/requirements.txt`
- Create: `services/order-service/requirements-dev.txt`
- Create: `services/order-service/pyproject.toml`

- [ ] **Step 1: Add pydantic-settings to runtime deps**

Append this line to `requirements.txt`:
```
pydantic-settings==2.6.1
```

- [ ] **Step 2: Create dev requirements**

Create `requirements-dev.txt`:
```
-r requirements.txt
pytest==8.3.4
httpx==0.28.1
ruff==0.8.4
```

- [ ] **Step 3: Create pyproject.toml (ruff + pytest config)**

Create `pyproject.toml`:
```toml
[tool.ruff]
line-length = 100
target-version = "py39"
extend-exclude = ["env", "alembic"]

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "C4"]

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-v"
```

- [ ] **Step 4: Install dev dependencies**

Run: `python -m pip install -r requirements-dev.txt`
Expected: installs `pydantic-settings`, `pytest`, `ruff` (and confirms others already satisfied).

- [ ] **Step 5: Commit**

```bash
git add services/order-service/requirements.txt services/order-service/requirements-dev.txt services/order-service/pyproject.toml
git commit -m "build(order-service): add pydantic-settings, pytest, ruff, pyproject config"
```

---

### Task 2: Test harness + full test suite (written first, expected to fail)

**Files:**
- Create: `services/order-service/conftest.py`
- Create: `services/order-service/tests/__init__.py`
- Create: `services/order-service/tests/test_health.py`
- Create: `services/order-service/tests/test_orders.py`

> Tests are written against the **target** behavior. On current code they will fail (route-slash bug returns 404s for detail routes, error envelopes differ). Later tasks make them pass.

- [ ] **Step 1: Create root conftest with fixtures**

Create `conftest.py` (at the service root, so the service dir is on `sys.path`):
```python
import os

# Must be set before importing the app (db.session builds an engine at import time).
os.environ.setdefault("DATABASE_URL", "sqlite://")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import schemas.order  # noqa: F401  (register ORM tables on Base.metadata)
import schemas.order_item  # noqa: F401
from api.deps import get_db
from db.session import Base
from main import app


@pytest.fixture()
def engine():
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    eng.dispose()


@pytest.fixture()
def db_session(engine):
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = testing_session_local()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers():
    def _make(user_id="user-1", role=None):
        headers = {"x-user-id": user_id}
        if role is not None:
            headers["x-user-role"] = role
        return headers

    return _make
```

- [ ] **Step 2: Create tests package marker**

Create `tests/__init__.py` (empty file).

- [ ] **Step 3: Write health test**

Create `tests/test_health.py`:
```python
def test_healthz_ok(client):
    resp = client.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["service"] == "UP"
    assert body["database"] == "UP"
```

- [ ] **Step 4: Write order tests**

Create `tests/test_orders.py`:
```python
def _create(client, auth_headers, user_id="user-1", sku="A", qty=1):
    return client.post(
        "/orders",
        json={"items": [{"sku": sku, "qty": qty}]},
        headers=auth_headers(user_id),
    )


def test_create_order(client, auth_headers):
    resp = client.post(
        "/orders",
        json={"items": [{"sku": "ABC", "qty": 2}, {"sku": "XYZ", "qty": 1}]},
        headers=auth_headers("user-1"),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["message"] == "Order created successfully"
    data = body["data"]
    assert data["status"] == "PENDING"
    assert data["id"]
    assert data["created_at"]
    assert len(data["items"]) == 2
    assert {i["sku"] for i in data["items"]} == {"ABC", "XYZ"}


def test_list_orders_scoped_to_user(client, auth_headers):
    _create(client, auth_headers, "user-1", sku="A")
    _create(client, auth_headers, "user-2", sku="B")

    resp = client.get("/orders", headers=auth_headers("user-1"))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["items"][0]["sku"] == "A"


def test_list_orders_admin_sees_all(client, auth_headers):
    _create(client, auth_headers, "user-1", sku="A")
    _create(client, auth_headers, "user-2", sku="B")

    resp = client.get("/orders", headers=auth_headers("admin", role="administrator"))
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 2


def test_get_order_by_id(client, auth_headers):
    order_id = _create(client, auth_headers, "user-1").json()["data"]["id"]

    resp = client.get(f"/orders/{order_id}", headers=auth_headers("user-1"))
    assert resp.status_code == 200
    assert resp.json()["data"]["id"] == order_id


def test_get_order_not_found(client, auth_headers):
    resp = client.get("/orders/does-not-exist", headers=auth_headers("user-1"))
    assert resp.status_code == 404
    assert resp.json()["data"] is None


def test_get_order_other_user_is_hidden(client, auth_headers):
    order_id = _create(client, auth_headers, "user-1").json()["data"]["id"]

    resp = client.get(f"/orders/{order_id}", headers=auth_headers("user-2"))
    assert resp.status_code == 404


def test_cancel_order(client, auth_headers):
    order_id = _create(client, auth_headers, "user-1").json()["data"]["id"]

    resp = client.patch(f"/orders/{order_id}", headers=auth_headers("user-1"))
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "CANCELLED"


def test_cancel_order_twice_fails(client, auth_headers):
    order_id = _create(client, auth_headers, "user-1").json()["data"]["id"]
    client.patch(f"/orders/{order_id}", headers=auth_headers("user-1"))

    resp = client.patch(f"/orders/{order_id}", headers=auth_headers("user-1"))
    assert resp.status_code == 400
    assert resp.json()["data"] is None


def test_cancel_order_not_found(client, auth_headers):
    resp = client.patch("/orders/nope", headers=auth_headers("user-1"))
    assert resp.status_code == 400
```

- [ ] **Step 5: Run the suite to confirm it fails**

Run: `pytest`
Expected: FAIL — detail-route tests error/404 (route-slash bug), error-envelope assertions fail. This confirms the tests exercise the gaps the refactor fixes.

- [ ] **Step 6: Commit**

```bash
git add services/order-service/conftest.py services/order-service/tests
git commit -m "test(order-service): add pytest harness and order/health test suite"
```

---

### Task 3: Centralize configuration (pydantic-settings)

**Files:**
- Create: `services/order-service/core/__init__.py`
- Create: `services/order-service/core/config.py`
- Modify: `services/order-service/db/session.py`

- [ ] **Step 1: Create core package**

Create `core/__init__.py` (empty file).

- [ ] **Step 2: Create settings**

Create `core/config.py`:
```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str


settings = Settings()  # type: ignore[call-arg]
```

- [ ] **Step 3: Rewrite db/session.py to use settings**

Replace the entire contents of `db/session.py`:
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from core.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
```

- [ ] **Step 4: Verify import still works**

Run: `python -c "import db.session; print('ok')"`
Expected: prints `ok` (DATABASE_URL is read from `.env`; if absent, set it for the check: `DATABASE_URL=sqlite:// python -c "import db.session; print('ok')"`).

- [ ] **Step 5: Commit**

```bash
git add services/order-service/core services/order-service/db/session.py
git commit -m "refactor(order-service): centralize config with pydantic-settings"
```

---

### Task 4: Domain exceptions + exception handlers

**Files:**
- Create: `services/order-service/core/exceptions.py`
- Create: `services/order-service/core/handlers.py`

- [ ] **Step 1: Create domain exceptions**

Create `core/exceptions.py`:
```python
class OrderError(Exception):
    """Base class for order domain errors."""


class OrderNotFoundError(OrderError):
    def __init__(self, order_id: str) -> None:
        self.order_id = order_id
        super().__init__(f"Order {order_id} not found")


class OrderNotCancellableError(OrderError):
    def __init__(self, order_id: str) -> None:
        self.order_id = order_id
        super().__init__(f"Order {order_id} not found or cannot be cancelled")
```

- [ ] **Step 2: Create exception handlers**

Create `core/handlers.py`:
```python
import logging

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from core.exceptions import OrderNotCancellableError, OrderNotFoundError
from models.response import BaseResponseModel

logger = logging.getLogger(__name__)


def _envelope(message: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=BaseResponseModel(message=message, data=None).model_dump(),
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(OrderNotFoundError)
    async def _handle_not_found(request: Request, exc: OrderNotFoundError) -> JSONResponse:
        return _envelope(str(exc), status.HTTP_404_NOT_FOUND)

    @app.exception_handler(OrderNotCancellableError)
    async def _handle_not_cancellable(
        request: Request, exc: OrderNotCancellableError
    ) -> JSONResponse:
        return _envelope(str(exc), status.HTTP_400_BAD_REQUEST)

    @app.exception_handler(Exception)
    async def _handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return _envelope("Internal Server Error", status.HTTP_500_INTERNAL_SERVER_ERROR)
```

- [ ] **Step 3: Commit**

```bash
git add services/order-service/core/exceptions.py services/order-service/core/handlers.py
git commit -m "feat(order-service): add domain exceptions and uniform exception handlers"
```

---

### Task 5: Fix ORM models (timestamp default bug, imports)

**Files:**
- Modify: `services/order-service/schemas/order.py`
- Modify: `services/order-service/schemas/order_item.py`
- Modify: `services/order-service/schemas/__init__.py`

- [ ] **Step 1: Rewrite schemas/order.py**

Replace the entire contents of `schemas/order.py`:
```python
import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Column, DateTime, String
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import relationship

from db.session import Base


class OrderStatus(str, Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String, index=True, nullable=False)
    status = Column(SQLEnum(OrderStatus), default=OrderStatus.PENDING)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, onupdate=_utcnow)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
```

> Key fixes: `OrderStatus` is now `str, Enum` (clean JSON serialization to `"PENDING"`); timestamp defaults are **callables** (`_utcnow` / `lambda`) so each row gets its own value; duplicate `Column, String` import removed. Column nullability is unchanged to avoid Alembic migration drift.

- [ ] **Step 2: Rewrite schemas/order_item.py**

Replace the entire contents of `schemas/order_item.py`:
```python
import uuid

from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from db.session import Base


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey("orders.id"), index=True)
    sku = Column(String, nullable=False, index=True)
    qty = Column(Integer, nullable=False)

    order = relationship("Order", back_populates="items")
```

- [ ] **Step 3: Add package docstring**

Replace the contents of `schemas/__init__.py`:
```python
"""SQLAlchemy ORM models. (Note: Pydantic request/response DTOs live in `models/`.)"""
```

- [ ] **Step 4: Commit**

```bash
git add services/order-service/schemas
git commit -m "fix(order-service): per-row timestamp defaults; str-enum status; tidy ORM imports"
```

---

### Task 6: Clean up Pydantic DTOs

**Files:**
- Modify: `services/order-service/models/order.py`
- Modify: `services/order-service/models/order_item.py`
- Modify: `services/order-service/models/response.py`
- Modify: `services/order-service/models/__init__.py`

- [ ] **Step 1: Rewrite models/order.py**

Replace the entire contents of `models/order.py`:
```python
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from .order_item import CreatedOrderItemResponse, OrderItem


class Order(BaseModel):
    items: list[OrderItem]


class CreatedOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    items: list[CreatedOrderItemResponse]
    created_at: datetime
    updated_at: Optional[datetime] = None
```

> Removes unused `OrderCreate`; uses Pydantic v2 `model_config`; `CreatedOrderResponse` is now standalone (no inherited-then-overridden `items`).

- [ ] **Step 2: Rewrite models/order_item.py**

Replace the entire contents of `models/order_item.py`:
```python
from pydantic import BaseModel, ConfigDict


class OrderItem(BaseModel):
    sku: str
    qty: int


class CreatedOrderItemResponse(OrderItem):
    model_config = ConfigDict(from_attributes=True)

    id: str
```

- [ ] **Step 3: Rewrite models/response.py**

Replace the entire contents of `models/response.py`:
```python
from typing import Generic, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class BaseResponseModel(BaseModel, Generic[T]):
    message: str
    data: Optional[T] = None
```

- [ ] **Step 4: Add package docstring**

Replace the contents of `models/__init__.py`:
```python
"""Pydantic request/response DTOs. (Note: SQLAlchemy ORM models live in `schemas/`.)"""
```

- [ ] **Step 5: Commit**

```bash
git add services/order-service/models
git commit -m "refactor(order-service): tidy Pydantic DTOs (v2 config, drop unused OrderCreate)"
```

---

### Task 7: Dependencies (DB session + auth context)

**Files:**
- Modify: `services/order-service/api/deps.py`

- [ ] **Step 1: Rewrite api/deps.py**

Replace the entire contents of `api/deps.py`:
```python
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
```

- [ ] **Step 2: Commit**

```bash
git add services/order-service/api/deps.py
git commit -m "refactor(order-service): add UserContext dependency, type get_db"
```

---

### Task 8: Service layer (eager loading, domain exceptions, dedup)

**Files:**
- Modify: `services/order-service/api/services/orders.py`

- [ ] **Step 1: Rewrite api/services/orders.py**

Replace the entire contents of `api/services/orders.py`:
```python
import logging
from typing import Optional

from sqlalchemy.orm import Session, selectinload

from core.exceptions import OrderNotCancellableError, OrderNotFoundError
from models.order import Order as OrderPayload
from schemas.order import Order as OrderDB
from schemas.order import OrderStatus
from schemas.order_item import OrderItem as OrderItemDB

logger = logging.getLogger(__name__)


def create_order(payload: OrderPayload, customer_id: str, db: Session) -> OrderDB:
    try:
        order = OrderDB(status=OrderStatus.PENDING, customer_id=customer_id)
        order.items = [OrderItemDB(sku=item.sku, qty=item.qty) for item in payload.items]
        db.add(order)
        db.commit()
        db.refresh(order)
        return order
    except Exception:
        db.rollback()
        logger.exception("Error creating order for customer %s", customer_id)
        raise


def get_order(order_id: str, customer_id: Optional[str], db: Session) -> OrderDB:
    query = (
        db.query(OrderDB).options(selectinload(OrderDB.items)).filter(OrderDB.id == order_id)
    )
    if customer_id is not None:
        query = query.filter(OrderDB.customer_id == customer_id)

    order = query.first()
    if order is None:
        raise OrderNotFoundError(order_id)
    return order


def list_orders(customer_id: Optional[str], db: Session) -> list[OrderDB]:
    query = db.query(OrderDB).options(selectinload(OrderDB.items))
    if customer_id is not None:
        query = query.filter(OrderDB.customer_id == customer_id)
    return query.all()


def cancel_order(order_id: str, customer_id: str, db: Session) -> OrderDB:
    try:
        order = (
            db.query(OrderDB)
            .options(selectinload(OrderDB.items))
            .filter(
                OrderDB.id == order_id,
                OrderDB.customer_id == customer_id,
                OrderDB.status == OrderStatus.PENDING,
            )
            .first()
        )
        if order is None:
            raise OrderNotCancellableError(order_id)

        order.status = OrderStatus.CANCELLED
        db.commit()
        db.refresh(order)
        return order
    except OrderNotCancellableError:
        raise
    except Exception:
        db.rollback()
        logger.exception("Error cancelling order %s for customer %s", order_id, customer_id)
        raise
```

> Fixes: `selectinload` eliminates the N+1 loop and the manual `order.items = db.query(...)` overwrite; create uses relationship assignment + cascade (no manual flush loop); duplicated if/else branches collapsed into one optional filter; `None` returns replaced by domain exceptions.

- [ ] **Step 2: Commit**

```bash
git add services/order-service/api/services/orders.py
git commit -m "refactor(order-service): eager-load items, dedup queries, raise domain errors"
```

---

### Task 9: Routes + app wiring (route-slash bug, thin handlers)

**Files:**
- Modify: `services/order-service/api/routes/orders.py`
- Modify: `services/order-service/main.py`
- Modify: `services/order-service/api/router.py` (import order only)

- [ ] **Step 1: Rewrite api/routes/orders.py**

Replace the entire contents of `api/routes/orders.py`:
```python
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from api.deps import UserContext, get_current_user, get_db
from api.services.orders import cancel_order, create_order, get_order, list_orders
from models.order import CreatedOrderResponse, Order
from models.response import BaseResponseModel

router = APIRouter()


@router.get("", response_model=BaseResponseModel[list[CreatedOrderResponse]])
def list_orders_handler(
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    orders = list_orders(user.scoped_customer_id, db)
    return BaseResponseModel(
        message="Orders fetched successfully",
        data=[CreatedOrderResponse.model_validate(order) for order in orders],
    )


@router.get("/{order_id}", response_model=BaseResponseModel[CreatedOrderResponse])
def get_order_handler(
    order_id: str,
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = get_order(order_id, user.scoped_customer_id, db)
    return BaseResponseModel(
        message=f"Order {order_id} fetched successfully",
        data=CreatedOrderResponse.model_validate(order),
    )


@router.post(
    "",
    response_model=BaseResponseModel[CreatedOrderResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_order_handler(
    payload: Order,
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = create_order(payload, user.user_id, db)
    return BaseResponseModel(
        message="Order created successfully",
        data=CreatedOrderResponse.model_validate(order),
    )


@router.patch("/{order_id}", response_model=BaseResponseModel[CreatedOrderResponse])
def cancel_order_handler(
    order_id: str,
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = cancel_order(order_id, user.user_id, db)
    return BaseResponseModel(
        message=f"Order {order_id} cancelled successfully",
        data=CreatedOrderResponse.model_validate(order),
    )
```

> Fixes: detail routes now use `/{order_id}` (the bug); no try/except (handlers translate domain errors); cancel gets a `response_model`; admin scoping via `user.scoped_customer_id`.

- [ ] **Step 2: Rewrite main.py**

Replace the entire contents of `main.py`:
```python
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
```

- [ ] **Step 3: Normalize api/router.py imports**

Replace the entire contents of `api/router.py`:
```python
from fastapi import APIRouter

from api.routes import orders

router = APIRouter()
router.include_router(orders.router, prefix="/orders", tags=["orders"])
```

- [ ] **Step 4: Run the full suite — expect green**

Run: `pytest`
Expected: PASS — all tests from Task 2 pass.

- [ ] **Step 5: Commit**

```bash
git add services/order-service/api/routes/orders.py services/order-service/main.py services/order-service/api/router.py
git commit -m "fix(order-service): correct detail route paths; thin handlers via exception handlers"
```

---

### Task 10: Lint clean + nx targets

**Files:**
- Modify (as needed for lint): any file flagged by ruff
- Modify: `services/order-service/project.json`

- [ ] **Step 1: Auto-fix imports/format with ruff**

Run: `ruff check --fix . && ruff format .`
Expected: no remaining errors; possibly reformats files.

- [ ] **Step 2: Verify ruff is clean**

Run: `ruff check .`
Expected: `All checks passed!`

- [ ] **Step 3: Re-run tests after formatting**

Run: `pytest`
Expected: PASS (all tests still green).

- [ ] **Step 4: Add lint + test nx targets**

In `project.json`, add these two targets inside the `"targets"` object (alongside `build`, `serve`, etc.):
```json
    "test": {
      "executor": "nx:run-commands",
      "options": {
        "command": "pytest",
        "cwd": "services/order-service"
      }
    },
    "lint": {
      "executor": "nx:run-commands",
      "options": {
        "command": "ruff check .",
        "cwd": "services/order-service"
      }
    }
```

- [ ] **Step 5: Commit**

```bash
git add -A services/order-service
git commit -m "chore(order-service): apply ruff formatting; add nx test and lint targets"
```

---

## Self-Review

**Spec coverage:**
- B1 route-slash → Task 9 Step 1. ✓
- B2 timestamp defaults → Task 5 Step 1. ✓
- S1 bare except → Tasks 8 & 9 (no bare except; handlers in Task 4). ✓
- S2 inconsistent error contract → Task 4 (handlers) + Task 9 (thin routes). ✓
- S3 N+1 / manual items → Task 8 (selectinload, relationship assignment). ✓
- S4 config → Task 3. ✓
- S5 duplicated branches → Task 8. ✓
- S6 minor cleanups (dupe imports, unused OrderCreate, Config→ConfigDict, healthcheck) → Tasks 5, 6, 9. ✓
- S7 tests → Task 2. ✓
- Ruff → Tasks 1 & 10. ✓
- Naming caveat documented → Tasks 5 & 6 (`__init__.py` docstrings). ✓

**Placeholder scan:** none — every code step contains full file contents.

**Type/name consistency:** service functions `create_order/get_order/list_orders/cancel_order` match the imports in `api/routes/orders.py`. `UserContext`, `get_current_user`, `get_db` defined in Task 7 match usage in Task 9. `BaseResponseModel`, `CreatedOrderResponse`, `OrderStatus(str, Enum)`, `_utcnow` consistent across tasks. `register_exception_handlers` defined in Task 4, used in Task 9. ✓

**Compatibility:** Python 3.9 — no PEP 604 unions in runtime-evaluated annotations (uses `Optional[...]`); `list[...]` builtins OK on 3.9; ruff `target-version = "py39"`. ✓
