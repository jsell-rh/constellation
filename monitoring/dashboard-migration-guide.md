# Constellation Grafana Dashboard Migration Guide

## Overview

The enterprise dashboard (`grafana-dashboard-enterprise.json`) fixes all metric naming mismatches and provides comprehensive monitoring suitable for production environments.

## Fixed Metric Naming Issues

### 1. Corrected Metric Names
- **OLD**: `constellation_librarian_duration_seconds_bucket`
  **NEW**: `constellation_librarian_execution_duration_seconds_bucket`

- **OLD**: `constellation_ai_provider_requests_total`
  **NEW**: `constellation_ai_requests_total`

- **OLD**: `constellation_ai_provider_tokens_total`
  **NEW**: `constellation_ai_tokens_total`

### 2. Fixed Label Names
- **OLD**: `librarian_id`
  **NEW**: `librarian` (matches actual exported labels)

### 3. Proper Default Metrics
- Now using `constellation_process_resident_memory_bytes` (actual metric)
- Added `constellation_nodejs_heap_size_total_bytes` for heap monitoring
- Removed non-existent `constellation_process_max_heap_bytes`

## New Enterprise Features

### Executive Summary Section
1. **System Health Gauge** - Real-time UP/DOWN status
2. **Current QPS** - Shows current query rate vs 1000 QPS SLA
3. **SLA Compliance %** - Percentage of requests meeting 2-second SLA
4. **Error Rate %** - Overall system error rate

### Performance Metrics
1. **Query Response Time Percentiles** - p50, p95, p99 with SLA threshold line
2. **Query Load** - Request rate and active queries on dual axis

### Librarian Performance
1. **Request Rate by Librarian** - Sorted by highest volume
2. **Response Time (p95)** - Identify slow librarians
3. **Error Rate by Librarian** - Spot problematic librarians
4. **Average Response Confidence** - Quality metrics per librarian

### AI Provider Metrics
1. **Request Rate with Status** - Success/failure breakdown
2. **Token Usage** - Stacked by provider and type (prompt/completion)
3. **Response Time Percentiles** - p95 and p99 by provider

### System Resilience
1. **Circuit Breaker States** - Visual status indicators
2. **Circuit Breaker Rejections** - Track protection activations
3. **Cache Hit Ratio** - Performance optimization metric
4. **Error Distribution** - Pie chart of error types

### Delegation & Response Quality
1. **Delegation Chain Depth** - Complexity visualization
2. **Parallel Delegation Operations** - System utilization
3. **Response Confidence Heatmap** - Quality distribution over time

### System Resources
1. **Memory Usage** - RSS, Heap Total, Heap Used
2. **CPU & Event Loop** - CPU usage and event loop lag

## Key Improvements

### 1. SLA Monitoring
The dashboard now actively tracks SLA compliance:
- Response time violations (2-second threshold)
- QPS capacity violations (1000 QPS threshold)
- Visual alerts when approaching limits

### 2. Error Tracking
Comprehensive error monitoring:
- Overall error rate gauge
- Per-librarian error rates
- Error type distribution
- Recoverable vs non-recoverable errors

### 3. Quality Metrics
Response quality tracking:
- Confidence score distribution
- Average confidence by librarian
- Source count in responses

### 4. Capacity Planning
Resource utilization metrics:
- Active queries vs capacity
- Memory usage trends
- CPU and event loop health
- Cache effectiveness

## Migration Steps

1. **Import New Dashboard**
   ```bash
   # In Grafana UI:
   # 1. Go to Dashboards → Import
   # 2. Upload grafana-dashboard-enterprise.json
   # 3. Select your Prometheus datasource
   # 4. Click Import
   ```

2. **Update Alerts** (if using old dashboard alerts)
   - Update metric names in alert rules
   - Adjust thresholds based on new SLA panels

3. **Archive Old Dashboard**
   - Export old dashboard for backup
   - Delete or rename to "Legacy"

## Dashboard Best Practices

### 1. Time Ranges
- **Real-time monitoring**: Last 1 hour
- **Incident investigation**: Last 6-24 hours
- **Trend analysis**: Last 7-30 days

### 2. Refresh Intervals
- **During incidents**: 5-10 seconds
- **Normal operations**: 30 seconds to 1 minute
- **Historical analysis**: No auto-refresh

### 3. Key Panels to Monitor

**For Operations**:
- System Health gauge
- Current QPS
- SLA Compliance
- Error Rate
- Circuit Breaker States

**For Performance Tuning**:
- Query Response Time Percentiles
- Cache Hit Ratio
- AI Provider Response Times
- Memory Usage

**For Capacity Planning**:
- Query Load trends
- Delegation Chain Depth
- Token Usage
- Resource utilization

### 4. Alert Thresholds

Recommended alert rules based on dashboard metrics:

```yaml
# Prometheus Alert Rules
groups:
  - name: constellation_enterprise
    rules:
      # System Down
      - alert: ConstellationDown
        expr: up{job="constellation"} == 0
        for: 2m
        annotations:
          severity: critical
          summary: "Constellation service is down"

      # SLA Violation
      - alert: SLAViolation
        expr: (1 - (rate(constellation_sla_violations_total{type="response_time"}[5m]) / rate(constellation_queries_total[5m]))) < 0.99
        for: 5m
        annotations:
          severity: warning
          summary: "SLA compliance below 99%"

      # High Error Rate
      - alert: HighErrorRate
        expr: (rate(constellation_errors_total[5m]) / rate(constellation_queries_total[5m])) > 0.05
        for: 5m
        annotations:
          severity: warning
          summary: "Error rate above 5%"

      # QPS Near Limit
      - alert: QPSNearLimit
        expr: constellation_current_qps > 900
        for: 2m
        annotations:
          severity: warning
          summary: "QPS approaching 1000 limit"

      # Memory Pressure
      - alert: HighMemoryUsage
        expr: (constellation_nodejs_heap_size_used_bytes / constellation_nodejs_heap_size_total_bytes) > 0.85
        for: 5m
        annotations:
          severity: warning
          summary: "Heap usage above 85%"
```

## Troubleshooting

### Missing Metrics
If some panels show "No Data":
1. Check if Constellation is running with metrics enabled
2. Verify Prometheus is scraping the correct endpoint
3. Allow 1-2 minutes for metrics to populate
4. Check metric names match your Prometheus labels

### Performance Issues
If dashboard is slow:
1. Reduce time range
2. Increase refresh interval
3. Disable auto-refresh for historical analysis
4. Consider creating focused dashboards for specific use cases

## Summary

The enterprise dashboard provides:
- ✅ All metric naming issues fixed
- ✅ Comprehensive SLA monitoring
- ✅ Enterprise-grade error tracking
- ✅ Resource utilization metrics
- ✅ Response quality tracking
- ✅ Proper labeling and units
- ✅ Executive summary view
- ✅ Operational insights

This dashboard is production-ready and provides the observability needed for enterprise deployment of Constellation.
