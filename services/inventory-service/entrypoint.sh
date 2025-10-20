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
npx prisma db migrate deploy

# Check migration status
echo "✅ Current migration:"
npx prisma db status

echo "🚀 Starting application..."
exec "$@"