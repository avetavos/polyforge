# Order Service Refactor — Design

**Date:** 2026-06-07
**Scope:** `services/order-service`
**Goal:** Refactor the FastAPI + SQLAlchemy order service to Python best practices — fix real bugs, make error handling consistent, remove the N+1 query pattern, separate concerns cleanly, and add a pytest test suite. **Directory names are kept as-is** (no `models`/`schemas` rename) to limit churn.

> Naming caveat carried forward unchanged: in this service `models/` holds **Pydantic DTOs** and `schemas/` holds **SQLAlchemy ORM models** — the inverse of the common FastAPI convention. We are not renaming; a short docstring will be added to each package's `__init__.py` documenting this so it stops surprising readers.

---

## 1. Problems being fixed

### Bugs (wrong behavior today)
- **B1 — Missing leading slash on detail routes.** `api/routes/orders.py:33,91` use `@router.get("{order_id}")` / `@router.patch("{order_id}")`. With the `/orders` prefix these resolve to `/orders{order_id}` instead of `/orders/{order_id}`.
- **B2 — Timestamp defaults evaluated once at import.** `schemas/order.py:21-22` pass `default=datetime.now(tz=timezone.utc)` (a value, computed at import) rather than a callable. Every row gets the same timestamp. Same for `onupdate`.

### Best-practice / correctness smells
- **S1 — Bare `except:`** in every route handler swallows `KeyboardInterrupt`/`SystemExit` and hides errors.
- **S2 — Inconsistent error contract.** Handlers mix `return JSONResponse(...)` with `raise HTTPException(...)`; the `JSONResponse` path bypasses the declared `response_model`.
- **S3 — N+1 queries + manual relationship overwrite.** `api/services/orders.py` loops and re-queries `OrderItem` per order and assigns `order.items = ...` even though the relationship already exists.
- **S4 — Scattered config.** `db/session.py` reads env via `os.getenv` directly.
- **S5 — Duplicated query branches.** `get_order_by_id` / `get_all_orders` repeat near-identical if/else differing only by one filter.
- **S6 — Minor:** duplicate `Depends` import (`main.py:1`), duplicate `Column, String` import (`schemas/order.py`), stray `pass` + unused `e` in healthcheck, unused `OrderCreate`, Pydantic v1-style `class Config`, scattered `# type: ignore`.
- **S7 — No tests.**

---

## 2. Target architecture

Keep the existing three-ish layers but tighten responsibilities. **No repository layer is introduced** (KISS — the service is thin CRUD with light rules; a repository would be premature abstraction). Service functions keep taking a `Session` and remain unit-testable against an in-memory SQLite DB.

```
HTTP (routes)  ──▶  Service (business rules + data access)  ──▶  ORM (SQLAlchemy)
     │                                                              │
 thin handlers,                                              eager-loaded
 no try/except                                               relationships
     │
 domain exceptions ──▶ FastAPI exception handlers ──▶ BaseResponseModel envelope
```

### 2.1 Configuration — `core/config.py` (new)
- `Settings(BaseSettings)` via **pydantic-settings**, field `database_url: str` (env `DATABASE_URL`), loaded from `.env`.
- Single `settings = Settings()` instance; `db/session.py` imports it. Removes raw `os.getenv` + manual `ValueError` (pydantic raises a clear validation error if missing).
- Adds `pydantic-settings` to `requirements.txt`.

### 2.2 Domain exceptions — `core/exceptions.py` (new)
- `OrderNotFoundError(order_id)` → maps to 404.
- `OrderNotCancellableError(order_id)` → maps to 400 (replaces the raw `ValueError`).

### 2.3 Exception handlers — registered in `main.py` (or `core/handlers.py`)
- Handlers convert each domain exception into a `BaseResponseModel(message=..., data=None)` JSON envelope with the right status code.
- A catch-all `Exception` handler logs the error and returns a 500 envelope.
- Result: **route handlers contain no try/except** — they call the service and return the success envelope.

