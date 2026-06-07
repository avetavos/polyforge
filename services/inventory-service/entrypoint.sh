#!/bin/sh
set -e

echo "🔄 Applying database migrations..."

# Retry while the database is still coming up, but fail fast (non-zero exit)
# after a bounded number of attempts so a genuine migration failure crashes the
# container instead of looping forever. POSIX sh: the image is node:22-alpine,
# which ships /bin/sh (busybox) but not bash.
max_retries=15
count=0
until npx prisma migrate deploy; do
  count=$((count + 1))
  if [ "$count" -ge "$max_retries" ]; then
    echo "❌ Database migrations failed after ${max_retries} attempts."
    exit 1
  fi
  echo "⏳ Waiting for database to be ready (${count}/${max_retries})..."
  sleep 2
done

echo "✅ Migrations applied."

echo "🚀 Starting application..."
exec "$@"
