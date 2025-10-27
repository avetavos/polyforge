package models

import "time"

type ProductRecommendation struct {
	ProductID       string    `json:"productId" bson:"productId"`
	Score           float64   `json:"score" bson:"score"`
	Count           int       `json:"count" bson:"count"`
	LastInteraction time.Time `json:"lastInteraction" bson:"lastInteraction"`
}

type UserRecommendation struct {
	UserID   string                  `json:"userId"`
	Products []ProductRecommendation `json:"products"`
}
