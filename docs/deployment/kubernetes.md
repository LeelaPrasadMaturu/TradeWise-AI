# Kubernetes Deployment Guide

This guide covers deploying TradeWise AI to Kubernetes using raw manifests or Helm.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Base Manifests](#base-manifests)
- [Helm Chart](#helm-chart)
- [Horizontal Pod Autoscaler](#horizontal-pod-autoscaler)
- [Canary Deployments](#canary-deployments)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Kubernetes cluster (1.25+)
- kubectl configured
- Helm 3.x (for Helm deployments)
- Container registry access (GHCR, ECR, etc.)

```bash
# Verify cluster access
kubectl cluster-info
kubectl get nodes

# Install Helm (if needed)
brew install helm  # macOS
```

## Quick Start

### Using Base Manifests

```bash
# Create namespace
kubectl apply -f k8s/base/namespace.yaml

# Create config and secrets
kubectl apply -f k8s/base/configmap.yaml
kubectl apply -f k8s/base/secrets.yaml  # Edit with real values first!

# Deploy applications
kubectl apply -f k8s/base/api-deployment.yaml
kubectl apply -f k8s/base/api-service.yaml
kubectl apply -f k8s/base/worker-deployment.yaml

# Deploy HPA and PDB
kubectl apply -f k8s/base/hpa.yaml
kubectl apply -f k8s/base/pdb.yaml

# Deploy ingress
kubectl apply -f k8s/base/ingress.yaml

# Check status
kubectl get pods -n tradewise
```

### Using Helm

```bash
# Add Bitnami repo for dependencies
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Install with default values
helm install tradewise ./k8s/helm/tradewise \
  --namespace tradewise --create-namespace

# Install for staging
helm install tradewise ./k8s/helm/tradewise \
  -f ./k8s/helm/tradewise/values-staging.yaml \
  --namespace tradewise-staging --create-namespace

# Install for production
helm install tradewise ./k8s/helm/tradewise \
  -f ./k8s/helm/tradewise/values-production.yaml \
  --namespace tradewise --create-namespace
```

## Architecture

### Kubernetes Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        INGRESS LAYER                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   NGINX Ingress                          │   │
│  │   api.tradewise.ai → api-service                        │   │
│  │   app.tradewise.ai → frontend-service                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                      SERVICES                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ api-service  │  │frontend-svc  │  │ worker       │          │
│  │ (ClusterIP)  │  │ (ClusterIP)  │  │ (headless)   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘          │
└─────────┼─────────────────┼─────────────────────────────────────┘
          │                 │
┌─────────▼─────────────────▼─────────────────────────────────────┐
│                      DEPLOYMENTS                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ api (Deployment)       │ frontend (Deployment)           │   │
│  │ replicas: 3-20 (HPA)   │ replicas: 2-5                   │   │
│  │ ┌─────┐┌─────┐┌─────┐  │ ┌─────┐┌─────┐                  │   │
│  │ │Pod 1││Pod 2││Pod N│  │ │Pod 1││Pod 2│                  │   │
│  │ └─────┘└─────┘└─────┘  │ └─────┘└─────┘                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ worker (Deployment)                                       │   │
│  │ replicas: 2-10 (HPA)                                      │   │
│  │ ┌─────┐┌─────┐                                            │   │
│  │ │Pod 1││Pod 2│                                            │   │
│  │ └─────┘└─────┘                                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Base Manifests

### Namespace

```yaml
# k8s/base/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: tradewise
  labels:
    app.kubernetes.io/name: tradewise
```

### ConfigMap

```yaml
# k8s/base/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: tradewise-config
  namespace: tradewise
data:
  NODE_ENV: "production"
  PORT: "3000"
  MONGODB_URI: "mongodb://mongo:27017/tradewise"
  REDIS_HOST: "redis-master"
  REDIS_PORT: "6379"
  KAFKA_BROKERS: "kafka:9092"
```

### Secrets

```yaml
# k8s/base/secrets.yaml (template - don't commit real values!)
apiVersion: v1
kind: Secret
metadata:
  name: tradewise-secrets
  namespace: tradewise
type: Opaque
stringData:
  JWT_SECRET: "REPLACE_ME"
  GOOGLE_AI_API_KEY: "REPLACE_ME"
  HUGGINGFACE_API_KEY: "REPLACE_ME"
  COHERE_API_KEY: "REPLACE_ME"
```

### Managing Secrets

For production, use one of:

1. **Sealed Secrets**
   ```bash
   kubeseal --format=yaml < secrets.yaml > sealed-secrets.yaml
   ```

2. **External Secrets Operator**
   ```yaml
   apiVersion: external-secrets.io/v1beta1
   kind: ExternalSecret
   metadata:
     name: tradewise-secrets
   spec:
     secretStoreRef:
       name: aws-secrets-manager
       kind: SecretStore
     target:
       name: tradewise-secrets
     data:
       - secretKey: JWT_SECRET
         remoteRef:
           key: tradewise/production
           property: jwt_secret
   ```

3. **Vault**
   ```yaml
   annotations:
     vault.hashicorp.com/agent-inject: "true"
     vault.hashicorp.com/role: "tradewise"
     vault.hashicorp.com/agent-inject-secret-config: "secret/tradewise/config"
   ```

## Helm Chart

### Structure

```
k8s/helm/tradewise/
├── Chart.yaml           # Chart metadata
├── values.yaml          # Default values
├── values-staging.yaml  # Staging overrides
├── values-production.yaml # Production overrides
└── templates/           # Kubernetes manifests
```

### Key Values

```yaml
# values.yaml
api:
  replicaCount: 3
  image:
    repository: ghcr.io/tradewise/api
    tag: latest
  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 20

worker:
  replicaCount: 2
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10

# Dependencies
mongodb:
  enabled: true
  architecture: replicaset
  replicaCount: 3

redis:
  enabled: true
  architecture: replication
  replica:
    replicaCount: 2

kafka:
  enabled: true
  replicaCount: 3
```

### Helm Commands

```bash
# Install
helm install tradewise ./k8s/helm/tradewise -n tradewise

# Upgrade
helm upgrade tradewise ./k8s/helm/tradewise -n tradewise

# Upgrade with new image
helm upgrade tradewise ./k8s/helm/tradewise \
  --set api.image.tag=v1.2.0 \
  -n tradewise

# Dry run
helm upgrade tradewise ./k8s/helm/tradewise \
  --dry-run --debug -n tradewise

# Rollback
helm rollback tradewise 1 -n tradewise

# Uninstall
helm uninstall tradewise -n tradewise
```

## Horizontal Pod Autoscaler

### CPU/Memory Based

```yaml
# k8s/base/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Custom Metrics

Requires Prometheus Adapter:

```bash
# Install prometheus-adapter
helm install prometheus-adapter prometheus-community/prometheus-adapter \
  --set prometheus.url=http://prometheus:9090 \
  -n monitoring
```

Then use custom metrics:

```yaml
metrics:
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
```

### HPA Behavior

```yaml
behavior:
  scaleUp:
    stabilizationWindowSeconds: 30
    policies:
      - type: Percent
        value: 100         # Double pods
        periodSeconds: 15
  scaleDown:
    stabilizationWindowSeconds: 300  # Wait 5 min before scale down
    policies:
      - type: Percent
        value: 10          # Remove 10%
        periodSeconds: 60
```

### Verify HPA

```bash
# Check HPA status
kubectl get hpa -n tradewise

# Detailed status
kubectl describe hpa api-hpa -n tradewise

# Watch scaling
kubectl get hpa api-hpa -n tradewise -w
```

## Canary Deployments

### Using Argo Rollouts

```bash
# Install Argo Rollouts
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml
```

### Rollout Strategy

```yaml
# k8s/rollouts/api-rollout.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: api
spec:
  replicas: 5
  strategy:
    canary:
      steps:
        - setWeight: 10      # 10% traffic to canary
        - pause: {duration: 2m}
        - analysis:
            templates:
              - templateName: success-rate
        - setWeight: 50      # 50% traffic
        - pause: {duration: 5m}
        - analysis:
            templates:
              - templateName: success-rate
        - setWeight: 100     # Full rollout
```

### Analysis Template

```yaml
# k8s/rollouts/analysis-template.yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  metrics:
    - name: success-rate
      successCondition: result[0] >= 0.95
      provider:
        prometheus:
          address: http://prometheus:9090
          query: |
            sum(rate(tradewise_http_requests_total{status!~"5.."}[5m])) /
            sum(rate(tradewise_http_requests_total[5m]))
```

### Rollout Commands

```bash
# Check rollout status
kubectl argo rollouts get rollout api -n tradewise

# Promote canary
kubectl argo rollouts promote api -n tradewise

# Abort rollout
kubectl argo rollouts abort api -n tradewise

# Rollback
kubectl argo rollouts undo api -n tradewise
```

## Monitoring

### Pod Status

```bash
# List pods
kubectl get pods -n tradewise

# Pod details
kubectl describe pod api-xxx -n tradewise

# Pod logs
kubectl logs api-xxx -n tradewise
kubectl logs -f api-xxx -n tradewise  # Follow

# Multi-container pods
kubectl logs api-xxx -c api -n tradewise
```

### Resource Usage

```bash
# Node resources
kubectl top nodes

# Pod resources
kubectl top pods -n tradewise

# Detailed resource usage
kubectl describe node <node-name>
```

### Events

```bash
# Namespace events
kubectl get events -n tradewise

# Sorted by time
kubectl get events -n tradewise --sort-by='.lastTimestamp'
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n tradewise

# Common issues:
# - ImagePullBackOff: Registry auth or image not found
# - CrashLoopBackOff: Application crashing
# - Pending: Resource constraints or PVC issues
```

### ImagePullBackOff

```bash
# Check image name
kubectl get pod <pod> -o jsonpath='{.spec.containers[0].image}'

# Create registry secret
kubectl create secret docker-registry regcred \
  --docker-server=ghcr.io \
  --docker-username=$GITHUB_USER \
  --docker-password=$GITHUB_TOKEN \
  -n tradewise
```

### CrashLoopBackOff

```bash
# Check logs
kubectl logs <pod> -n tradewise --previous

# Exec into running container
kubectl exec -it <pod> -n tradewise -- sh
```

### Service Not Accessible

```bash
# Check service
kubectl get svc -n tradewise

# Check endpoints
kubectl get endpoints api -n tradewise

# Port forward for testing
kubectl port-forward svc/api 3000:80 -n tradewise
```

### Ingress Not Working

```bash
# Check ingress
kubectl get ingress -n tradewise
kubectl describe ingress tradewise-ingress -n tradewise

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
```

### Resource Limits

```bash
# Check if pods are being throttled
kubectl top pods -n tradewise

# Check resource quotas
kubectl get resourcequota -n tradewise

# Check limit ranges
kubectl get limitrange -n tradewise
```
