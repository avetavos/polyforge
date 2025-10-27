package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"polyforge-recommendation/internal/config"
	"polyforge-recommendation/internal/models"
)

type RecommendationService struct {
	db    *mongo.Database
	cache *redis.Client
	cfg   config.Config
}

func NewRecommendationService(db *mongo.Database, cache *redis.Client, cfg config.Config) *RecommendationService {
	return &RecommendationService{db: db, cache: cache, cfg: cfg}
}

func (s *RecommendationService) RecordUserInteraction(ctx context.Context, userID, productID, eventType string) (*models.UserActivity, error) {
	collection := s.db.Collection("events")
	now := time.Now()
	_, err := collection.InsertOne(ctx, models.UserActivity{
		UserID:    userID,
		ProductID: productID,
		EventType: eventType,
		Timestamp: now,
	})
	if err != nil {
		return nil, err
	}
	return &models.UserActivity{
		UserID:    userID,
		ProductID: productID,
		EventType: eventType,
		Timestamp: now,
	}, nil
}

func (s *RecommendationService) GetUserRecommendations(ctx context.Context, userID string, limit int) (models.UserRecommendation, error) {
	var recommendations models.UserRecommendation
	recommendations.UserID = userID

	key := fmt.Sprintf("%s:user_recommendations:%s", s.cfg.Cache.Prefix, userID)
	getCmd := s.cache.Get(ctx, key)
	if getCmd.Err() == nil {
		var products []models.ProductRecommendation
		err := json.Unmarshal([]byte(getCmd.Val()), &products)
		if err != nil {
			fmt.Printf("Error unmarshaling cached recommendations: %v\n", err)
		}
		if len(products) < limit {
			recommendations.Products = products
		} else {
			recommendations.Products = products[:limit]
		}
		return recommendations, nil
	}

	collection := s.db.Collection("user_recommendations")
	err := collection.FindOne(ctx, bson.M{"userId": userID}).Decode(&recommendations)
	// if no recommendations found, return empty list
	if err == mongo.ErrNoDocuments {
		return recommendations, nil
	} else if err != nil {
		return recommendations, err
	}

	if len(recommendations.Products) > limit {
		recommendations.Products = recommendations.Products[:limit]
	}

	return recommendations, nil
}

func (s *RecommendationService) SaveUserRecommendation(ctx context.Context, recommendation models.UserRecommendation) {
	err := s.storeUserRecommendations(ctx, recommendation)
	if err != nil {
		fmt.Printf("Error storing user recommendations: %v\n", err)
		return
	}

	err = s.cacheUserRecommendation(ctx, recommendation)
	if err != nil {
		fmt.Printf("Error caching user recommendations: %v\n", err)
		return
	}
}

func (s *RecommendationService) storeUserRecommendations(ctx context.Context, recommendation models.UserRecommendation) error {
	collection := s.db.Collection("user_recommendations")
	_, err := collection.UpdateOne(ctx,
		bson.M{"userId": recommendation.UserID},
		bson.M{"$set": bson.M{"products": recommendation.Products}},
		options.UpdateOne().SetUpsert(true),
	)

	return err
}

func (s *RecommendationService) cacheUserRecommendation(ctx context.Context, recommendation models.UserRecommendation) error {
	key := fmt.Sprintf("%s:user_recommendations:%s", s.cfg.Cache.Prefix, recommendation.UserID)

	jsonData, err := json.Marshal(recommendation.Products)
	if err != nil {
		return err
	}

	setCmd := s.cache.Set(ctx, key, string(jsonData), 12*time.Hour)
	return setCmd.Err()
}

func (s *RecommendationService) clearUserRecommendationCache(ctx context.Context) error {
	pattern := fmt.Sprintf("%s:user_recommendations:*", s.cfg.Cache.Prefix)
	var cursor uint64
	for {
		keys, nextCursor, err := s.cache.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return err
		}

		if len(keys) > 0 {
			if err := s.cache.Del(ctx, keys...).Err(); err != nil {
				return err
			}
		}

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return nil
}

