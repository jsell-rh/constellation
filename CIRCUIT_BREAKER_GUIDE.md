# Circuit Breaker Guide

Circuit breakers protect your Constellation system from cascading failures by automatically detecting when a librarian is failing and temporarily blocking requests to give it time to recover.

## Overview

Circuit breakers are **completely transparent** to librarian developers. You write your function, the framework handles resilience:

```typescript
// Your librarian code stays simple
export default async function myLibrarian(query: string, context?: Context): Promise<Response> {
  const result = await externalService.query(query);
  return { answer: result };
}
```

The framework automatically wraps your librarian with circuit breaker protection based on configuration.

## How It Works

### States

Circuit breakers have three states:

1. **Closed** (Normal Operation)
   - All requests pass through
   - Failures are counted
   - Opens when failure threshold is exceeded

2. **Open** (Failing Fast)
   - All requests are immediately rejected
   - Returns error: `CIRCUIT_BREAKER_OPEN`
   - Waits for timeout before attempting recovery

3. **Half-Open** (Testing Recovery)
   - Allows limited requests through
   - If successful, moves to Closed
   - If failing, returns to Open

### Configuration

Configure circuit breakers in your registry YAML:

```yaml
librarians:
  - id: external-api
    name: External API Client
    function: ./src/librarians/external-api.ts
    team: platform
    resilience:
      circuit_breaker:
        failureThreshold: 0.3    # Open at 30% failure rate
        volumeThreshold: 10      # Need at least 10 requests
        windowSize: 30000        # 30 second window
        timeout: 60000           # Try again after 1 minute
        successThreshold: 3      # Need 3 successes to close
```

### Configuration Options

- **failureThreshold** (0-1): Percentage of failures before opening
- **volumeThreshold**: Minimum requests before calculating failure rate
- **windowSize**: Time window for failure rate calculation (ms)
- **timeout**: Time to wait before moving to half-open (ms)
- **successThreshold**: Successful requests needed to close from half-open

## Default Values

If not specified, these defaults apply:

```yaml
failureThreshold: 0.5     # 50% failure rate
volumeThreshold: 20       # 20 requests minimum
windowSize: 60000         # 1 minute window
timeout: 60000            # 1 minute timeout
successThreshold: 5       # 5 successes to close
```

## Examples

### High-Traffic Service
```yaml
resilience:
  circuit_breaker:
    failureThreshold: 0.1    # Very sensitive - 10% failures
    volumeThreshold: 100     # High volume threshold
    windowSize: 10000        # 10 second window
    timeout: 30000           # Quick recovery attempt
```

### Critical Service
```yaml
resilience:
  circuit_breaker:
    failureThreshold: 0.5    # Tolerate 50% failures
    volumeThreshold: 5       # Low volume threshold
    timeout: 120000          # Longer recovery time
    successThreshold: 10     # Need more successes
```

### Development/Testing
```yaml
resilience:
  circuit_breaker:
    enabled: false           # Disable for development
```

## Response Format

When a circuit breaker is open:

```json
{
  "error": {
    "code": "CIRCUIT_BREAKER_OPEN",
    "message": "Circuit breaker is open for external-api. Service is temporarily unavailable.",
    "recoverable": true,
    "details": {
      "retryAfter": 1234567890123
    }
  }
}
```

## Monitoring

Circuit breaker events are logged and traced:

```
{"level":30,"circuitBreaker":"external-api","from":"closed","to":"open","msg":"Circuit breaker state changed"}
{"level":40,"circuitBreaker":"external-api","state":"open","msg":"Request rejected by circuit breaker"}
```

## Environment Variables

Global defaults can be set via environment:

```bash
CIRCUIT_BREAKER_ENABLED=false                    # Disable globally
CIRCUIT_BREAKER_FAILURE_THRESHOLD=0.3           # 30% failure rate
CIRCUIT_BREAKER_VOLUME_THRESHOLD=10             # 10 requests
CIRCUIT_BREAKER_WINDOW_SIZE=30000               # 30 seconds
CIRCUIT_BREAKER_TIMEOUT=60000                   # 1 minute
CIRCUIT_BREAKER_SUCCESS_THRESHOLD=3             # 3 successes
```

## Best Practices

1. **Start Conservative**: Begin with default values and adjust based on metrics
2. **Consider Dependencies**: External services may need different thresholds than internal
3. **Monitor State Changes**: Watch for frequent open/close cycles
4. **Test Failure Scenarios**: Ensure your system handles open circuits gracefully
5. **Document Thresholds**: Explain why specific values were chosen

## Testing

Test circuit breakers in development:

```bash
# Manually open a circuit
curl -X POST http://localhost:3001/admin/circuit-breaker/external-api/open

# Check circuit states
curl http://localhost:3001/admin/circuit-breaker/status

# Reset all circuits
curl -X POST http://localhost:3001/admin/circuit-breaker/reset
```

## Integration with Other Features

Circuit breakers work seamlessly with:
- **Tracing**: Circuit events appear in traces
- **Caching**: Cached responses can serve when circuit is open
- **Authentication**: Circuit state is per-librarian, not per-user
- **Delegation**: Each librarian has its own circuit breaker

## Troubleshooting

**Circuit Opens Too Often**
- Increase `failureThreshold`
- Increase `volumeThreshold`
- Check if failures are legitimate

**Circuit Never Opens**
- Decrease `failureThreshold`
- Ensure failures return proper error responses
- Check `volumeThreshold` isn't too high

**Slow Recovery**
- Decrease `timeout`
- Decrease `successThreshold`
- Monitor half-open state behavior