# apps/mobile/Dockerfile
# Multi-stage build for Sajiwa Mobile (Expo Web)

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY packages/api-client/package*.json ./packages/api-client/
COPY packages/ui-shared/package*.json ./packages/ui-shared/
COPY packages/utils/package*.json ./packages/utils/

# Install dependencies
RUN npm ci --workspaces --include-workspace-root

# Copy source code
COPY . .

# Build application
RUN npm run build:web

# Production stage - Nginx for static hosting
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]