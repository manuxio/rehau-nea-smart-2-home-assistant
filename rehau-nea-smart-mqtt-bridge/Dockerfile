# Support both Home Assistant addon (BUILD_FROM) and standalone (node:20-alpine) builds
ARG BUILD_FROM=node:20.14-alpine
FROM $BUILD_FROM

# Install Node.js and npm if not already present (needed for HA base images)
# This check works for both HA addon builds (BUILD_FROM) and standalone (node:20-alpine)
RUN if ! command -v node > /dev/null 2>&1; then \
      apk add --no-cache nodejs npm; \
    fi

# Install wget for healthcheck and jq for JSON parsing (needed for HA addon config)
RUN apk add --no-cache wget jq

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy TypeScript source files
COPY src/ ./src/

# Build TypeScript to JavaScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Copy run script
COPY run.sh /

# Make run script executable
RUN chmod a+x /run.sh

# Health check to monitor Node.js process (API-less design)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD pidof node > /dev/null || exit 1

CMD [ "/run.sh" ]
