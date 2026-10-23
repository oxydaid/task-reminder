# -------------------------------------------------------------
# Stage 1: Build Go Backend
# -------------------------------------------------------------
FROM golang:1.24-alpine AS backend-builder

WORKDIR /build
COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /build/bin/server ./cmd/server

# -------------------------------------------------------------
# Stage 2: Build Next.js Frontend
# Upgraded to node:24-alpine (Patches October 2026 Security Releases:
# CVE-2026-111497 Brotli RCE, CVE-2026-105483/106069 TLS Hostname Bypasses)
# -------------------------------------------------------------
FROM node:24-alpine AS frontend-builder

WORKDIR /app

# Upgrade system packages to latest security patches
RUN apk update && apk upgrade --no-cache && \
    npm install -g pnpm@12.11.2

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile

COPY frontend/ ./frontend/
RUN pnpm --filter @task-reminder/frontend build

# -------------------------------------------------------------
# Stage 3: Production Runtime
# Base: node:24-alpine with security hardening & non-root user
# -------------------------------------------------------------
FROM node:24-alpine AS production

WORKDIR /app

# Apply latest Alpine & OpenSSL security patches, install dumb-init & ca-certificates
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache dumb-init sqlite tzdata ca-certificates && \
    npm install -g pnpm@12.11.2

# Create non-root user for principle of least privilege
RUN addgroup -g 1000 -S appuser && \
    adduser -S -u 1000 -G appuser appuser

# Copy Go binary
COPY --from=backend-builder --chown=appuser:appuser /build/bin/server /app/bin/server

# Copy Frontend files and dependencies
COPY --from=frontend-builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=frontend-builder --chown=appuser:appuser /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder --chown=appuser:appuser /app/frontend/public ./frontend/public
COPY --from=frontend-builder --chown=appuser:appuser /app/frontend/package.json ./frontend/
COPY --from=frontend-builder --chown=appuser:appuser /app/frontend/next.config.mjs ./frontend/
COPY --from=frontend-builder --chown=appuser:appuser /app/package.json ./package.json

COPY --chown=appuser:appuser entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh /app/bin/server

# Persistent data directory
RUN mkdir -p /app/data && chown -R appuser:appuser /app/data

USER appuser

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512 --no-deprecation"
ENV PORT=3000
ENV BACKEND_PORT=8080
ENV DATABASE_PATH=/app/data/task-reminder.sqlite
ENV WHATSAPP_STORE_PATH=/app/data/whatsapp.sqlite
ENV APP_TIMEZONE=Asia/Jakarta

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["./entrypoint.sh"]
