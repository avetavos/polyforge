package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type HealthCheckHandler struct {
	db    *mongo.Database
	cache *redis.Client
}

func NewHealthCheckHandler(db *mongo.Database, cache *redis.Client) *HealthCheckHandler {
	return &HealthCheckHandler{db: db, cache: cache}
}

func (h *HealthCheckHandler) HealthCheck() fiber.Handler {
	return func(c *fiber.Ctx) error {
		dbStatus := "DOWN"
		if err := h.db.Client().Ping(c.Context(), nil); err == nil {
			dbStatus = "UP"
		}

		cacheStatus := "DOWN"
		if err := h.cache.Ping(c.Context()).Err(); err == nil {
			cacheStatus = "UP"
		}

		return c.JSON(fiber.Map{
			"service":  "UP",
			"database": dbStatus,
			"cache":    cacheStatus,
		})
	}
}
