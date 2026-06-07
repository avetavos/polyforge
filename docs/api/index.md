# API Reference

All services are reached through the Kong gateway and share the response envelope:

```json
{ "message": "human-readable result", "data": <payload> | null }
```

Errors use the same shape with `data: null` and an appropriate HTTP status.

## Endpoint summary

### Order Service

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/` | Health |
| `GET` | `/orders` | Admin: all; user: own |
| `GET` | `/orders/{order_id}` | 404 if not found / not visible |
| `POST` | `/orders` | 201; body `{ items: [{ sku, qty }] }` |
| `PATCH` | `/orders/{order_id}` | Cancel pending; 400 if not cancellable |

### Inventory Service

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/` | Health |
| `GET` | `/inventory` | Active items |
| `GET` | `/inventory/:sku` | 404 if missing |
| `POST` | `/inventory` | 201; 409 if SKU exists; body `{ sku, quantity }` |
| `PATCH` | `/inventory/:sku/quantity` | Increment available; 404 if missing |
| `DELETE` | `/inventory/:sku` | 204 (no body); soft delete |

### Recommendation Service

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/` | Health |
| `GET` | `/recommendations/` | Recommendations |
| `GET` | `/recommendations/trending` | Trending products |
| `POST` | `/recommendations/rebuild` | Rebuild aggregates |
| `GET` | `/recommendations/:userID` | Per-user recommendations |
| `POST` | `/recommendations/event` | Record interaction |

### Catalog Service

Endpoints are proposed but not yet implemented — see [Catalog Service](../services/catalog-service.md).

## OpenAPI strategy

The recommended path to machine-readable, always-current API specs is to generate **OpenAPI** per service and embed it here:

- **Order** (FastAPI) — OpenAPI is auto-generated; export with a small script hitting `/openapi.json` or `app.openapi()`, save to `docs/api/specs/order.json`.
- **Inventory** (NestJS) — add `@nestjs/swagger`, decorate DTOs/controllers, and emit the document to `docs/api/specs/inventory.json`.
- **Recommendation** (Go/Fiber) — generate with `swaggo/swag` or hand-author an OpenAPI file.
- **Catalog** (Rust/Axum) — use `utoipa` once handlers exist.

To render the specs in this site, add a renderer plugin (e.g. `mkdocs-render-swagger-plugin` or `neoteroi-mkdocs`) to `requirements-docs.txt` and embed each spec on a per-service API page. This keeps the rendered reference in lock-step with the code.

!!! tip "Next step"
    These specs aren't wired up yet — the tables above are the current, hand-maintained reference. Generating and embedding OpenAPI per service is the recommended follow-up to make this page self-updating.
