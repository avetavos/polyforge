# Architecture

Polyforge follows a **database-per-service** microservices pattern. Clients talk only to the Kong gateway; Kong authenticates requests (via Keycloak), strips/injects identity headers, and routes to the owning service. Each service owns its datastore exclusively — there are no cross-service database reads.

## System topology

```mermaid
flowchart TB
    client([Client])
    kong[Kong API Gateway<br/>:8000]
    kc[Keycloak<br/>OIDC]

    subgraph services [Services]
        order[Order Service<br/>FastAPI]
        inv[Inventory Service<br/>NestJS]
        cat[Catalog Service<br/>Axum]
        rec[Recommendation Service<br/>Fiber]
    end

    subgraph data [Datastores]
        orderdb[(Order DB<br/>PostgreSQL)]
        invdb[(Inventory DB<br/>PostgreSQL)]
        catdb[(Catalog DB<br/>MongoDB)]
        recdb[(Recommendation DB<br/>MongoDB)]
        redis[(Redis)]
    end

    mq{{RabbitMQ}}

    client --> kong
    kong -. validates token .-> kc
    kong --> order
    kong --> inv
    kong --> cat
    kong --> rec

    order --> orderdb
    inv --> invdb
    cat --> catdb
    rec --> recdb
    rec --> redis

    order -. events .-> mq
    inv -. events .-> mq
    cat -. events .-> mq
    rec -. events .-> mq
```

## Request flow

A typical authenticated request:

```mermaid
sequenceDiagram
    participant C as Client
    participant K as Kong
    participant KC as Keycloak
    participant S as Service
    participant DB as Service DB

    C->>K: HTTP request + Bearer token
    K->>KC: Validate token (OIDC)
    KC-->>K: Claims (sub, roles)
    K->>S: Forward request + x-user-id / x-user-role headers
    S->>DB: Query / mutate (scoped to user)
    DB-->>S: Rows / documents
    S-->>K: { message, data } envelope
    K-->>C: Response
```

## Identity & authorization

- **Authentication** is handled at the edge (Kong + Keycloak). Services do **not** validate tokens themselves.
- Kong injects trusted identity headers that downstream services read:
  - `x-user-id` — the authenticated subject.
  - `x-user-role` — e.g. `administrator` vs. a regular user.
- Services apply **authorization scoping** from these headers. For example, the Order Service returns all orders for an `administrator` but only the caller's own orders otherwise.

!!! warning "Services trust the gateway"
    Because services treat `x-user-*` headers as trusted, they must **only** be reachable through Kong in any deployed environment. Never expose a service port directly.

## Cross-cutting conventions

- **Response envelope:** REST endpoints return `{ "message": string, "data": <payload> | null }`. Errors use the same shape with `data: null`.
- **Soft deletes:** where applicable (e.g. inventory items), rows are flagged with a `deletedAt` timestamp rather than physically removed; reads filter these out.
- **Audit / transaction logs:** mutating operations may append to an append-only log collection/table (see the Inventory Service).
