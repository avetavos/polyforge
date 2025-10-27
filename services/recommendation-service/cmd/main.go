package main

import (
	"log"
	"polyforge-recommendation/internal/api"
	"polyforge-recommendation/internal/config"
	"polyforge-recommendation/pkg/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func main() {
	cfg := config.LoadConfig()

	dbc, err := mongo.Connect(options.Client().ApplyURI(cfg.GetDatabaseURI()))
	if err != nil {
		log.Fatal("Failed to connect to database: ", err)
	}
	db := dbc.Database(cfg.Database.DatabaseName)

	rdc := redis.NewClient(&redis.Options{Addr: cfg.GetCacheAddress()})

	app := fiber.New()

	app.Use(middleware.ContextTransformer)

	api.SetupRoutes(app, db, rdc, cfg)

	log.Fatal(app.Listen(":8000"))
}
