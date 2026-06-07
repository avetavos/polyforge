dev-start-services: 
	podman compose --env-file .env -f infra/docker-compose.yml up \
		order_database \
		inventory_database \
		catalog_database \
		recommendation_database \
		redis \
		rabbitmq \
		kong \
		keycloak \
		keycloak-database \
		redis \
		-d

dev-stop-services:
	podman compose --env-file .env -f infra/docker-compose.yml down \
		order_database \
		inventory_database \
		catalog_database \
		recommendation_database \
		redis \
		rabbitmq \
		kong \
		keycloak \
		keycloak-database \
		redis \

sql-db-migrate:
	cd services/inventory-service && \
	npx prisma migrate deploy && \
	cd ../order-service && \
	alembic upgrade head

keycloak-migrate:
	ENV_FILE=.env ./infra/keycloak/migrate.sh