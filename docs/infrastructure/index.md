# Infrastructure

Local infrastructure is defined in `infra/docker-compose.yml` and driven through the root `Makefile`. The stack runs on Podman (or Docker) Compose.

## Components

| Service | Image | Notes |
|---------|-------|-------|
| `order_database` | `postgres:15` | Order Service datastore |
| `inventory_database` | `postgres:15` | Inventory Service datastore (host port `5433`) |
| `catalog_database` | `mongo:8.0` | Catalog Service datastore (host port `27017`) |
| `recommendation_database` | `mongo:8.0` | Recommendation Service datastore (host port `27018`) |
| `redis` | `redis:latest` | Cache (port `6379`) |
| `rabbitmq` | `rabbitmq:3-management` | Messaging (`5672` AMQP, `15672` UI) |
| `kong` | `polyforge-kong:1.5` | API gateway (DB-less mode) |
| `keycloak` + `keycloak-database` | `quay.io/keycloak/keycloak` + `postgres:15` | Identity provider |

## Running locally

```bash
# Start databases + platform services (detached)
make dev-start-services

# Stop them
make dev-stop-services

# Apply Postgres migrations (inventory: Prisma, order: Alembic)
make sql-db-migrate

# Keycloak realm/client migration
make keycloak-migrate
```

## Configuration

Environment is provided via the root `.env` (compose) and per-service `.env` files. Key variables:

| Variable | Used by | Example |
|----------|---------|---------|
| `ORDER_DB_*` | Order DB | `order_user` / `order_password` / `order_db` |
| `INVENTORY_DB_*` | Inventory DB | port `5433`, `inventory_db` |
| `CATALOG_DB_*` | Catalog Mongo | `catalog_user` / `catalog_password`, `catalog_db`, port `27017` |
| `RECOMMENDATION_DB_*` | Recommendation Mongo | port `27018` |
| `REDIS_PORT` | Redis | `6379` |

!!! tip "Per-service DATABASE_URL"
    The Postgres services read a connection string directly — e.g. Inventory's `services/inventory-service/.env` contains
    `DATABASE_URL=postgresql://inventory_user:inventory_password@localhost:5433/inventory_db`.

## Seeding development data

Mock product data can be loaded into both the catalog (Mongo) and inventory (Postgres) databases from a single source of truth (`scripts/seed/products.json`):

```bash
make seed
```

This runs the inventory Prisma seed and the catalog Mongo seed, sharing SKUs so the two stores stay coherent. The seeders are idempotent and development-only.

## Containers & entrypoints

Each service ships a `dockerfile`. Postgres-backed services run migrations on startup via an `entrypoint.sh`:

- **Inventory** — `npx prisma migrate deploy` (retry loop until the DB is reachable), then starts the app.
- **Order** — `alembic upgrade head`, then starts the app.

## Gateway & auth

- **Kong** runs DB-less (`KONG_DATABASE: "off"`); routes and plugins are declared in `infra/`.
- **Keycloak** is the OIDC provider backed by its own Postgres. Kong validates tokens and forwards `x-user-id` / `x-user-role` to services (see [Architecture](../architecture/index.md)).
