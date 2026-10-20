#!/bin/sh

# Entrypoint script for Pterodactyl and Docker deployment
# Starts Go Fiber Backend and Next.js Frontend with graceful signal propagation

set -e

echo "=== Task Reminder Starting (Next.js + Go + whatsmeow) ==="

# Set default values
PORT="${PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
DATABASE_PATH="${DATABASE_PATH:-/app/data/task-reminder.sqlite}"
WHATSAPP_STORE_PATH="${WHATSAPP_STORE_PATH:-/app/data/whatsapp.sqlite}"
APP_TIMEZONE="${APP_TIMEZONE:-Asia/Jakarta}"

# Ensure data directory exists
mkdir -p /app/data "$(dirname "$DATABASE_PATH")" "$(dirname "$WHATSAPP_STORE_PATH")"

export PORT="$PORT"
export BACKEND_PORT="$BACKEND_PORT"
export BACKEND_URL="http://127.0.0.1:$BACKEND_PORT"
export DATABASE_PATH="$DATABASE_PATH"
export WHATSAPP_STORE_PATH="$WHATSAPP_STORE_PATH"
export CORS_ORIGIN="${CORS_ORIGIN:-*}"

echo "Configuration:"
echo "- Frontend Port: $PORT"
echo "- Backend Port:  $BACKEND_PORT"
echo "- Database Path: $DATABASE_PATH"
echo "- WhatsApp Store Path: $WHATSAPP_STORE_PATH"
echo "- Timezone:      $APP_TIMEZONE"

# Graceful termination handler
cleanup() {
    echo "Received termination signal, shutting down services gracefully..."
    if [ -n "$FRONTEND_PID" ]; then
        kill -TERM "$FRONTEND_PID" 2>/dev/null || true
    fi
    if [ -n "$BACKEND_PID" ]; then
        kill -TERM "$BACKEND_PID" 2>/dev/null || true
    fi
    wait
    echo "Services stopped cleanly."
    exit 0
}

trap cleanup TERM INT

# 1. Start Go Fiber Backend
echo "Starting Go Fiber Backend..."
PORT="$BACKEND_PORT" /app/bin/server &
BACKEND_PID=$!

# Wait briefly for backend to initialize
sleep 2

# 2. Start Next.js Frontend
echo "Starting Next.js Frontend on port $PORT (binding 0.0.0.0)..."
if [ -x "./node_modules/.bin/next" ]; then
    ./node_modules/.bin/next start frontend -p "$PORT" -H 0.0.0.0 &
elif [ -x "./frontend/node_modules/.bin/next" ]; then
    ./frontend/node_modules/.bin/next start frontend -p "$PORT" -H 0.0.0.0 &
else
    npx --no-install next start frontend -p "$PORT" -H 0.0.0.0 &
fi
FRONTEND_PID=$!

echo "Task Reminder is running."

# Wait for any process to exit
wait -n "$BACKEND_PID" "$FRONTEND_PID"
cleanup
