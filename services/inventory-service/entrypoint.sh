#!/bin/bash
set -e

echo "🔄 Applying database migrations..."

# Retry until the database is reachable and migrations apply cleanly.
until npx prisma migrate deploy; do
  echo "⏳ Waiting for database to be ready..."
  sleep 2
done

echo "✅ Migrations applied."

echo "🚀 Starting application..."
exec "$@"
