# =============================================================================
# TaskFlow Frontend - Multi-stage Dockerfile
# =============================================================================
# Stage 1: Build the Angular application
# Stage 2: Serve with nginx
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder
# -----------------------------------------------------------------------------
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build for production
RUN npm run build -- --configuration=production

# -----------------------------------------------------------------------------
# Stage 2: Runner (nginx)
# -----------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:alpine AS runner

# Copy built assets from builder stage
# Angular 17+ outputs to dist/<project>/browser
COPY --from=builder /app/dist/frontend/browser /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080 (unprivileged nginx listens on 8080, not 80)
EXPOSE 8080

# nginx runs as non-root user 'nginx' (UID 101)
CMD ["nginx", "-g", "daemon off;"]
