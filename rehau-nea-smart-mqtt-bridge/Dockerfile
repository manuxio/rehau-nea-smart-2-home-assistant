FROM node:20-alpine

# Install wget for healthcheck
RUN apk add --no-cache wget=1.21.4-r0

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

CMD [ "/run.sh" ]