func (s *RecommendationService) ReCalculateUserRecommendations(ctx context.Context) {
	collection := s.db.Collection("events")

	userIDsResult := collection.Distinct(ctx, "userId", bson.M{})
	if userIDsResult.Err() != nil {
		fmt.Printf("Error fetching distinct user IDs: %v\n", userIDsResult.Err())
		return
	}

	var userIDs []string
	if err := userIDsResult.Decode(&userIDs); err != nil {
		fmt.Printf("Error decoding user IDs: %v\n", err)
		return
	}

	for _, userID := range userIDs {
		pipeline := []bson.M{
			{"$match": bson.M{"userId": userID}},
			{"$group": bson.M{
				"_id":             "$productId",
				"count":           bson.M{"$sum": 1},
				"lastInteraction": bson.M{"$max": "$timestamp"},
				"viewCount": bson.M{
					"$sum": bson.M{
						"$cond": bson.M{
							"if":   bson.M{"$eq": []interface{}{"$eventType", "VIEW"}},
							"then": 1,
							"else": 0,
						},
					},
				},
				"cartAddCount": bson.M{
					"$sum": bson.M{
						"$cond": bson.M{
							"if":   bson.M{"$eq": []interface{}{"$eventType", "CART_ADD"}},
							"then": 1,
							"else": 0,
						},
					},
				},
				"purchaseCount": bson.M{
					"$sum": bson.M{
						"$cond": bson.M{
							"if":   bson.M{"$eq": []interface{}{"$eventType", "PURCHASE"}},
							"then": 1,
							"else": 0,
						},
					},
				},
			}},
			// Calculate raw score first
			{"$addFields": bson.M{
				"rawScore": bson.M{
					"$add": []interface{}{
						bson.M{"$multiply": []interface{}{"$viewCount", 1}},
						bson.M{"$multiply": []interface{}{"$cartAddCount", 3}},
						bson.M{"$multiply": []interface{}{"$purchaseCount", 5}}, // Reduced from 10 to 5
					},
				},
			}},
			// Add count factor and normalize to max 10
			{"$addFields": bson.M{
				"countFactor": bson.M{
					"$cond": bson.M{
						"if":   bson.M{"$gte": []interface{}{"$count", 100}},
						"then": 2.0,
						"else": bson.M{
							"$cond": bson.M{
								"if":   bson.M{"$gte": []interface{}{"$count", 50}},
								"then": 1.5,
								"else": bson.M{
									"$cond": bson.M{
										"if":   bson.M{"$gte": []interface{}{"$count", 10}},
										"then": 1.2,
										"else": 1.0,
									},
								},
							},
						},
					},
				},
			}},
			// Calculate final score (max 10)
			{"$addFields": bson.M{
				"score": bson.M{
					"$round": []interface{}{
						bson.M{
							"$min": []interface{}{
								bson.M{
									"$multiply": []interface{}{
										bson.M{"$divide": []interface{}{"$rawScore", "$count"}}, // Average score per interaction
										"$countFactor",
										bson.M{"$ln": bson.M{"$add": []interface{}{"$count", 1}}}, // Log factor for count
									},
								},
								10, // Cap at 10
							},
						},
						2, // Round to 2 decimal places
					},
				},
			}},
			{"$project": bson.M{
				"productId":       "$_id",
				"count":           1,
				"lastInteraction": 1,
				"score":           1,
				"viewCount":       1,
				"cartAddCount":    1,
				"purchaseCount":   1,
				"_id":             0,
			}},
			{"$sort": bson.M{"score": -1}},
		}

		var recommendations models.UserRecommendation
		recommendations.UserID = userID
		cursor, err := collection.Aggregate(ctx, pipeline)
		if err != nil {
			fmt.Printf("Error aggregating recommendations for user %s: %v\n", userID, err)
			return
		}
		defer cursor.Close(ctx)

		if err = cursor.All(ctx, &recommendations.Products); err != nil {
			fmt.Printf("Error decoding recommendations for user %s: %v\n", userID, err)
			return
		}

		err = s.storeUserRecommendations(ctx, recommendations)
		if err != nil {
			fmt.Printf("Error storing recommendations for user %s: %v\n", userID, err)
			return
		}
	}

	err := s.clearUserRecommendationCache(ctx)
	if err != nil {
		fmt.Printf("Error clearing recommendation cache: %v\n", err)
	}
}

