# API Dockerfile - Multi-stage build for TypeScript
# TASK-INFRA-003: DMP API Service

# ==============================================================================
# Stage 1: Dependencies
# ==============================================================================
FROM node:20-alpine AS deps

WORKDIR /app

# Install dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --include=dev

# ==============================================================================
# Stage 2: Builder
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ==============================================================================
# Stage 3: Production
# ==============================================================================
FROM node:20-alpine AS production

WORKDIR /app

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 api

# Copy production artifacts
COPY --from=builder --chown=api:nodejs /app/dist ./dist
COPY --from=builder --chown=api:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=api:nodejs /app/package.json ./

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Switch to non-root user
USER api

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/live || exit 1

# Start the server
CMD ["node", "dist/server.js"]

# ==============================================================================
# Stage 4: Development
# ==============================================================================
FROM node:20-alpine AS development

WORKDIR /app

# Copy all dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src

# Set environment variables
ENV NODE_ENV=development
ENV HOST=0.0.0.0
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start with hot reload
CMD ["npm", "run", "dev"]
