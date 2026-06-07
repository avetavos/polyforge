# Inventory Service

Tracks stock levels per SKU and records every inventory movement in an append-only log.

| | |
|---|---|
| **Language / framework** | Node · NestJS |
| **Persistence** | PostgreSQL via Prisma |
| **Location** | `services/inventory-service` |
| **Default port** | 4000 |

## Endpoints

| Method | Path | Description | Headers | Success |
|--------|------|-------------|---------|---------|
| `GET` | `/` | Health check (service + DB) | — | 200 |
| `GET` | `/inventory` | List active items | — | 200 |
| `GET` | `/inventory/:sku` | Get one item by SKU | — | 200 / 404 |
| `POST` | `/inventory` | Create an item | `x-user-id` | 201 / 409 |
| `PATCH` | `/inventory/:sku/quantity` | Adjust available quantity (increment) | `x-user-id` | 200 / 404 |
| `DELETE` | `/inventory/:sku` | Soft-delete an item | `x-user-id` | 204 / 404 |

### Create item — request body

```json
{ "sku": "ELEC-HDPH-001", "quantity": 120 }
```

`sku` must be a non-empty uppercase string; `quantity` is an integer ≥ 1 (validated by the global `ValidationPipe`).

## Internal structure

```
src (inventory-service)
├── main.ts                 # bootstrap, ConfigService port, shutdown hooks
├── app.module.ts           # ConfigModule, PrismaModule, APP_PIPE, APP_FILTER
├── inventory/
│   ├── inventory.controller.ts  # thin handlers, return envelopes
│   ├── inventory.service.ts     # business logic + Prisma access
│   └── dto/                     # class-validator DTOs
├── prisma/                 # @Global() PrismaModule + PrismaService
└── common/
    ├── filters/http-exception.filter.ts  # uniform { message, data: null }
    └── decorators/user-id.decorator.ts   # @UserId() reads x-user-id
```

- **Error handling:** the service throws typed `NotFoundException` / `ConflictException`; a global `HttpExceptionFilter` renders them into the `{ message, data: null }` envelope. Controllers contain no try/catch.
- **Validation:** built-in `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) registered via `APP_PIPE`.
- **Soft delete:** `DELETE` sets `deletedAt`; reads filter `deletedAt: null`.
- **Audit log:** create/update/delete each append an `InventoryLogs` row inside a transaction.

See the [inventory data model](../database/index.md#inventory-service-postgresql) and [stock movements](../business-logic/index.md#inventory-stock-movements).
