#!/bin/bash
set -e

echo "🔄 Running database migrations..."

# Wait for database to be ready
until alembic current > /dev/null 2>&1; do
  echo "⏳ Waiting for database to be ready..."
  sleep 2
done

# Run migrations
echo "📝 Applying migrations..."
alembic upgrade head

# Check migration status
echo "✅ Current migration:"
alembic current

echo "🚀 Starting application..."
exec "$@"