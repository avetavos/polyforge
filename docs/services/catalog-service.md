# Catalog Service

Owns the product catalog — the canonical product master data (name, description, price, category, etc.) keyed by SKU.

| | |
|---|---|
| **Language / framework** | Rust · Axum · Tokio |
| **Persistence** | MongoDB (`mongodb` crate) |
| **Location** | `services/catalog-service` |
| **Default port** | 3000 |

!!! warning "Scaffold only"
    As of this writing the catalog service contains the Cargo project scaffold and dependencies (`axum`, `tokio`, `serde`, `mongodb`) but **no `src/` handlers yet** — the implementation is pending (tracked as an open item in the repo `README`). This page documents the intended design and the seed-defined document shape.

## Intended product document

The development seed (`scripts/seed/products.json` → `catalog_db.products`) defines the working product shape:

```json
{
  "sku": "ELEC-HDPH-001",
  "name": "Aurora Wireless Noise-Cancelling Headphones",
  "slug": "aurora-wireless-noise-cancelling-headphones",
  "description": "Over-ear Bluetooth 5.3 headphones ...",
  "category": "Audio",
  "brand": "Aurora",
  "price": 249.99,
  "currency": "USD",
  "tags": ["headphones", "wireless", "noise-cancelling"],
  "createdAt": "2026-06-07T00:00:00Z",
  "updatedAt": "2026-06-07T00:00:00Z"
}
```

`sku` is the natural key and has a unique index; it is shared with the Inventory Service so catalog products and stock rows line up.

## Proposed endpoints (to implement)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/products` | List / search products |
| `GET` | `/products/{sku}` | Get a product by SKU |
| `POST` | `/products` | Create a product |
| `PATCH` | `/products/{sku}` | Update a product |
| `DELETE` | `/products/{sku}` | Remove a product |

When implementing, follow the shared conventions: the `{ message, data }` envelope and `x-user-*` gateway headers. See the [catalog data model](../database/index.md#catalog-service-mongodb).
