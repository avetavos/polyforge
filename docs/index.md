# Polyforge

Polyforge is a **polyglot microservices monorepo** (managed with [Nx](https://nx.dev)) for a small e-commerce domain. Each service is written in the language best suited to its job and owns its own database; services sit behind a [Kong](https://konghq.com) API gateway with [Keycloak](https://www.keycloak.org) for authentication, and communicate via [RabbitMQ](https://www.rabbitmq.com) and [Redis](https://redis.io).

## Service map

| Service | Language / Framework | Datastore | Default port | Responsibility |
|---------|----------------------|-----------|--------------|----------------|
| [Order](services/order-service.md) | Python / FastAPI | PostgreSQL | 8000 | Order lifecycle (create, list, cancel) |
| [Inventory](services/inventory-service.md) | Node / NestJS | PostgreSQL | 4000 | Stock levels & inventory transaction log |
| [Catalog](services/catalog-service.md) | Rust / Axum | MongoDB | 3000 | Product catalog _(scaffolded, implementation pending)_ |
| [Recommendation](services/recommendation-service.md) | Go / Fiber | MongoDB + Redis | 5000 | User activity tracking & product recommendations |

!!! note "Documentation is the source of truth here"
    The repository `README.md` lists the Recommendation Service as "Python/FastAPI" — the actual implementation is **Go (Fiber)**. These docs reflect the code as it exists in the repo. Where docs and README disagree, trust the docs (and please fix the README).

## Platform components

| Component | Purpose | Port(s) |
|-----------|---------|---------|
| Kong Gateway | Edge routing, auth enforcement, header injection | 8000 (proxy), 8001 (admin) |
| Keycloak | Identity / OIDC provider | — |
| RabbitMQ | Async messaging between services | 5672 (AMQP), 15672 (UI) |
| Redis | Caching | 6379 |

## What's in these docs

- **[Architecture](architecture/index.md)** — system topology, request flow, auth model.
- **[Infrastructure](infrastructure/index.md)** — docker-compose, databases, env, how to run locally.
- **[Services](services/index.md)** — per-service deep dives (endpoints, internals).
- **[Database Schemas](database/index.md)** — Postgres + MongoDB data models with ER diagrams.
- **[API Reference](api/index.md)** — REST endpoints and the OpenAPI strategy.
- **[Business Logic](business-logic/index.md)** — domain flows (order lifecycle, stock movements, recommendations).

## Quick start

```bash
# Start databases + platform (Podman/Docker compose)
make dev-start-services

# Run migrations (Postgres services)
make sql-db-migrate

# Serve these docs locally
pip install -r requirements-docs.txt
mkdocs serve   # http://127.0.0.1:8000
```
