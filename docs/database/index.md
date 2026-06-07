# Database Schemas

Every service owns its own database (database-per-service). Two services use PostgreSQL (relational) and two use MongoDB (document).

## Order Service (PostgreSQL)

Defined with SQLAlchemy models and Alembic migrations (`services/order-service`).

```mermaid
erDiagram
    orders ||--o{ order_items : contains
    orders {
        string id PK "uuid"
        string customer_id "indexed"
        enum   status "PENDING|CONFIRMED|CANCELLED"
        datetime created_at
        datetime updated_at "nullable"
    }
    order_items {
        string id PK "uuid"
        string order_id FK
        string sku
        int    qty
    }
```

- `orders.status` is an enum (`PENDING`, `CONFIRMED`, `CANCELLED`); new orders start `PENDING`.
- `order_items` cascade-delete with their parent order.
- `customer_id` carries the `x-user-id` of the creator and drives authorization scoping.

## Inventory Service (PostgreSQL)

Defined with Prisma (`services/inventory-service/prisma/schema.prisma`).

```mermaid
erDiagram
    inventory_items {
        string sku PK
        int    available "default 0"
        int    reserved "default 0"
        datetime created_at
        datetime updated_at
        datetime deleted_at "nullable (soft delete)"
    }
    inventory_logs {
        string id PK "uuid"
        string sku
        enum   type "CREATE|UPDATE|DELETE"
        int    quantity
        string user_id
        datetime created_at
    }
```

- `inventory_items` uses `sku` as its primary key and supports soft deletes via `deleted_at`.
- `inventory_logs` is an append-only audit trail; every create/update/delete writes one row inside the same transaction as the mutation.
- `InventoryTransactionType` enum: `CREATE`, `UPDATE`, `DELETE`.

## Catalog Service (MongoDB)

Database `catalog_db`, collection `products` (shape defined by the dev seed; see [Catalog Service](../services/catalog-service.md)).

```mermaid
erDiagram
    products {
        ObjectId _id PK
        string sku UK "unique index"
        string name
        string slug
        string description
        string category
        string brand
        double price
        string currency
        array  tags
        date   createdAt
        date   updatedAt
    }
```

`sku` carries a unique index and is shared with `inventory_items` so catalog and stock data align.

## Recommendation Service (MongoDB)

Database on port `27018`. Documents derived from Go structs (`services/recommendation-service/internal/models`).

```mermaid
erDiagram
    user_activity {
        ObjectId _id PK
        string userId
        string productId
        string eventType
        date   timestamp
    }
    recommendations {
        string userId
        array  products "[{ productId, score, count, lastInteraction }]"
    }
```

- `user_activity` is the raw interaction event stream.
- Recommendation aggregates store, per user, a list of `{ productId, score, count, lastInteraction }`.
