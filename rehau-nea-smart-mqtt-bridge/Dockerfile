# Multi-stage build for REHAU NEA SMART 2.0 MQTT Bridge
# Stage 1: Build web UI
FROM node:20-alpine AS web-builder

WORKDIR /web-ui

# Copy web UI package files
COPY web-ui/package*.json ./

# Install web UI dependencies
RUN npm ci

# Copy web UI source
COPY web-ui/ ./

# Build web UI
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Copy backend package files
COPY package*.json ./
COPY tsconfig.json ./

# Install backend dependencies (including dev for build)
RUN npm ci

# Copy backend source
COPY src/ ./src/

# Build backend TypeScript
RUN npm run build:docker

# Stage 3: Final runtime image
# Use node:20-alpine as base (can be overridden for HA addon)
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    wget \
    jq \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji

# Set Playwright to use system Chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

# Copy backend package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production

# Copy built backend from builder
COPY --from=backend-builder /app/dist ./dist

# Copy built web UI from builder
COPY --from=web-builder /web-ui/dist ./web-ui/dist

# Copy PWA files
COPY web-ui/public/sw.js ./web-ui/dist/sw.js
COPY web-ui/public/manifest.json ./web-ui/dist/manifest.json

# Copy run script
COPY run.sh /run.sh
RUN chmod a+x /run.sh

# Expose API/Web UI port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["/run.sh"]
