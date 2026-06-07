# Docker Setup Guide

This guide covers containerization and local development with Docker.

## Table of Contents

- [Quick Start](#quick-start)
- [Docker Compose](#docker-compose)
- [Dockerfiles](#dockerfiles)
- [Development Workflow](#development-workflow)
- [Production Build](#production-build)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

```bash
# Verify installation
docker --version
docker compose version
```

### Start Everything

```bash
# Clone repository
git clone <repository>
cd TradeWise-AI

# Copy environment file
cp backend/.env.example backend/.env
# Edit .env with your API keys

# Start all services
docker compose up -d

# Check status
docker compose ps
```

### Access Services

| Service | URL |
|---------|-----|
| API | http://localhost:3000 |
| Frontend | http://localhost:3001 |
| Grafana | http://localhost:3002 |
| Prometheus | http://localhost:9090 |
| Jaeger | http://localhost:16686 |

## Docker Compose

### Services Overview

```yaml
# docker-compose.yml
services:
  api:        # Backend API server
  worker:     # BullMQ job workers
  frontend:   # Next.js web app
  mongo:      # MongoDB database
  redis:      # Cache + job queues
  zookeeper:  # Kafka dependency
  kafka:      # Event streaming
  prometheus: # Metrics collection
  grafana:    # Dashboards
  jaeger:     # Distributed tracing
```

### Starting Specific Services

```bash
# Start only core services (API + DB)
docker compose up api mongo redis -d

# Start with workers
docker compose up api worker mongo redis -d

# Start everything including observability
docker compose up -d
```

### Environment Variables

Create a `.env` file in the project root:

```bash
# Required
JWT_SECRET=your-super-secret-jwt-key
GOOGLE_AI_API_KEY=your-google-api-key
HUGGINGFACE_API_KEY=your-huggingface-key
COHERE_API_KEY=your-cohere-key

# Optional - Port overrides
API_PORT=3000
FRONTEND_PORT=3001
MONGO_PORT=27017
REDIS_PORT=6379

# Optional - Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin

# Optional - SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=pass
SMTP_FROM="TradeWise AI <coach@tradewise.ai>"
```

### Useful Commands

```bash
# View logs
docker compose logs -f api
docker compose logs -f worker

# Restart a service
docker compose restart api

# Rebuild after code changes
docker compose up -d --build api

# Stop everything
docker compose down

# Stop and remove volumes (clean slate)
docker compose down -v
```

## Dockerfiles

### Backend Dockerfile

Located at `backend/Dockerfile`:

```dockerfile
# Multi-stage build
# Stage 1: Dependencies
FROM node:20-alpine AS deps
# Installs production dependencies only

# Stage 2: Builder
FROM node:20-alpine AS builder
# Full install for any build steps

# Stage 3: Runner
FROM node:20-alpine AS runner
# Minimal production image with:
# - Non-root user (tradewise:1001)
# - tini for proper signal handling
# - Health check
# - NODE_OPTIONS for memory tuning
```

Key features:
- **Multi-stage**: Smaller final image (~150MB vs ~500MB)
- **Non-root**: Security best practice
- **tini**: Proper PID 1 signal handling
- **Health check**: Docker/K8s health monitoring

### Frontend Dockerfile

Located at `frontend/Dockerfile`:

```dockerfile
# Next.js standalone build
# Stage 1: Dependencies
FROM node:20-alpine AS deps

# Stage 2: Builder
FROM node:20-alpine AS builder
# Creates standalone output

# Stage 3: Runner
FROM node:20-alpine AS runner
# Copies only necessary files:
# - .next/standalone
# - .next/static
# - public
```

Requires Next.js config:

```javascript
// frontend/next.config.js
module.exports = {
  output: 'standalone',
}
```

## Development Workflow

### Using Override File

The `docker-compose.override.yml` automatically activates in development:

```yaml
# Enables:
# - Volume mounts for hot reload
# - Dev commands (npm run dev)
# - Debugger ports
# - Additional port exposures
```

### Hot Reload Setup

```bash
# Start with development overrides
docker compose up -d

# Code changes in ./backend/ and ./frontend/ 
# automatically trigger hot reload
```

### Debugging

```bash
# Node.js debugger available on port 9229
# Connect VS Code with:
{
  "type": "node",
  "request": "attach",
  "name": "Docker: Attach to Node",
  "port": 9229,
  "address": "localhost",
  "localRoot": "${workspaceFolder}/backend",
  "remoteRoot": "/app"
}
```

### Running Tests

```bash
# Run tests in container
docker compose exec api npm test
docker compose exec api npm run test:coverage

# Or start test-specific container
docker compose run --rm api npm run test:unit
```

## Production Build

### Building Images

```bash
# Build all images
docker compose build

# Build specific image
docker compose build api
docker compose build frontend

# Build with no cache (clean build)
docker compose build --no-cache api
```

### Tagging and Pushing

```bash
# Tag for registry
docker tag tradewise-api:latest ghcr.io/your-org/tradewise-api:v1.0.0

# Push to registry
docker push ghcr.io/your-org/tradewise-api:v1.0.0
```

### Production Compose

```bash
# Use production compose file
docker compose -f docker-compose.yml up -d

# Or set environment
COMPOSE_FILE=docker-compose.yml docker compose up -d
```

### Resource Limits

The compose file includes resource limits:

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 256M
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs api

# Common issues:
# - Missing environment variables
# - Port already in use
# - MongoDB not ready yet
```

### Database Connection Issues

```bash
# Check MongoDB is healthy
docker compose exec mongo mongosh --eval "db.adminCommand('ping')"

# Check network connectivity
docker compose exec api ping mongo
```

### Build Failures

```bash
# Clean Docker cache
docker builder prune

# Remove all unused images
docker image prune -a

# Rebuild from scratch
docker compose build --no-cache
```

### Disk Space Issues

```bash
# Check disk usage
docker system df

# Clean up
docker system prune -a --volumes
```

### Networking Issues

```bash
# Inspect network
docker network inspect tradewise-network

# Check container IPs
docker compose exec api hostname -i
```

### Performance Issues

```bash
# Check container stats
docker stats

# Check specific container
docker stats tradewise-api

# Increase Docker resources in Docker Desktop settings
```

## Docker Commands Reference

```bash
# Container management
docker compose up -d              # Start all
docker compose down               # Stop all
docker compose restart api        # Restart service
docker compose stop api           # Stop service
docker compose rm api             # Remove container

# Logs
docker compose logs -f            # Follow all logs
docker compose logs -f api        # Follow service logs
docker compose logs --tail=100    # Last 100 lines

# Execute commands
docker compose exec api sh        # Shell into container
docker compose exec api npm test  # Run command

# Build
docker compose build              # Build all
docker compose build --no-cache   # Clean build

# Cleanup
docker compose down -v            # Remove volumes
docker system prune               # Clean unused resources
```