func (s *RecommendationService) GetTrendingRecommendations(ctx context.Context) ([]models.ProductRecommendation, error) {
	collection := s.db.Collection("events")

	pipeline := []bson.M{
		{"$group": bson.M{
			"_id":             "$productId",
			"count":           bson.M{"$sum": 1},
			"lastInteraction": bson.M{"$max": "$timestamp"},
			"viewCount": bson.M{
				"$sum": bson.M{
					"$cond": bson.M{
						"if":   bson.M{"$eq": []interface{}{"$eventType", "VIEW"}},
						"then": 1,
						"else": 0,
					},
				},
			},
			"cartAddCount": bson.M{
				"$sum": bson.M{
					"$cond": bson.M{
						"if":   bson.M{"$eq": []interface{}{"$eventType", "CART_ADD"}},
						"then": 1,
						"else": 0,
					},
				},
			},
			"purchaseCount": bson.M{
				"$sum": bson.M{
					"$cond": bson.M{
						"if":   bson.M{"$eq": []interface{}{"$eventType", "PURCHASE"}},
						"then": 1,
						"else": 0,
					},
				},
			},
		}},
		// Calculate raw score first
		{"$addFields": bson.M{
			"rawScore": bson.M{
				"$add": []interface{}{
					bson.M{"$multiply": []interface{}{"$viewCount", 5}},
					bson.M{"$multiply": []interface{}{"$cartAddCount", 3}},
					bson.M{"$multiply": []interface{}{"$purchaseCount", 2}}, // Reduced from 10 to 5
				},
			},
		}},
		// Add count factor and normalize to max 10
		{"$addFields": bson.M{
			"countFactor": bson.M{
				"$cond": bson.M{
					"if":   bson.M{"$gte": []interface{}{"$count", 100}},
					"then": 2.0,
					"else": bson.M{
						"$cond": bson.M{
							"if":   bson.M{"$gte": []interface{}{"$count", 50}},
							"then": 1.5,
							"else": bson.M{
								"$cond": bson.M{
									"if":   bson.M{"$gte": []interface{}{"$count", 10}},
									"then": 1.2,
									"else": 1.0,
								},
							},
						},
					},
				},
			},
		}},
		// Calculate final score (max 10) and round to 2 decimal places
		{"$addFields": bson.M{
			"score": bson.M{
				"$round": []interface{}{
					bson.M{
						"$min": []interface{}{
							bson.M{
								"$multiply": []interface{}{
									bson.M{"$divide": []interface{}{"$rawScore", "$count"}}, // Average score per interaction
									"$countFactor",
									bson.M{"$ln": bson.M{"$add": []interface{}{"$count", 1}}}, // Log factor for count
								},
							},
							10, // Cap at 10
						},
					},
					2, // Round to 2 decimal places
				},
			},
		}},
		{"$project": bson.M{
			"productId":       "$_id",
			"count":           1,
			"lastInteraction": 1,
			"score":           1,
			"viewCount":       1,
			"cartAddCount":    1,
			"purchaseCount":   1,
			"_id":             0,
		}},
		{"$sort": bson.M{"score": -1}},
	}

	var trending []models.ProductRecommendation
	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		fmt.Printf("Error aggregating trending recommendations: %v\n", err)
		return nil, err
	}
	defer cursor.Close(ctx)

	if err = cursor.All(ctx, &trending); err != nil {
		fmt.Printf("Error decoding trending recommendations: %v\n", err)
		return nil, err
	}

	return trending, nil
}
