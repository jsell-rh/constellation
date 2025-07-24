# Constellation Monitoring Setup

This guide explains how to set up monitoring for Constellation using Prometheus, Grafana, and the built-in health check system.

## Overview

Constellation provides comprehensive monitoring capabilities:

- **Health Checks**: Real-time system health monitoring
- **Prometheus Metrics**: Performance and operational metrics
- **OpenTelemetry Tracing**: Distributed request tracing
- **Structured Logging**: Queryable JSON logs with context

## Health Check System

### Endpoints

The health check system exposes three endpoints on the metrics port (default: 9090):

1. **Comprehensive Health Check** (`/health`)
   - Provides detailed status of all components
   - Returns HTTP 200 for healthy, 503 for unhealthy
   - Includes individual component statuses and system metrics

2. **Liveness Probe** (`/health/live`)
   - Simple check to verify the process is alive
   - Always returns HTTP 200 if the server is running
   - Used by Kubernetes to restart unhealthy pods

3. **Readiness Probe** (`/health/ready`)
   - Checks if the system is ready to serve traffic
   - Returns HTTP 200 if healthy/degraded, 503 if unhealthy
   - Used by Kubernetes to route traffic

### Health Check Components

The system monitors these components:

- **Router**: Checks librarian registration
- **AI Client**: Verifies AI provider availability
- **Cache**: Tests cache operations
- **Circuit Breakers**: Monitors breaker states
- **Memory**: Tracks heap and system memory usage

### Example Health Response

```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "version": "0.1.0",
  "uptime": 3600,
  "components": [
    {
      "name": "router",
      "status": "healthy",
      "message": "7 librarians registered",
      "responseTime": 0
    },
    {
      "name": "ai-client",
      "status": "healthy",
      "message": "1 provider(s) configured",
      "responseTime": 0
    }
  ],
  "system": {
    "cpu": 1.5,
    "memory": {
      "total": 16777216000,
      "used": 8388608000,
      "percentage": 50
    },
    "loadAverage": [1.5, 1.2, 1.0]
  }
}
```

## Prometheus Metrics

### Configuration

1. **Enable Metrics** (enabled by default):
   ```bash
   export METRICS_ENABLED=true
   export METRICS_PORT=9090
   ```

2. **Configure Prometheus** to scrape metrics:
   ```yaml
   # prometheus.yml
   scrape_configs:
     - job_name: 'constellation'
       static_configs:
         - targets: ['localhost:9090']
       scrape_interval: 15s
   ```

### Available Metrics

#### System Metrics
- `constellation_process_cpu_seconds_total`: CPU usage
- `constellation_process_resident_memory_bytes`: Memory usage
- `constellation_process_heap_bytes`: Heap memory
- `constellation_process_open_fds`: Open file descriptors

#### Librarian Metrics
- `constellation_librarian_executions_total`: Request count by librarian
- `constellation_librarian_duration_seconds`: Response time histogram
- `constellation_delegation_hops_total`: Delegation chain length

#### AI Provider Metrics
- `constellation_ai_provider_requests_total`: AI requests by provider/status
- `constellation_ai_provider_duration_seconds`: AI response time
- `constellation_ai_provider_tokens_total`: Token usage

#### Circuit Breaker Metrics
- `constellation_circuit_breaker_state`: Current breaker state
- `constellation_circuit_breaker_trips_total`: Circuit breaker trips
- `constellation_circuit_breaker_rejections_total`: Rejected requests

## Grafana Dashboard

### Import Dashboard

1. Copy the dashboard from `monitoring/grafana-dashboard.json`
2. In Grafana, go to **Dashboards** → **Import**
3. Paste the JSON content
4. Select your Prometheus data source
5. Click **Import**

### Dashboard Panels

The dashboard includes:

- **System Health**: Overall status gauge and memory usage
- **Librarian Performance**: Request rates and response times
- **AI Provider Metrics**: Token usage and request rates
- **Circuit Breakers**: State monitoring and rejection rates

## OpenTelemetry Tracing

### Configuration

1. **Enable Tracing**:
   ```bash
   export TRACE_ENABLED=true
   export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
   export OTEL_SERVICE_NAME=constellation
   ```

2. **Supported Exporters**:
   - OTLP (default): For Jaeger, Tempo, etc.
   - Console: For debugging (`OTEL_TRACES_EXPORTER=console`)

### Trace Context

Every request is traced with:
- Request ID propagation
- Span hierarchies for delegation chains
- AI provider call details
- Cache hit/miss information

## Structured Logging

### Log Format

All logs use structured JSON format with consistent fields:

