# TradeWise AI - Documentation

Welcome to the TradeWise AI documentation. This guide covers all aspects of setting up, deploying, and operating the TradeWise AI platform.

## Documentation Structure

```
docs/
├── README.md                    # This file
├── infrastructure/              # Core infrastructure components
│   ├── README.md               # Infrastructure overview
│   ├── redis.md                # Redis Cluster setup
│   ├── kafka.md                # Apache Kafka setup
│   └── bullmq.md               # BullMQ job queues
├── deployment/                  # Deployment guides
│   ├── docker.md               # Docker & Docker Compose
│   ├── kubernetes.md           # Kubernetes & Helm
│   └── ci-cd.md                # CI/CD pipelines
└── development/                 # Development guides
    ├── load-testing.md         # K6 load testing
    └── observability.md        # Prometheus, Grafana, Jaeger
```

## Quick Start

### Local Development

```bash
# Clone and install
git clone <repository>
cd TradeWise-AI
npm run install:all

# Start with Docker Compose
docker-compose up -d

# Or run manually
cd backend && npm run dev
cd frontend && npm run dev
```

### Production Deployment

```bash
# Using Helm
helm install tradewise ./k8s/helm/tradewise \
  -f ./k8s/helm/tradewise/values-production.yaml \
  --namespace tradewise --create-namespace

# Or using kubectl
kubectl apply -k k8s/base/
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         INGRESS LAYER                           │
│   ┌─────────────┐    ┌──────────────────┐                      │
│   │ NGINX       │───▶│ Redis Rate       │                      │
│   │ Ingress     │    │ Limiter          │                      │
│   └─────────────┘    └──────────────────┘                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      APPLICATION LAYER                          │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│   │ API      │  │ API      │  │ Worker   │  │ Worker   │      │
│   │ Pod 1    │  │ Pod N    │  │ Pod 1    │  │ Pod N    │      │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
└────────┼─────────────┼─────────────┼─────────────┼──────────────┘
         │             │             │             │
┌────────▼─────────────▼─────────────▼─────────────▼──────────────┐
│                       MESSAGING LAYER                           │
│   ┌─────────────────────┐    ┌─────────────────────┐           │
│   │   Apache Kafka      │    │   BullMQ Queues     │           │
│   │   (Event Streaming) │    │   (Job Processing)  │           │
│   └─────────────────────┘    └─────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
         │             │             │             │
┌────────▼─────────────▼─────────────▼─────────────▼──────────────┐
│                        DATA LAYER                               │
│   ┌─────────────────────┐    ┌─────────────────────┐           │
│   │   Redis Cluster     │    │   MongoDB           │           │
│   │   (Cache + Locks)   │    │   (Primary DB)      │           │
│   └─────────────────────┘    └─────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
         │             │             │             │
┌────────▼─────────────▼─────────────▼─────────────▼──────────────┐
│                    OBSERVABILITY LAYER                          │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐                 │
│   │Prometheus│───▶│ Grafana  │    │ Jaeger   │                 │
│   └──────────┘    └──────────┘    └──────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **API Server** | Node.js, Express | REST API |
| **Frontend** | Next.js 16, React 19 | Web UI |
| **Database** | MongoDB | Primary data store |
| **Cache** | Redis Cluster | Distributed caching |
| **Job Queue** | BullMQ | Async job processing |
| **Event Bus** | Apache Kafka | Event streaming |
| **Container Runtime** | Docker | Containerization |
| **Orchestration** | Kubernetes | Container orchestration |
| **CI/CD** | GitHub Actions | Automation |
| **Metrics** | Prometheus | Metrics collection |
| **Dashboards** | Grafana | Visualization |
| **Tracing** | Jaeger | Distributed tracing |

## Key Features

### Distributed Systems
- **Redis Cluster** with cache-aside pattern and distributed locks (Redlock)
- **Token bucket** rate limiting with sliding window precision
- **Circuit breakers** for all external AI services
- **Event-driven architecture** with Kafka

### Cloud Native
- **Multi-stage Dockerfiles** with security best practices
- **Kubernetes HPA** for auto-scaling on CPU, memory, and custom metrics
- **Helm charts** for staging and production environments
- **Canary deployments** with Argo Rollouts

### Reliability
- **Bulkhead pattern** for service isolation
- **Retry strategies** with exponential backoff and jitter
- **Dead letter queues** for failed job processing
- **Pod disruption budgets** for high availability

### Performance
- **Object pooling** for high-throughput paths
- **Lock-free data structures** for concurrent operations
- **Event loop optimization** with proper async patterns
- **K6 load testing** integrated in CI/CD

## Environment Variables

See [`.env.example`](../.env.example) for all required environment variables.

### Required for Production

```bash
# Database
MONGODB_URI=mongodb://...

# Redis
REDIS_HOST=redis-master
REDIS_PORT=6379
REDIS_PASSWORD=***

# Kafka
KAFKA_BROKERS=kafka-0:9092,kafka-1:9092

# AI Services
GOOGLE_AI_API_KEY=***
HUGGINGFACE_API_KEY=***
COHERE_API_KEY=***

# Security
JWT_SECRET=***
```

## Support

For issues and feature requests, please use GitHub Issues.
