#!/bin/sh

echo "--- Starting Entrypoint Script ---"

# 1. Sync database schema
echo "Running: npx prisma db push"
npx prisma db push --accept-data-loss

if [ $? -ne 0 ]; then
  echo "Error: prisma db push failed!"
  # We don't exit here to allow the app to try and start, but this is a bad sign.
fi

# 2. Ensure Admin User
echo "Running: node scripts/ensure-admin.js"
node scripts/ensure-admin.js

# 3. Start the application
# In Next.js standalone mode, we run node server.js
echo "Starting Next.js Server..."
if [ -f "server.js" ]; then
  exec node server.js
else
  # Fallback for non-standalone or dev
  exec npm start
fi
