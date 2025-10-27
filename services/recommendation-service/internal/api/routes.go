package api

import (
	"polyforge-recommendation/internal/api/handlers"
	"polyforge-recommendation/internal/config"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type HandlerFactory struct {
	Recommendation *handlers.RecommendationHandlers
}

func NewHandlerFactory(db *mongo.Database, cache *redis.Client, cfg config.Config) *HandlerFactory {
	return &HandlerFactory{
		Recommendation: handlers.NewRecommendationHandlers(db, cache, cfg),
	}
}

func SetupRoutes(app *fiber.App, db *mongo.Database, cache *redis.Client, cfg config.Config) {
	// health check route
	app.Get("/", handlers.NewHealthCheckHandler(db, cache).HealthCheck())

	handlers := NewHandlerFactory(db, cache, cfg)

	// recommendation routes
	recommendationGroup := app.Group("/recommendations")
	recommendationGroup.Get("/", handlers.Recommendation.GetRecommendationsHandler())
	recommendationGroup.Get("/trending", handlers.Recommendation.GetTrendingRecommendationHandler())
	recommendationGroup.Post("/rebuild", handlers.Recommendation.RebuildRecommendationsHandler())
	recommendationGroup.Get("/:userID", handlers.Recommendation.GetRecommendationsByUserIDHandler())
	recommendationGroup.Post("/event", handlers.Recommendation.RecordUserInteractionHandler())
}
