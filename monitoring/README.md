# Constellation Monitoring

This directory contains monitoring configurations and dashboards for the Constellation system.

## Files

### Dashboards

1. **`grafana-dashboard.json`** (Original)
   - Basic monitoring dashboard
   - Contains metric naming mismatches
   - Limited enterprise features
   - Kept for reference

2. **`grafana-dashboard-enterprise.json`** (Recommended)
   - Production-ready enterprise dashboard
   - All metric naming issues fixed
   - Comprehensive monitoring panels
   - SLA tracking and alerting support

### Documentation

1. **`dashboard-migration-guide.md`**
   - Detailed guide for migrating to enterprise dashboard
   - Lists all fixes and improvements
   - Best practices for monitoring

## Quick Start

### Import Enterprise Dashboard

1. Open Grafana UI
2. Navigate to **Dashboards** → **Import**
3. Upload `grafana-dashboard-enterprise.json`
4. Select your Prometheus datasource
5. Click **Import**

### Verify Metrics

Ensure Constellation is running with metrics enabled:
```bash
curl http://localhost:9090/metrics | grep constellation_
```

## Key Features

### Executive Summary
- System health status
- Real-time QPS monitoring
- SLA compliance tracking
- Overall error rate

### Performance Monitoring
- Query response time percentiles (p50, p95, p99)
- Per-librarian performance metrics
- AI provider response times
- Cache hit ratios

### Resilience Tracking
- Circuit breaker states
- Error distribution
- Delegation patterns
- Resource utilization

### Enterprise Features
- Comprehensive error tracking
- Response quality metrics
- Capacity planning data
- Resource trend analysis

## Metric Categories

### Query Metrics
- `constellation_queries_total` - Total queries with status
- `constellation_query_duration_seconds` - Query latency
- `constellation_active_queries` - Current active queries
- `constellation_current_qps` - Real-time QPS

### Librarian Metrics
- `constellation_librarian_executions_total` - Executions by librarian
- `constellation_librarian_execution_duration_seconds` - Execution time
- `constellation_response_confidence` - Response quality

### AI Provider Metrics
- `constellation_ai_requests_total` - AI API requests
- `constellation_ai_tokens_total` - Token usage
- `constellation_ai_request_duration_seconds` - AI latency

### System Metrics
- `constellation_circuit_breaker_state` - Breaker states
- `constellation_cache_hits_total` - Cache performance
- `constellation_errors_total` - Error tracking
- `constellation_sla_violations_total` - SLA breaches

## Alerting

Example Prometheus alert rules are provided in the migration guide for:
- System availability
- SLA compliance
- Error rates
- Resource utilization
- Performance degradation

## Support

For issues or questions:
1. Check the dashboard migration guide
2. Verify metric names in Prometheus
3. Review Constellation logs for metric export errors
4. Ensure proper Prometheus scrape configuration
