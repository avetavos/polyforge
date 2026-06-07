# Services

Each service is independently deployable, owns its datastore, and exposes a REST API behind Kong. They share two conventions: the `{ message, data }` response envelope and trusted `x-user-*` identity headers from the gateway.

| Service | Stack | Datastore | Status |
|---------|-------|-----------|--------|
| [Order](order-service.md) | Python / FastAPI / SQLAlchemy / Alembic | PostgreSQL | Implemented |
| [Inventory](inventory-service.md) | Node / NestJS / Prisma | PostgreSQL | Implemented |
| [Catalog](catalog-service.md) | Rust / Axum | MongoDB | Scaffolded (no handlers yet) |
| [Recommendation](recommendation-service.md) | Go / Fiber | MongoDB + Redis | Implemented |

Pick a service from the navigation for endpoints, data flow, and implementation notes.
