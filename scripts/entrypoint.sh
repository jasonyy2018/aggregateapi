#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrations..."
npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss 2>/dev/null || echo "[entrypoint] Migration skipped (may already be up to date)"

echo "[entrypoint] Ensuring admin user exists..."
node /app/scripts/ensure-admin.js || echo "[entrypoint] Admin setup skipped"

echo "[entrypoint] Starting Next.js server..."
exec node server.js
