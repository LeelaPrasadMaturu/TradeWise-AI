# CI/CD Pipeline Guide

This guide covers the GitHub Actions CI/CD pipelines for TradeWise AI.

## Table of Contents

- [Overview](#overview)
- [CI Pipeline](#ci-pipeline)
- [CD Staging](#cd-staging)
- [CD Production](#cd-production)
- [Load Testing](#load-testing)
- [Secrets Management](#secrets-management)
- [Troubleshooting](#troubleshooting)

## Overview

### Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CI PIPELINE                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │   Lint   │─▶│   Test   │─▶│  Build   │─▶│ Security │        │
│  │          │  │          │  │  Images  │  │   Scan   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└───────────────────────────────────┬─────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
            ┌───────▼───────┐               ┌───────▼───────┐
            │ CD STAGING    │               │ CD PRODUCTION │
            │ (on develop)  │               │ (on release)  │
            │               │               │               │
            │ - Deploy      │               │ - Canary 10%  │
            │ - Smoke Test  │               │ - Analyze     │
            │ - Notify      │               │ - Canary 50%  │
            └───────────────┘               │ - Analyze     │
                                            │ - Full 100%   │
                                            └───────────────┘
```

### Workflow Files

| File | Trigger | Purpose |
|------|---------|---------|
| `ci.yml` | Push/PR to main/develop | Test, build, scan |
| `cd-production.yml` | Release published | Production deploy |
| `load-test.yml` | Manual/Schedule | Performance testing |

## CI Pipeline

### Location

`.github/workflows/ci.yml`

### Jobs

#### 1. Test Job

```yaml
test:
  runs-on: ubuntu-latest
  services:
    mongodb:
      image: mongo:7.0
      ports: [27017:27017]
    redis:
      image: redis:7-alpine
      ports: [6379:6379]
```

Steps:
- Checkout code
- Setup Node.js (20.x)
- Install dependencies
- Run linter
- Run unit tests
- Run integration tests
- Run E2E tests
- Generate coverage
- Upload to Codecov

#### 2. Build Job

```yaml
build:
  needs: test
  if: github.event_name == 'push'
```

Steps:
- Setup Docker Buildx
- Login to GHCR
- Build API image (multi-platform)
- Build Frontend image
- Push to registry

#### 3. Security Job

```yaml
security:
  needs: build
```

Steps:
- Run Trivy vulnerability scan
- Upload SARIF results
- Run Snyk analysis (optional)

### Running Locally

```bash
# Install act (GitHub Actions local runner)
brew install act

# Run CI workflow
act push -W .github/workflows/ci.yml

# Run specific job
act push -j test -W .github/workflows/ci.yml
```

## CD Staging

### Trigger

Automatically on merge to `develop` branch.

### Steps

1. **Deploy to Staging K8s**
   ```bash
   helm upgrade --install tradewise ./k8s/helm/tradewise \
     -f ./k8s/helm/tradewise/values-staging.yaml \
     --set api.image.tag=${{ github.sha }} \
     --namespace tradewise-staging
   ```

2. **Run Smoke Tests**
   ```bash
   curl -f https://api.staging.tradewise.ai/health
   ```

3. **Notify Team**
   - Slack notification on success/failure

### Manual Trigger

```bash
# Trigger staging deploy manually
gh workflow run ci.yml --ref develop
```

## CD Production

### Location

`.github/workflows/cd-production.yml`

### Trigger

- Release tag published
- Manual workflow dispatch

### Canary Deployment Steps

```
Step 1: 10% traffic    → Wait 2 min  → Analyze
Step 2: 50% traffic    → Wait 5 min  → Analyze
Step 3: 100% traffic   → Complete
```

### Analysis Criteria

- Success rate >= 95%
- P99 latency < 500ms
- Error rate < 5%

### Rollback

Automatic rollback if:
- Analysis fails
- Manual abort

```bash
# Manual rollback
kubectl argo rollouts undo api -n tradewise
```

### Creating a Release

```bash
# Create and push tag
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0

# Or use GitHub CLI
gh release create v1.2.0 \
  --title "v1.2.0" \
  --notes "Release notes here"
```

## Load Testing

### Location

`.github/workflows/load-test.yml`

### Trigger

- Manual workflow dispatch
- Daily schedule (smoke test)

### Test Types

| Type | VUs | Duration | Use Case |
|------|-----|----------|----------|
| Smoke | 10 | 1 min | Health check |
| Load | 100 | 20 min | Normal traffic |
| Stress | 500 | 20 min | Find limits |
| Spike | 300 | 5 min | Sudden traffic |
| HPA | Variable | 30 min | Autoscaling |

### Running Load Tests

```bash
# Via GitHub UI
gh workflow run load-test.yml \
  --field test_type=load \
  --field environment=staging

# Locally with K6
cd loadtests
k6 run load.k6.js -e BASE_URL=http://localhost:3000
```

### Thresholds

```javascript
// load.k6.js
export const options = {
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.02'],
  },
};
```

CI fails if thresholds not met.

## Secrets Management

### Required Secrets

Configure in GitHub Settings → Secrets:

| Secret | Purpose |
|--------|---------|
| `KUBE_CONFIG_STAGING` | Kubeconfig for staging cluster |
| `KUBE_CONFIG_PRODUCTION` | Kubeconfig for production cluster |
| `LOAD_TEST_TOKEN` | JWT token for load tests |
| `SLACK_WEBHOOK_URL` | Slack notifications |
| `SNYK_TOKEN` | (Optional) Snyk security scanning |

### Setting Secrets

```bash
# Using GitHub CLI
gh secret set KUBE_CONFIG_STAGING < kubeconfig-staging.yaml
gh secret set SLACK_WEBHOOK_URL --body "https://hooks.slack.com/..."

# List secrets
gh secret list
```

### Kubeconfig Setup

```bash
# Create service account for CI
kubectl create serviceaccount github-actions -n tradewise

# Create role binding
kubectl create clusterrolebinding github-actions \
  --clusterrole=admin \
  --serviceaccount=tradewise:github-actions

# Get token
kubectl create token github-actions -n tradewise --duration=8760h

# Create kubeconfig
kubectl config view --minify --flatten > kubeconfig.yaml
# Edit to use service account token

# Base64 encode for GitHub secret
cat kubeconfig.yaml | base64
```

## Troubleshooting

### CI Failures

#### Test Failures

```bash
# View test logs in GitHub Actions
# Click on failed job → expand step

# Run tests locally
cd backend
npm test -- --verbose
```

#### Build Failures

```bash
# Check Dockerfile syntax
docker build -t test ./backend

# Check for large layers
docker history test
```

### CD Failures

#### Helm Deploy Failed

```bash
# Check helm status
helm status tradewise -n tradewise

# Check deployment status
kubectl rollout status deployment/api -n tradewise

# View events
kubectl get events -n tradewise --sort-by='.lastTimestamp'
```

#### Canary Analysis Failed

```bash
# Check analysis run
kubectl get analysisrun -n tradewise

# View analysis results
kubectl describe analysisrun <name> -n tradewise

# Check Prometheus metrics
curl 'http://prometheus:9090/api/v1/query?query=tradewise_http_requests_total'
```

### Common Issues

#### 1. Image Pull Failed

```yaml
# Ensure imagePullSecrets is configured
spec:
  imagePullSecrets:
    - name: regcred
```

#### 2. Insufficient Resources

```yaml
# Check resource requests/limits
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

#### 3. Secrets Not Found

```bash
# Verify secret exists
kubectl get secrets -n tradewise

# Check secret is mounted
kubectl describe pod <pod-name> -n tradewise
```

### Viewing Workflow Logs

```bash
# List workflow runs
gh run list --workflow=ci.yml

# View specific run
gh run view <run-id>

# View logs
gh run view <run-id> --log

# Rerun failed job
gh run rerun <run-id> --failed
```

### Canceling a Run

```bash
# Cancel running workflow
gh run cancel <run-id>
```
