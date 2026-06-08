# Recommendation Service

Records user interaction events and serves product recommendations (personalized and trending).

| | |
|---|---|
| **Language / framework** | Go · Fiber |
| **Persistence** | MongoDB (driver v2) + Redis cache |
| **Location** | `services/recommendation-service` |
| **Default port** | 8000 |

!!! note "README drift"
    The repo `README` calls this service "Python/FastAPI". The actual implementation is **Go (Fiber)** — see `services/recommendation-service/go.mod` and `cmd/main.go`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check (DB + cache) |
| `GET` | `/recommendations/` | Get recommendations (default scope) |
| `GET` | `/recommendations/trending` | Get trending products |
| `POST` | `/recommendations/rebuild` | Rebuild recommendation aggregates |
| `GET` | `/recommendations/:userID` | Get recommendations for a user |
| `POST` | `/recommendations/event` | Record a user interaction event |

## Data models

```go
// A single tracked interaction (collection: user activity)
type UserActivity struct {
    UserID    string    // userId
    ProductID string    // productId
    EventType string    // e.g. view, add_to_cart, purchase
    Timestamp time.Time
}

// Aggregated recommendation output
type ProductRecommendation struct {
    ProductID       string
    Score           float64
    Count           int
    LastInteraction time.Time
}

type UserRecommendation struct {
    UserID   string
    Products []ProductRecommendation
}
```

## Internal structure

```
recommendation-service
├── cmd/main.go                       # Fiber app bootstrap
├── internal/
│   ├── api/routes.go                 # route registration
│   ├── api/handlers/                 # health, recommendation handlers
│   ├── config/                       # viper config
│   ├── models/                       # UserActivity, UserRecommendation
│   └── services/recommendation.go    # aggregation logic
└── pkg/middleware/context-transformer.go  # identity header handling
```

- **Flow:** clients (or other services) post interaction events to `/recommendations/event`; aggregates are computed (and can be rebuilt via `/recommendations/rebuild`) and served per-user or as trending.
- **Caching:** Redis fronts recommendation reads, keyed via the `CACHE_PREFIX` config (e.g. `recommendation_service`; set from `RECOMMENDATION_CACHE_PREFIX` in compose).

See [recommendation flow](../business-logic/index.md#recommendations).
