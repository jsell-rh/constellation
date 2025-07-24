# Structured Logging Migration Guide

## Overview

This guide helps migrate from basic pino logging to our new structured logging system that provides:
- Automatic trace context injection
- Standardized field names
- Security-sensitive data redaction
- Performance timing utilities
- Context propagation

## Migration Steps

### 1. Replace Logger Creation

**Before:**
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});
```

**After:**
```typescript
import { createLogger } from '../observability/logger';

const logger = createLogger('module-name');
```

### 2. Use Context Logger in Request Handlers

**Before:**
```typescript
async execute(librarian: Librarian, query: string, context: Context): Promise<Response> {
  logger.info({ query, librarianId }, 'Executing librarian');
}
```

**After:**
```typescript
import { createContextLogger } from '../observability/logger';

async execute(librarian: Librarian, query: string, context: Context): Promise<Response> {
  const logger = createContextLogger('executor', context);
  logger.info({ query }, 'Executing librarian'); // context fields auto-added
}
```

### 3. Use Performance Timers

**Before:**
```typescript
const startTime = Date.now();
// ... do work ...
const duration = Date.now() - startTime;
logger.info({ duration }, 'Operation completed');
```

**After:**
```typescript
import { PerformanceTimer, logPerformance } from '../observability/logger';

const timer = new PerformanceTimer();
// ... do work ...
timer.mark('validation');
// ... more work ...
timer.mark('execution');
logPerformance(logger, 'librarian.execute', timer);
```

### 4. Standardized Field Names

Use these standard fields for consistency:

| Old Field | New Field | Description |
|-----------|-----------|-------------|
| `id` | `librarianId` | Librarian identifier |
| `user` | `userId` | User identifier |
| `error` | Use pino's standard `err` | Error object |
| `time` | `duration` | Operation duration in ms |
| `chain` | `delegationChain` | Delegation chain array |

### 5. Structured Error Logging

**Before:**
```typescript
logger.error({ error: err, context: someData }, 'Operation failed');
```

**After:**
```typescript
logger.error({
  err, // Use standard 'err' field
  errorCode: err.code,
  errorType: 'VALIDATION_ERROR',
  recoverable: true,
  ...additionalContext
}, 'Operation failed');
```

## Example: Full Module Migration

```typescript
// Before
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export class MyService {
  async process(data: any, context: Context): Promise<Result> {
    const start = Date.now();
    logger.info({ data }, 'Processing started');

    try {
      const result = await this.doWork(data);
      logger.info({ duration: Date.now() - start }, 'Processing completed');
      return result;
    } catch (error) {
      logger.error({ error }, 'Processing failed');
      throw error;
    }
  }
}

// After
import { createLogger, createContextLogger, PerformanceTimer, logPerformance } from '../observability/logger';

const moduleLogger = createLogger('my-service');

export class MyService {
  async process(data: any, context: Context): Promise<Result> {
    const logger = createContextLogger('my-service', context);
    const timer = new PerformanceTimer();

    logger.info({ dataSize: data.length }, 'Processing started');

    try {
      timer.mark('validation');
      this.validate(data);

      timer.mark('processing');
      const result = await this.doWork(data);

      logPerformance(logger, 'data.process', timer, {
        resultSize: result.length,
      });

      return result;
    } catch (error) {
      logger.error({
        err: error,
        errorCode: error.code || 'UNKNOWN',
        errorType: 'PROCESSING_ERROR',
        recoverable: error.recoverable ?? false,
      }, 'Processing failed');
      throw error;
    }
  }
}
```

## Benefits

1. **Automatic Trace Context**: Every log includes traceId and spanId from OpenTelemetry
2. **Consistent Structure**: Standard field names across all modules
3. **Security**: Automatic redaction of sensitive fields
4. **Performance Insights**: Built-in timing and performance logging
5. **Context Propagation**: Request context flows through all logs
6. **Better Debugging**: Correlated logs across distributed operations