```json
{
  "timestamp": "2025-01-15T10:30:00.123Z",
  "level": "info",
  "component": "router",
  "requestId": "req_abc123",
  "traceId": "trace123",
  "spanId": "span456",
  "message": "Librarian execution completed",
  "librarianId": "hello",
  "duration": 123
}
```

### Log Aggregation

For production, aggregate logs using:
- **ELK Stack**: Elasticsearch, Logstash, Kibana
- **Loki**: Lightweight log aggregation for Grafana
- **CloudWatch**: For AWS deployments

## Docker Compose Setup

Example `docker-compose.yml` for local monitoring:

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9091:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana-dashboard.json:/var/lib/grafana/dashboards/constellation.json

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # Jaeger UI
      - "4317:4317"    # OTLP gRPC
      - "4318:4318"    # OTLP HTTP
    environment:
      - COLLECTOR_OTLP_ENABLED=true

volumes:
  prometheus_data:
  grafana_data:
```

## Kubernetes Deployment

### Health Check Configuration

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: constellation
spec:
  template:
    spec:
      containers:
      - name: constellation
        livenessProbe:
          httpGet:
            path: /health/live
            port: 9090
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 9090
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Service Monitor for Prometheus Operator

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: constellation
spec:
  selector:
    matchLabels:
      app: constellation
  endpoints:
  - port: metrics
    interval: 15s
    path: /metrics
```

## Alerting Rules

Example Prometheus alerting rules:

```yaml
groups:
  - name: constellation
    rules:
      - alert: ConstellationDown
        expr: up{job="constellation"} == 0
        for: 5m
        annotations:
          summary: "Constellation is down"

      - alert: HighMemoryUsage
        expr: constellation_process_resident_memory_bytes / constellation_process_max_heap_bytes > 0.9
        for: 5m
        annotations:
          summary: "High memory usage (>90%)"

      - alert: CircuitBreakerOpen
        expr: constellation_circuit_breaker_state == 2
        for: 1m
        annotations:
          summary: "Circuit breaker open for {{ $labels.librarian_id }}"

      - alert: HighErrorRate
        expr: rate(constellation_librarian_executions_total{status="error"}[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High error rate for {{ $labels.librarian_id }}"
```

## Performance Tuning

### Metrics Collection

1. **Adjust scrape interval** based on load:
   ```yaml
   scrape_interval: 30s  # For lower load
   scrape_interval: 5s   # For high-frequency monitoring
   ```

2. **Limit histogram buckets** for high-cardinality metrics:
   ```javascript
   const durationHistogram = new promClient.Histogram({
     name: 'duration_seconds',
     buckets: [0.1, 0.5, 1, 2, 5]  // Fewer buckets
   });
   ```

### Health Check Optimization

1. **Adjust check interval**:
   ```javascript
   healthManager.startPeriodicChecks(60000); // Check every minute
   ```

2. **Cache health results** for high-traffic scenarios:
   - Use `/health/ready` with cached results
   - Run full `/health` checks less frequently

## Troubleshooting

### Common Issues

1. **Metrics endpoint not accessible**
   - Check `METRICS_ENABLED` is not set to `false`
   - Verify `METRICS_PORT` is not blocked by firewall
   - Ensure the metrics server started (check logs)

2. **Health checks timing out**
   - Increase timeout values for slow components
   - Check AI provider connectivity
   - Verify cache configuration

3. **Missing traces**
   - Ensure `TRACE_ENABLED=true`
   - Check OTLP endpoint connectivity
   - Verify trace context propagation

### Debug Commands

```bash
# Check health status
curl http://localhost:9090/health | jq .

# View specific metrics
curl -s http://localhost:9090/metrics | grep constellation_librarian

# Test trace export
OTEL_TRACES_EXPORTER=console npm start

# Enable debug logging
LOG_LEVEL=debug npm start
```

## Best Practices

1. **Monitor Key Metrics**:
   - Response time (p95, p99)
   - Error rates by librarian
   - Memory usage trends
   - Circuit breaker states

2. **Set Appropriate Alerts**:
   - System down/unreachable
   - High error rates (>5%)
   - Memory usage (>85%)
   - Circuit breakers open

3. **Regular Reviews**:
   - Weekly dashboard reviews
   - Monthly alert threshold tuning
   - Quarterly capacity planning

4. **Data Retention**:
   - Metrics: 15-30 days
   - Traces: 7 days
   - Logs: 30-90 days

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Tutorials](https://grafana.com/tutorials/)
- [OpenTelemetry Guide](https://opentelemetry.io/docs/)
- [Constellation Architecture](./ARCHITECTURE.md)
