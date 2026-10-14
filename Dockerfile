# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@12.11.2

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Build frontend
RUN pnpm --filter frontend build

# Build backend
RUN pnpm --filter backend build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init sqlite

# Create non-root user
RUN addgroup -g 1000 -S nodejs && \
    adduser -S -u 1000 -G nodejs nodejs

# Copy built files
COPY --from=builder --chown=nodejs:nodejs /app/backend/dist ./backend/dist
COPY --from=builder --chown=nodejs:nodejs /app/backend/node_modules ./backend/node_modules
COPY --from=builder --chown=nodejs:nodejs /app/backend/package.json ./backend/
COPY --from=builder --chown=nodejs:nodejs /app/frontend/dist ./frontend/dist

# Create data directories
RUN mkdir -p /app/data/sessions /app/data/whatsapp-auth && \
    chown -R nodejs:nodejs /app/data

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/dist/index.js"]