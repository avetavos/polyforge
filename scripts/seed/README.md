# Dev seed: mock products

Development-only mock product data for local testing. A single source of truth
(`products.json`) is consumed by both seeders so SKUs line up across services:

- **Catalog** (MongoDB, `catalog_db.products`) — full product documents
  (name, slug, description, category, brand, price, currency, tags).
- **Inventory** (PostgreSQL, `inventory_items`) — stock rows (sku, available,
  reserved) matching the same SKUs.

Both seeders are **idempotent** (upsert by `sku`) and are **not** bundled into
any container image.

## Files

| File | Purpose |
|------|---------|
| `products.json` | Canonical mock product dataset (source of truth). |
| `seed-catalog.mjs` | Node + `mongodb` driver seeder for the catalog Mongo DB. |
| `../../services/inventory-service/prisma/seed.ts` | Prisma seeder for the inventory Postgres DB. |

## Prerequisites

Start the database containers first:

```bash
make dev-start-services
```

## Run everything (recommended)

From the repo root:

```bash
make seed
```

This applies inventory migrations, runs the Prisma seed, then seeds the catalog.

## Run individually

Inventory (Postgres) — from `services/inventory-service`:

```bash
npx prisma migrate deploy   # ensure tables exist
npx prisma db seed          # runs prisma/seed.ts
```

Catalog (MongoDB) — from `scripts/seed`:

```bash
npm install
npm run seed:catalog
```

## Configuration

The catalog seeder reads connection settings from env with local-dev defaults
that match `infra/docker-compose.yml` + the root `.env`:

| Env var | Default |
|---------|---------|
| `CATALOG_DB_URI` | `mongodb://catalog_user:catalog_password@localhost:27017/?authSource=admin` |
| `CATALOG_DB_NAME` | `catalog_db` |

The inventory seeder uses `DATABASE_URL` from `services/inventory-service/.env`
(Prisma loads it automatically).

## Adding / editing products

Edit `products.json` only, then re-run the seeders — they upsert, so existing
rows/documents are updated in place and new SKUs are inserted.