### 2.4 Auth scoping dependency — `api/deps.py`
- Add `get_current_user` returning a small `UserContext` Pydantic model built from headers `x-user-id` and (optional) `x-user-role`, with a `scoped_customer_id` property: `None` for `administrator`, else the user id.
- Removes the repeated `user_id = None if x_user_role == "administrator" else x_user_id` line from handlers.

### 2.5 Service layer — `api/services/orders.py`
- `create_order(payload, customer_id, db)` — unchanged logic, cleaner; commit/rollback preserved.
- `get_order(order_id, customer_id, db)` — single query with optional customer filter and `selectinload(Order.items)`; raises `OrderNotFoundError` if missing (no more `None` + branching in the route).
- `list_orders(customer_id, db)` — single query with optional customer filter and `selectinload`. No per-order loop.
- `cancel_order(order_id, customer_id, db)` — fetch pending order scoped to customer; raise `OrderNotCancellableError` if not found/not pending; set status, commit, return.
- Eager loading via `selectinload(Order.items)` removes both S3 (N+1) and the manual `order.items = ...` overwrite.

### 2.6 Routes — `api/routes/orders.py`
- Fix paths to `/{order_id}` (B1).
- Remove all try/except (handled globally).
- All four handlers declare `response_model=BaseResponseModel[...]`; cancel gets one too.
- Use `Depends(get_current_user)`.

### 2.7 ORM models — `schemas/order.py`, `schemas/order_item.py`
- B2 fix: `default=lambda: datetime.now(timezone.utc)`; `updated_at` uses `default` + `onupdate` callables.
- Remove duplicate imports.

### 2.8 Pydantic DTOs — `models/`
- Drop unused `OrderCreate`.
- Replace `class Config: from_attributes = True` with `model_config = ConfigDict(from_attributes=True)` (Pydantic v2).

### 2.9 Misc cleanups
- `main.py`: dedupe `Depends` import; tidy healthcheck (drop `pass`, log the caught error).

---

## 3. Testing (pytest)

- **Tooling:** add `pytest` (+ `httpx` already present) via a new `requirements-dev.txt`; pytest config in a new `pyproject.toml` (`[tool.pytest.ini_options]`, `testpaths = ["tests"]`).
- **Fixtures (`tests/conftest.py`):**
  - In-memory SQLite engine with `StaticPool` + `check_same_thread=False`; `Base.metadata.create_all`.
  - Session fixture; `TestClient` fixture overriding the `get_db` dependency to use the test session.
  - Helper to set `x-user-id` / `x-user-role` headers.
- **Coverage:**
  - Health endpoint returns service UP + db status.
  - Create order → 201, envelope shape, items persisted, status `PENDING`.
  - List orders → user sees only own; administrator sees all (scoping).
  - Get by id → found; 404 when missing; 404/not-visible across users.
  - Cancel → success on pending; 400 when already cancelled / not pending; 404-style domain error when not owned/missing.
  - Items are eager-loaded (no detached-instance / N+1 reliance).
- SQLite is compatible with the current ORM (`String` ids w/ uuid default, `DateTime`, `Enum`), so no Postgres needed for tests.

---

## 4. Out of scope
- Renaming `models/` ↔ `schemas/` (explicitly declined).
- Repository pattern / async SQLAlchemy.
- Alembic migration changes (B2 is a Python-default fix; column types unchanged, so no new migration needed).
- Dockerfile Python version bump (currently `python:3.9`).
- Auth beyond the existing trusted `x-user-*` headers from the gateway.

---

## 5. Open question for reviewer
- **Repository layer:** the design deliberately omits it (KISS). If you'd prefer the stricter "no I/O in the service" separation, say so and I'll add a thin `api/repositories/orders.py`.
- **Ruff:** want a `[tool.ruff]` config added to `pyproject.toml` for lint/format standardization, or leave tooling untouched?
