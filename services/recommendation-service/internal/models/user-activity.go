package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type UserActivity struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"-"`
	UserID    string             `bson:"userId,omitempty" json:"userId,omitempty"`
	ProductID string             `bson:"productId,omitempty" json:"productId,omitempty"`
	EventType string             `bson:"eventType,omitempty" json:"eventType,omitempty"`
	Timestamp time.Time          `bson:"timestamp" json:"timestamp"`
}
