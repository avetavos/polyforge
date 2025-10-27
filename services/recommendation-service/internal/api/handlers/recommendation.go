package handlers

import (
	"strconv"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/mongo"

	"polyforge-recommendation/internal/config"
	"polyforge-recommendation/internal/services"
)

type RecommendationHandlers struct {
	service   *services.RecommendationService
	validator *validator.Validate
}

func NewRecommendationHandlers(db *mongo.Database, cache *redis.Client, cfg config.Config) *RecommendationHandlers {
	return &RecommendationHandlers{
		service:   services.NewRecommendationService(db, cache, cfg),
		validator: validator.New(),
	}
}

func (h *RecommendationHandlers) GetRecommendationsHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID := c.Locals("userID").(string)
		limit := 10
		if l := c.Query("limit"); l != "" {
			if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 {
				limit = parsedLimit
			}
		}

		recommendations, err := h.service.GetUserRecommendations(c.Context(), userID, limit)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"message": "Failed to get recommendations: " + err.Error(),
				"data":    nil,
			})
		}

		go h.service.SaveUserRecommendation(c.Context(), recommendations)
		return c.JSON(fiber.Map{
			"message": "Recommendations fetched successfully",
			"data":    recommendations,
		})
	}
}

func (h *RecommendationHandlers) GetTrendingRecommendationHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		data, err := h.service.GetTrendingRecommendations(c.Context())
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"message": "Failed to get trending recommendations: " + err.Error(),
				"data":    nil,
			})
		}

		return c.JSON(fiber.Map{
			"message": "Trending recommendations fetched successfully",
			"data":    data,
		})
	}
}

func (h *RecommendationHandlers) RebuildRecommendationsHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		go h.service.ReCalculateUserRecommendations(c.Context())

		return c.JSON(fiber.Map{
			"message": "Recommendation rebuilding started",
			"data":    nil,
		})
	}
}

func (h *RecommendationHandlers) GetRecommendationsByUserIDHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID := c.Params("userID")
		limit := 10
		if l := c.Query("limit"); l != "" {
			if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 {
				limit = parsedLimit
			}
		}

		data, err := h.service.GetUserRecommendations(c.Context(), userID, limit)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"message": "Failed to get recommendations: " + err.Error(),
				"data":    nil,
			})
		}

		return c.JSON(fiber.Map{
			"message": "Recommendations fetched successfully",
			"data":    data,
		})
	}
}

type RecommendationEventPayload struct {
	ProductID string `json:"productId" validate:"required,uuid4"`
	EventType string `json:"eventType" validate:"required,oneof=VIEW PURCHASE CART_ADD"`
}

func (h *RecommendationHandlers) RecordUserInteractionHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		payload := new(RecommendationEventPayload)
		if err := c.BodyParser(payload); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"message": "Invalid request payload: " + err.Error(),
				"data":    nil,
			})
		}

		if err := h.validator.Struct(payload); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"message": "Validation failed: " + err.Error(),
				"data":    nil,
			})
		}

		userID := c.Locals("userID").(string)

		data, err := h.service.RecordUserInteraction(c.Context(), userID, payload.ProductID, payload.EventType)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"message": "Failed to record user interaction: " + err.Error(),
				"data":    nil,
			})
		}

		return c.JSON(fiber.Map{
			"message": "User interaction recorded successfully",
			"data":    data,
		})
	}
}
