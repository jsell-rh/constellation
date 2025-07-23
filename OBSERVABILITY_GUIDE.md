# Observability Guide

Constellation provides built-in observability through distributed tracing, making it easy to debug and monitor your librarian network in production.

## Overview

Every librarian execution is automatically traced, providing:
- End-to-end request flow visibility
- Performance metrics and bottleneck identification
- Error tracking with detailed context
- Zero configuration required for developers

## How It Works

### Automatic Tracing

When tracing is enabled, the framework automatically:

1. **Creates spans** for every librarian execution
2. **Adds attributes** like librarian ID, query, user info
3. **Records events** for key operations (start, complete, error)
4. **Measures timing** for performance analysis
5. **Propagates context** through delegation chains

### Developer Experience

Librarians require **no changes** to support tracing:

```typescript
// Your librarian code stays simple
export default async function myLibrarian(query: string, context: Context) {
  // Tracing happens automatically!
  const result = await fetchData(query);
  return { answer: result };
}
```

### What Gets Traced

Every librarian execution includes:

```
Span: librarian.execute
├── Attributes:
│   ├── librarian.id: "my-librarian"
│   ├── librarian.name: "My Librarian"
│   ├── librarian.team: "my-team"
│   ├── query.text: "What is..." (truncated)
│   ├── query.length: 45
│   ├── user.id: "user-123"
│   └── user.teams: "team1,team2"
├── Events:
│   ├── librarian.execution.start
│   ├── librarian.execution.complete
│   └── librarian.execution.error (if failed)
└── Result Attributes:
    ├── response.has_answer: true
    ├── response.confidence: 0.95
    └── response.execution_time_ms: 234
```

## Configuration

### Environment Variables

```bash
# Enable tracing (default: false)
TRACE_ENABLED=true

# OpenTelemetry endpoint (optional)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Log level for trace output in development
LOG_LEVEL=debug
```

### Development Mode

In development, traces are logged to the console:

```bash
# Start with tracing in development
TRACE_ENABLED=true NODE_ENV=development npm run dev
```

You'll see output like:
```
{"level":20,"span":"librarian.execute","traceId":"01k0vyn5a8xk3q8h6amd2dy677","duration":"234ms","status":"OK","msg":"Span completed"}
```

### Production Mode

In production, traces are exported to your observability platform:

```bash
# Production with Jaeger
TRACE_ENABLED=true \
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318 \
npm start

# Production with Datadog
TRACE_ENABLED=true \
OTEL_EXPORTER_OTLP_ENDPOINT=http://datadog-agent:4318 \
npm start
```

## Trace Context in Librarians

The trace context is automatically available:

```typescript
export default async function myLibrarian(query: string, context: Context) {
  // Access trace information
  const traceId = context.trace?.traceId;
  
  // Log with trace context
  console.log(`Processing query in trace ${traceId}`);
  
  // Pass trace ID to external services
  const result = await fetch('/api/data', {
    headers: {
      'X-Trace-Id': traceId
    }
  });
  
  return { 
    answer: result,
    metadata: {
      traceId // Include in response for debugging
    }
  };
}
```

## Viewing Traces

### Local Development

With console output enabled, you can grep for specific traces:

```bash
# Find all spans for a trace
npm run dev | grep "01k0vyn5a8xk3q8h6amd2dy677"

# Find slow operations
npm run dev | grep "duration" | grep -E "[0-9]{4,}ms"

# Find errors
npm run dev | grep "status.*ERROR"
```

### Jaeger UI

If using Jaeger, access the UI at http://localhost:16686:

1. Select service: "constellation"
2. Find traces by:
   - Librarian ID: `librarian.id=hello`
   - User: `user.id=user-123`
   - Errors: `error=true`
   - Slow requests: `duration>1s`

### Grafana Tempo

Query traces using TraceQL:

```
# Find slow librarian executions
{ name="librarian.execute" && duration > 1s }

# Find failed executions
{ name="librarian.execute" && status=error }

# Find by specific librarian
{ name="librarian.execute" && librarian.id="ai-assistant" }
```

## Performance Impact

Tracing has minimal overhead:
- ~1-2ms per librarian execution
- Async export doesn't block requests
- Sampling can reduce volume in production

## Best Practices

### 1. Enable in Production

Always enable tracing in production for debugging:
```bash
TRACE_ENABLED=true
```

### 2. Use Sampling for High Volume

For high-traffic services, use sampling:
```bash
OTEL_TRACES_SAMPLER=traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1  # Sample 10%
```

### 3. Add Custom Attributes

In your librarian, add helpful context:
```typescript
return {
  answer: result,
  metadata: {
    dataSource: 'customer-db',
    cacheHit: true,
    processingSteps: 3
  }
};
```

### 4. Correlate with Logs

Include trace ID in logs:
```typescript
logger.info({
  traceId: context.trace?.traceId,
  message: 'Processing customer query'
});
```

### 5. Monitor Key Metrics

Set alerts on:
- P99 latency > 2s
- Error rate > 1%
- Specific librarian failures

## Troubleshooting

### Traces Not Appearing

1. Check `TRACE_ENABLED=true`
2. Verify OTLP endpoint is reachable
3. Check for errors in logs
4. Ensure librarian is being called

### Missing Attributes

- User info requires authentication enabled
- Some attributes only appear on errors
- Check log level for development output

### Performance Issues

- Reduce sampling rate
- Use batch export (default)
- Check network latency to OTLP endpoint

## Example: Debugging a Slow Query

1. User reports slow response
2. Search traces: `duration > 2s`
3. Find trace ID: `01k0vyn5a8xk3q8h6amd2dy677`
4. View span details:
   - Librarian: "ai-assistant"
   - Query length: 500 chars
   - User: "user-123"
   - Duration: 3.2s
5. Check delegation chain - delegated 3 times
6. Identify bottleneck: "code-reviewer" took 2.8s
7. Optimize that specific librarian

## Integration with APM Tools

### Datadog

```yaml
# docker-compose.yml
datadog-agent:
  image: datadog/agent:latest
  environment:
    - DD_OTLP_CONFIG_RECEIVER_PROTOCOLS_GRPC_ENDPOINT=0.0.0.0:4317
    - DD_OTLP_CONFIG_RECEIVER_PROTOCOLS_HTTP_ENDPOINT=0.0.0.0:4318
```

### New Relic

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.nr-data.net:4318
OTEL_EXPORTER_OTLP_HEADERS=api-key=YOUR_LICENSE_KEY
```

### AWS X-Ray

```bash
# Use ADOT Collector
OTEL_EXPORTER_OTLP_ENDPOINT=http://aws-otel-collector:4318
```

## Summary

Constellation's observability features provide:
- **Zero-effort tracing** - Works automatically
- **Rich context** - All relevant attributes included
- **Production-ready** - Integrates with any OTLP backend
- **Developer-friendly** - Console output for local debugging
- **Performance-focused** - Minimal overhead, configurable sampling

Teams get complete visibility into their librarian network without writing any observability code!