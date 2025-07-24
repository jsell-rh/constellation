# Constellation Logging Best Practices

## Overview

This document outlines the logging standards and best practices for the Constellation project. All components should follow these guidelines to ensure consistent, secure, and queryable logs.

## Core Principles

1. **Use Structured Logging**: All logs must use structured fields for better querying
2. **Component-Based Loggers**: Each module should create its own named logger
3. **Context Propagation**: Use context loggers when request context is available
4. **Security First**: Never log sensitive data (passwords, tokens, keys)
5. **Meaningful Fields**: Use descriptive field names that aid in debugging

## Logger Creation

### Module Logger
```typescript
import { createLogger } from '../observability/logger';

const logger = createLogger('component-name');
```

### Context Logger (within request handlers)
```typescript
import { createContextLogger } from '../observability/logger';

async function handleRequest(context: Context) {
  const logger = createContextLogger('handler-name', context);
  // Logger automatically includes: userId, requestId, traceId, spanId, etc.
}
```

## Structured Logging Format

### Basic Log Structure
```typescript
logger.info({
  // Required fields
  message: string,      // Log message

  // Context fields (automatically added by context logger)
  requestId?: string,
  traceId?: string,
  spanId?: string,
  userId?: string,
  librarianId?: string,

  // Custom fields
  [key: string]: any
}, 'Human-readable message');
```

### Error Logging
Always use the `err` field (not `error`) for Error objects:

```typescript
logger.error({
  err: error,                    // The Error object (required)
  errorCode: 'SPECIFIC_ERROR',   // Specific error code
  errorType: 'CATEGORY',         // Error category (e.g., 'API_ERROR', 'VALIDATION_ERROR')
  recoverable: boolean,          // Whether the error is recoverable
  // Additional context
  userId: user.id,
  operation: 'user.update',
}, 'Operation failed');
```

### Performance Logging
Use the PerformanceTimer for operation timing:

```typescript
import { PerformanceTimer, logPerformance } from '../observability/logger';

const timer = new PerformanceTimer();

// Mark different phases
timer.mark('validation');
// ... validation code ...

timer.mark('processing');
// ... processing code ...

// Log performance with all marks
logPerformance(logger, 'operation.name', timer, {
  additionalContext: 'value'
});
```

## Standard Field Names

Use these consistent field names across the codebase:

| Field | Type | Description |
|-------|------|-------------|
| `err` | Error | Error object (not `error`) |
| `errorCode` | string | Specific error code (e.g., 'TIMEOUT', 'NOT_FOUND') |
| `errorType` | string | Error category (e.g., 'API_ERROR', 'VALIDATION_ERROR') |
| `recoverable` | boolean | Whether the error can be retried |
| `userId` | string | User identifier |
| `librarianId` | string | Librarian identifier |
| `requestId` | string | Request correlation ID |
| `duration` | number | Operation duration in milliseconds |
| `count` | number | Count of items |
| `size` | number | Size in bytes |
| `status` | string | Operation status ('success', 'error', 'timeout') |

## Log Levels

- **error**: Actionable errors that need attention
- **warn**: Potentially problematic situations
- **info**: High-level operational messages
- **debug**: Detailed information for debugging

## Security Considerations

The logger automatically redacts these sensitive fields:
- password, pwd, pass
- token, apikey, api_key
- secret, private_key
- auth, authorization
- cookie, session
- ssn, credit_card

Never log:
- Full request/response bodies containing user data
- Authentication credentials
- Personal identifiable information (PII)
- Internal system paths or configurations

## Examples

### API Request Handling
```typescript
const logger = createContextLogger('api-handler', context);
const timer = new PerformanceTimer();

logger.info({
  method: req.method,
  path: req.path,
  queryParams: Object.keys(req.query),
}, 'API request received');

try {
  const result = await processRequest(req);

  logPerformance(logger, 'api.request', timer, {
    status: 'success',
    resultSize: result.length,
  });

  return result;
} catch (error) {
  logger.error({
    err: error,
    errorCode: 'REQUEST_PROCESSING_FAILED',
    errorType: 'API_ERROR',
    recoverable: error.code === 'TIMEOUT',
    method: req.method,
    path: req.path,
  }, 'Failed to process API request');

  throw error;
}
```

### Librarian Execution
```typescript
logger.info({
  librarianId,
  queryLength: query.length,
  hasUser: !!context.user,
}, 'Starting librarian execution');

// ... execution code ...

logger.info({
  librarianId,
  executionTimeMs: timer.getDuration(),
  responseType: response.answer ? 'answer' : 'error',
  confidence: response.confidence,
}, 'Librarian execution completed');
```

### Cache Operations
```typescript
logger.debug({
  cacheKey: key,
  cacheHit: true,
  ttl: remainingTTL,
}, 'Cache hit');

logger.info({
  operation: 'cache.invalidate',
  pattern: 'user:*',
  keysInvalidated: count,
}, 'Cache invalidation completed');
```

## Integration with Observability

The structured logging system integrates with:

1. **OpenTelemetry**: Trace IDs and span IDs are automatically injected
2. **Request Correlation**: Request IDs flow through all operations
3. **Metrics**: Log data can be used to generate metrics
4. **Alerting**: Structured fields enable precise alerting rules

## Migration from Old Logging

If you find code using old logging patterns:

```typescript
// OLD - Don't use
console.log('Processing request', { data });
pino().info({ error: err }, 'Failed');

// NEW - Use this instead
logger.info({ requestData: data }, 'Processing request');
logger.error({ err, errorCode: 'PROCESSING_FAILED' }, 'Failed');
```

## Testing

When writing tests, you can check for specific log fields:

```typescript
// Mock the logger
const logSpy = jest.spyOn(logger, 'info');

// Test the operation
await operation();

// Verify structured logging
expect(logSpy).toHaveBeenCalledWith(
  expect.objectContaining({
    userId: 'test-user',
    operation: 'test-op',
  }),
  expect.any(String)
);
```

## Summary

Following these logging practices ensures:
- Consistent log structure across all services
- Easy debugging with correlated logs
- Security through automatic redaction
- Performance insights through structured timing
- Better observability and monitoring

Always remember: logs are for humans AND machines. Make them readable and queryable!
