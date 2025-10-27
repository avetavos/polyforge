package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Database DatabaseConfig
	Cache    CacheConfig
}

type DatabaseConfig struct {
	Username     string
	Password     string
	Host         string
	Port         int
	DatabaseName string
}

type CacheConfig struct {
	Host   string
	Port   int
	Prefix string
}

func LoadConfig() Config {
	dbCfg := DatabaseConfig{
		Username:     getEnv("DB_USER", ""),
		Password:     getEnv("DB_PASSWORD", ""),
		Host:         getEnv("DB_HOST", "localhost"),
		Port:         getEnvInt("DB_PORT", 27017),
		DatabaseName: getEnv("DB_NAME", "recommendation"),
	}

	cacheCfg := CacheConfig{
		Host:   getEnv("CACHE_HOST", "localhost"),
		Port:   getEnvInt("CACHE_PORT", 6379),
		Prefix: getEnv("CACHE_PREFIX", "polyforge:recommendation"),
	}

	return Config{
		Database: dbCfg,
		Cache:    cacheCfg,
	}
}

func (c Config) GetDatabaseURI() string {
	return fmt.Sprintf("mongodb://%s:%s@%s:%d/", c.Database.Username, c.Database.Password, c.Database.Host, c.Database.Port)
}

func (c Config) GetCacheAddress() string {
	return fmt.Sprintf("%s:%d", c.Cache.Host, c.Cache.Port)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
