# Multi-stage build for optimal production performance and small footprint
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source files and compile Vite SPA
COPY . .
RUN npm run build

# Production runner stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled frontend from builder
COPY --from=builder /app/dist ./dist

# Copy backend server and API handlers
COPY server.js ./
COPY api ./api

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
