#!/bin/sh
set -e

echo "[entrypoint] Syncing database schema with Prisma..."
# Use db push since we don't have migration files — this creates/updates tables
# to match the Prisma schema without requiring a migrations directory.
npx prisma db push --skip-generate --accept-data-loss 2>&1 || {
  echo "[entrypoint] WARNING: prisma db push failed, retrying in 3s..."
  sleep 3
  npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "[entrypoint] prisma db push failed again — continuing anyway"
}

echo "[entrypoint] Ensuring admin user exists..."
node /app/scripts/ensure-admin.js || echo "[entrypoint] Admin setup skipped"

echo "[entrypoint] Starting Next.js server..."
exec node server.js
