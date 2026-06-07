# TradeWise AI Backend - Multi-Stage Dockerfile
# Optimized for production with security best practices

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# ============================================
# Stage 2: Builder (for any build steps)
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Run any build steps if needed
# RUN npm run build

# ============================================
# Stage 3: Production Runner
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install tini for proper signal handling (PID 1)
RUN apk add --no-cache tini wget

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 tradewise

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Copy production dependencies from deps stage
COPY --from=deps --chown=tradewise:nodejs /app/node_modules ./node_modules

# Copy application code from builder stage
COPY --from=builder --chown=tradewise:nodejs /app .

# Remove unnecessary files
RUN rm -rf tests samples scripts .env* jest.config.js .git* *.md

# Switch to non-root user
USER tradewise

# Expose port
EXPOSE 3000

# Node.js performance tuning
ENV NODE_OPTIONS="--max-old-space-size=512 --max-semi-space-size=64"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "server.js"]
