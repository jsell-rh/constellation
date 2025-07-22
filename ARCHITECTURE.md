# Constellation - System Architecture

## Table of Contents

1. [Overview](#overview)
2. [Core Components](#core-components)
3. [System Flow](#system-flow)
4. [AI Delegation Engine](#ai-delegation-engine)
5. [Service Registry](#service-registry)
6. [Observability Layer](#observability-layer)
7. [Resilience Patterns](#resilience-patterns)
8. [Deployment Architecture](#deployment-architecture)
9. [Security Model](#security-model)
10. [Performance Requirements](#performance-requirements)

## Overview

Constellation is a distributed system that enables AI-powered access to enterprise data through a network of specialized "librarians". Each librarian is a simple function that answers queries using domain-specific data and AI.

### Key Design Principles

1. **Simplicity for Teams**: Write a function, get enterprise features
2. **Intelligence through AI**: Better routing than hardcoded rules
3. **Resilience by Default**: Handle failures gracefully
4. **Observable Everything**: Complete visibility into the system
5. **Natural Hierarchies**: Mirror organizational structure

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User Query                           │
└────────────────────────┬──────────────────────────_─────┘
                         │
┌────────────────────────▼───────────────────────────────┐
│                  Query Gateway                         │
│         (Authentication, Rate Limiting, Tracing)       │
└────────────────────────┬───────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────┐
│              AI Delegation Engine                      │
│         (Query Analysis, Routing Decision)             │
└────────────────────────┬───────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
┌────────▼────────┐            ┌────────▼────────┐
│   Librarian A   │            │   Librarian B   │
│  (Circuit Breaker)           │  (Circuit Breaker)
│  (Metrics)       │           │  (Metrics)       │
│  (Tracing)       │           │  (Tracing)       │
└────────┬────────┘            └────────┬────────┘
         │                               │
         └───────────────┬───────────────┘
                         │
┌────────────────────────▼───────────────────────────────┐
│                 Response Aggregator                     │
│           (Merge, Error Handling, Caching)             │
└────────────────────────┬───────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────┐
│                    User Response                        │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Librarian Function

The fundamental unit of the system. Each librarian:
- Is an async function that takes a query and returns a response
- Has access to domain-specific data sources
- Uses AI to generate intelligent answers
- Can delegate to other librarians

**Interface:**
```typescript
type Librarian = (query: string, context?: Context) => Promise<Response>;

interface Response {
  answer?: string;
  sources?: Source[];
  delegate?: DelegateRequest | DelegateRequest[];
  confidence?: number;
  error?: ErrorInfo;
}
```

### 2. Query Gateway

Entry point for all queries. Responsibilities:
- **Authentication**: Verify API keys, JWTs, or certificates
- **Rate Limiting**: Prevent abuse (configurable per client)
- **Request ID Generation**: Unique ID for tracing
- **Initial Context Creation**: User info, timestamp, etc.

### 3. AI Delegation Engine

Intelligent routing system. Features:
- **Query Analysis**: Understand intent and required expertise
- **Capability Matching**: Match query to librarian capabilities
- **Multi-Expert Coordination**: Split complex queries
- **Loop Prevention**: Detect and prevent circular delegation
- **Fallback Selection**: Choose alternatives when primary fails

### 4. Service Registry

Central repository of all librarians. Contains:
- **Librarian Metadata**: ID, name, description, capabilities
- **Endpoint Information**: How to reach each librarian
- **Hierarchy Structure**: Parent-child relationships
- **SLA Information**: Expected response times, availability
- **Resilience Config**: Circuit breaker settings, fallbacks

### 5. Response Aggregator

Combines responses from multiple librarians:
- **Parallel Response Handling**: Merge multiple answers
- **Partial Response Assembly**: Best effort with failures
- **Error Context Propagation**: Maintain error chain
- **Response Caching**: Store for future use
- **Quality Scoring**: Rate answer confidence

### 6. Observability Layer

Provides complete system visibility:
- **Distributed Tracing**: OpenTelemetry integration
- **Metrics Collection**: Prometheus-compatible
- **Structured Logging**: JSON logs with context
- **Real-time Dashboards**: Grafana integration
- **Alerting**: PagerDuty/Slack notifications

### 7. Resilience Layer

Ensures system reliability:
- **Circuit Breakers**: Prevent cascade failures
- **Retry Logic**: Exponential backoff with jitter
- **Timeout Management**: Adaptive timeouts
- **Fallback Strategies**: Cache, static, alternative
- **Bulkheading**: Isolate failures

## System Flow

### Simple Query Flow

1. User submits query to Query Gateway
2. Gateway authenticates and creates trace context
3. AI Delegation Engine analyzes query
4. Engine routes to appropriate librarian
5. Librarian searches data and generates answer
6. Response returns through gateway to user

### Complex Multi-Expert Flow

1. User submits complex query
2. AI recognizes multiple domains needed
3. Engine creates parallel delegations
4. Multiple librarians process simultaneously
5. Aggregator merges responses
6. Combined answer returns to user

### Error Recovery Flow

1. Primary librarian fails (timeout/error)
2. Circuit breaker opens
3. System checks cache for recent answer
4. If no cache, tries fallback librarian
5. If all fail, returns partial answer
6. Includes helpful error context

## AI Delegation Engine

### Query Analysis

The AI engine analyzes each query to determine:
- **Intent**: What the user wants to know
- **Domain**: Which area of expertise needed
- **Complexity**: Single or multi-domain query
- **Urgency**: Normal or emergency request
- **Context**: Previous queries, user role

### Routing Algorithm

```python
def route_query(query, available_librarians):
    # 1. Analyze query intent and domains
    analysis = ai.analyze_query(query)
    
    # 2. Find matching librarians
    candidates = match_capabilities(
        analysis.required_capabilities,
        available_librarians
    )
    
    # 3. Score candidates
    scores = score_librarians(candidates, analysis)
    
    # 4. Decide routing strategy
    if analysis.is_multi_domain:
        return create_parallel_delegation(scores)
    else:
        return create_single_delegation(scores[0])
```

### Capability Matching

Librarians declare capabilities in hierarchical format:
```yaml
capabilities:
  - kubernetes.operations.deployment
  - kubernetes.troubleshooting.pods
  - openshift.configuration.routes
```

AI matches query requirements to capabilities using:
- Semantic similarity
- Hierarchical matching
- Historical success rates

## Service Registry

### Schema Structure

```yaml
librarians:
  - id: unique-identifier
    name: Human Readable Name
    description: What this librarian does
    endpoint: https://service.url/librarian
    team: owning-team
    parent: parent-librarian-id  # For hierarchy
    
    capabilities:
      - domain.specific.capability
      
    data_sources:
      - name: Source Name
        type: api|database|filesystem
        
    resilience:
      circuit_breaker:
        error_threshold_percent: 50
        timeout_ms: 5000
      fallback:
        - strategy: cache|delegate|static
          
    sla:
      response_time_ms: 1000
      availability: 99.9
```

### Registration Process

1. Team creates librarian function
2. Team adds entry to registry YAML
3. CI/CD validates schema
4. PR review and merge
5. System auto-discovers new librarian
6. Health check verifies availability
7. AI engine updates routing table

## Observability Layer

### Distributed Tracing

Every request gets traced through the entire system:

```
TraceID: abc123
├─ Span: query-gateway (45ms)
│  ├─ auth-check (5ms)
│  └─ rate-limit (2ms)
├─ Span: ai-delegation (67ms)
│  ├─ query-analysis (23ms)
│  └─ routing-decision (44ms)
├─ Span: platform-librarian (234ms)
│  ├─ data-search (156ms)
│  └─ ai-completion (78ms)
└─ Span: response-aggregation (12ms)
```

### Key Metrics

```
# Request rate
librarian_requests_total{librarian="platform-team", status="success"}

# Latency percentiles  
librarian_request_duration_seconds{librarian="platform-team", quantile="0.99"}

# Error rate
librarian_errors_total{librarian="platform-team", error="timeout"}

# Circuit breaker state
circuit_breaker_state{librarian="platform-team", state="open"}

# AI token usage
ai_tokens_used_total{librarian="platform-team", model="gpt-4"}
```

### Logging Standard

```json
{
  "timestamp": "2024-01-15T10:30:45Z",
  "level": "INFO",
  "trace_id": "abc123",
  "span_id": "def456",
  "librarian": "platform-team",
  "query": "How to deploy Node.js?",
  "duration_ms": 234,
  "status": "success",
  "sources": ["jenkins", "argocd"],
  "confidence": 0.89
}
```

## Resilience Patterns

### Circuit Breaker States

```
CLOSED (Normal Operation)
  │
  ├─ Error rate exceeds threshold
  ▼
OPEN (Rejecting Requests)
  │
  ├─ Reset timeout expires
  ▼
HALF_OPEN (Testing Recovery)
  │
  ├─ Successful requests
  ▼
CLOSED (Recovered)
```

### Fallback Hierarchy

1. **Cache**: Return recent answer if available
2. **Alternative Librarian**: Route to similar capability
3. **Static Response**: Pre-configured helpful message
4. **Partial Answer**: Best effort from available sources
5. **Error with Context**: Helpful error with suggestions

### Timeout Strategy

```typescript
function getTimeout(depth: number): number {
  const base = {
    0: 30000,  // Entry point: 30s
    1: 20000,  // Routers: 20s
    2: 15000,  // Specialists: 15s
    3: 10000,  // Deep experts: 10s
  };
  return base[depth] || 5000;
}
```

## Deployment Architecture

### Kubernetes Deployment

```yaml
# Each librarian is a separate deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: platform-librarian
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: librarian
        image: librarians/platform:latest
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Service Mesh Integration

- **Istio/Linkerd**: For mTLS, observability
- **Envoy Proxy**: For circuit breaking, retries
- **Service Discovery**: Kubernetes native
- **Load Balancing**: Round-robin with health checks

### Infrastructure Requirements

- **Container Orchestration**: Kubernetes 1.25+
- **Message Queue**: Redis for caching
- **Observability Stack**: Prometheus, Grafana, Jaeger
- **AI Infrastructure**: GPU nodes for local models
- **Storage**: S3-compatible for logs/metrics

## Security Model

### Authentication & Authorization

1. **API Gateway**: OAuth2/JWT validation
2. **mTLS**: Between all services
3. **RBAC**: Kubernetes-native permissions
4. **Secrets Management**: HashiCorp Vault
5. **Audit Logging**: All access logged

### Data Protection

- **Encryption in Transit**: TLS 1.3
- **Encryption at Rest**: AES-256
- **PII Detection**: Automatic masking
- **Compliance**: GDPR, CCPA, HIPAA ready
- **Data Residency**: Region-aware routing

## Performance Requirements

### Response Time SLA

- **p50**: < 500ms
- **p95**: < 1500ms  
- **p99**: < 2000ms
- **p99.9**: < 5000ms

### Throughput

- **Sustained**: 1000 queries/second
- **Burst**: 5000 queries/second
- **Concurrent Users**: 10,000+

### Availability

- **Target**: 99.9% (43.8 minutes/month)
- **Measurement Window**: 30 days rolling
- **Excluded**: Planned maintenance

### Resource Efficiency

- **CPU**: < 500m per librarian
- **Memory**: < 512MB per librarian
- **Startup Time**: < 30 seconds
- **AI Token Usage**: < $100/day

## Next Steps

1. Review `IMPLEMENTATION_GUIDE.md` for build instructions
2. Study interfaces in `interfaces/` directory
3. Examine examples in `examples/` directory
4. Understand specs in `specs/` directory

The architecture is designed for simplicity, intelligence, and reliability at scale.