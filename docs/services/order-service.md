# Order Service

Manages the order lifecycle: customers create orders, view their own, and cancel pending ones. Administrators can view all orders.

| | |
|---|---|
| **Language / framework** | Python · FastAPI |
| **Persistence** | PostgreSQL via SQLAlchemy; migrations with Alembic |
| **Location** | `services/order-service` |
| **Default port** | 8000 |

## Endpoints

All responses use the `{ message, data }` envelope. Identity comes from gateway headers.

| Method | Path | Description | Headers | Success |
|--------|------|-------------|---------|---------|
| `GET` | `/` | Health check (service + DB) | — | 200 |
| `GET` | `/orders` | List orders — all for `administrator`, own otherwise | `x-user-id`, `x-user-role` | 200 |
| `GET` | `/orders/{order_id}` | Get one order (scoped to caller unless admin) | `x-user-id`, `x-user-role` | 200 / 404 |
| `POST` | `/orders` | Create an order (`PENDING`) | `x-user-id` | 201 |
| `PATCH` | `/orders/{order_id}` | Cancel a pending order | `x-user-id` | 200 / 400 |

### Create order — request body

```json
{
  "items": [
    { "sku": "ELEC-HDPH-001", "qty": 2 },
    { "sku": "COMP-MOUS-005", "qty": 1 }
  ]
}
```

### Response envelope

```json
{
  "message": "Order created successfully",
  "data": {
    "id": "f1e2...",
    "status": "PENDING",
    "items": [{ "id": "...", "sku": "ELEC-HDPH-001", "qty": 2 }],
    "created_at": "2026-06-07T10:00:00Z",
    "updated_at": null
  }
}
```

## Internal structure

```
src (order-service)
├── main.py              # FastAPI app, exception handlers, healthcheck
├── api/
│   ├── deps.py          # get_db, get_current_user (UserContext)
│   ├── router.py        # mounts /orders
│   ├── routes/orders.py # thin handlers, return envelopes
│   └── services/orders.py  # business logic + data access
├── models/              # Pydantic DTOs (request/response)
├── schemas/             # SQLAlchemy ORM models
└── core/                # config (pydantic-settings), exceptions, handlers
```

- **Error handling:** domain exceptions (`OrderNotFoundError` → 404, `OrderNotCancellableError` → 400) are translated to the envelope by registered FastAPI exception handlers; route handlers stay thin.
- **Authorization scoping:** `UserContext.scoped_customer_id` is `None` for `administrator` (sees all) and the caller's id otherwise.
- **Eager loading:** order items are loaded with `selectinload` to avoid N+1 queries.

See the [order data model](../database/index.md#order-service-postgresql) and the [order lifecycle](../business-logic/index.md#order-lifecycle).
