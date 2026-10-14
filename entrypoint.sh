#!/bin/sh

# Entrypoint script for Pterodactyl deployment
# This script handles initialization and startup

set -e

echo "=== Task Reminder Starting ==="
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

# Ensure data directories exist
mkdir -p /app/data/sessions /app/data/whatsapp-auth

# Check if database exists, if not run migrations
if [ ! -f "$DATABASE_PATH" ]; then
    echo "Database not found, running migrations..."
    node backend/dist/db/migrate.js
    
    # Seed development data if in development mode
    if [ "$NODE_ENV" = "development" ]; then
        echo "Seeding development data..."
        node backend/dist/db/seed.js
    fi
else
    echo "Database found at $DATABASE_PATH"
fi

# Verify critical environment variables
if [ -z "$SESSION_SECRET" ] || [ ${#SESSION_SECRET} -lt 32 ]; then
    echo "WARNING: SESSION_SECRET is not set or too short!"
    echo "Generating temporary secret for this session..."
    export SESSION_SECRET=$(openssl rand -hex 32)
fi

if [ -z "$APP_BASE_URL" ]; then
    echo "WARNING: APP_BASE_URL not set, using default"
    export APP_BASE_URL="http://localhost:$PORT"
fi

echo "=== Configuration ==="
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "DATABASE_PATH: $DATABASE_PATH"
echo "APP_BASE_URL: $APP_BASE_URL"
echo "APP_TIMEZONE: $APP_TIMEZONE"
echo "WHATSAPP_AUTH_DIR: $WHATSAPP_AUTH_DIR"
echo "CORS_ORIGIN: $CORS_ORIGIN"

# Start the application
echo "=== Starting Application ==="
exec dumb-init node backend/dist/index.js