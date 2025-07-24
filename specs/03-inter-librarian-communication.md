# Specification: Inter-Librarian Communication

## Overview

This specification defines how librarians communicate with each other in Constellation, focusing on simplicity, performance, and reliability.

## Current State Analysis

### What Exists
1. **DelegateRequest** type in Response objects
2. **Delegation Engine** that analyzes and routes queries
3. **No actual execution** of delegated requests

### Critical Gaps
1. **No protocol** for executing delegation
2. **No response aggregation** implementation
3. **No delegation tracking** across hops
4. **No timeout management** for delegated calls
5. **No circuit breaking** for delegation paths

## Design Principles

1. **Keep It Simple**: Direct function calls when possible
2. **Type Safety**: Preserve TypeScript types across boundaries
3. **Performance First**: Minimize overhead
4. **Observable**: Full tracing of delegation chains
5. **Resilient**: Handle failures gracefully

## Inter-Librarian Communication Protocol

### 1. Direct In-Process Communication (Preferred)

When librarians are in the same process:

```typescript
interface InProcessDelegation {
  // Direct function call with delegation context
  async execute(
    targetId: string,
    query: string,
    context: DelegationContext
  ): Promise<Response>;
}

interface DelegationContext extends Context {
  // Original query for reference
  originalQuery: string;

  // Chain tracking
  delegationChain: string[];
  delegationDepth: number;

  // Timeout management
  remainingTimeout: number;
  startTime: number;

  // Tracing
  parentSpanId: string;

  // Delegation metadata
  delegationReason?: string;
  refinedBy?: string;
}
```

### 2. Cross-Process Communication (When Needed)

For distributed librarians:

```typescript
interface RemoteDelegation {
  // HTTP-based delegation with automatic retries
  async execute(
    endpoint: string,
    request: DelegationRequest,
    options: DelegationOptions
  ): Promise<Response>;
}

interface DelegationRequest {
  // Core fields
  query: string;
  context: DelegationContext;

  // Protocol version
  version: '1.0';

  // Request metadata
  requestId: string;
  timestamp: number;
}

interface DelegationOptions {
  timeout: number;
  retries: number;
  circuitBreakerConfig?: CircuitBreakerConfig;
}
```

## Execution Flow

### 1. Delegation Decision
```typescript
// In librarian implementation
if (needsExpertise && context.availableDelegates) {
  return {
    delegate: {
      to: 'expert-librarian',
      query: refinedQuery,
      context: { reason: 'Complex domain query' }
    }
  };
}
```

### 2. Delegation Execution
```typescript
class DelegationExecutor {
  async executeDelegation(
    response: Response,
    context: Context
  ): Promise<Response> {
    if (!response.delegate) {
      return response;
    }

    // Single delegation
    if (!Array.isArray(response.delegate)) {
      return this.executeSingle(response.delegate, context);
    }

    // Multiple delegations (parallel)
    return this.executeMultiple(response.delegate, context);
  }

  private async executeSingle(
    delegate: DelegateRequest,
    context: Context
  ): Promise<Response> {
    // Check delegation depth
    if (context.delegationDepth >= MAX_DEPTH) {
      return errorResponse('MAX_DEPTH_EXCEEDED');
    }

    // Check for loops
    if (context.delegationChain?.includes(delegate.to)) {
      return errorResponse('LOOP_DETECTED');
    }

    // Create delegation context
    const delegationContext: DelegationContext = {
      ...context,
      originalQuery: context.originalQuery || query,
      delegationChain: [...(context.delegationChain || []), currentId],
      delegationDepth: (context.delegationDepth || 0) + 1,
      remainingTimeout: calculateRemainingTimeout(context),
      parentSpanId: getCurrentSpanId()
    };

    // Execute based on location
    if (this.isLocal(delegate.to)) {
      return this.executeLocal(delegate, delegationContext);
    } else {
      return this.executeRemote(delegate, delegationContext);
    }
  }
}
```

### 3. Response Aggregation
```typescript
class ResponseAggregator {
  async aggregate(
    responses: Response[],
    strategy: AggregationStrategy
  ): Promise<Response> {
    switch (strategy) {
      case 'first-success':
        return this.firstSuccess(responses);

      case 'best-confidence':
        return this.bestConfidence(responses);

      case 'merge-all':
        return this.mergeAll(responses);

      case 'ai-blend':
        return this.aiBlend(responses);

      default:
        return this.defaultMerge(responses);
    }
  }

  private mergeAll(responses: Response[]): Response {
    // Combine all successful responses
    const successful = responses.filter(r => !r.error);

    if (successful.length === 0) {
      return responses[0]; // Return first error
    }

    return {
      answer: this.combineAnswers(successful),
      sources: this.mergeSources(successful),
      confidence: this.averageConfidence(successful),
      metadata: {
        aggregated: true,
        responseCount: successful.length,
        strategy: 'merge-all'
      }
    };
  }
}
```

## Implementation Requirements

### 1. Delegation Loop Prevention
```typescript
const MAX_DELEGATION_DEPTH = 5;
const MAX_DELEGATION_CHAIN = 10;

function validateDelegation(
  delegate: DelegateRequest,
  context: Context
): ValidationResult {
  // Check depth
  if ((context.delegationDepth || 0) >= MAX_DELEGATION_DEPTH) {
    return { valid: false, reason: 'Maximum delegation depth exceeded' };
  }

  // Check chain length
  if ((context.delegationChain?.length || 0) >= MAX_DELEGATION_CHAIN) {
    return { valid: false, reason: 'Delegation chain too long' };
  }

  // Check for loops
  if (context.delegationChain?.includes(delegate.to)) {
    return { valid: false, reason: 'Delegation loop detected' };
  }

  return { valid: true };
}
```

### 2. Timeout Management
```typescript
function calculateRemainingTimeout(context: Context): number {
  const totalTimeout = context.timeout || DEFAULT_TIMEOUT;
  const elapsed = Date.now() - context.startTime;
  const remaining = totalTimeout - elapsed;

  // Reserve time for response
  const responseBuffer = 500; // 500ms

  return Math.max(remaining - responseBuffer, MIN_DELEGATION_TIMEOUT);
}

function createDelegationTimeout(timeout: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeout);
  return controller.signal;
}
```

### 3. Circuit Breaking for Delegations
```typescript
class DelegationCircuitBreaker {
  private breakers = new Map<string, CircuitBreaker>();

  async executeWithBreaker(
    targetId: string,
    operation: () => Promise<Response>
  ): Promise<Response> {
    const breaker = this.getBreaker(targetId);

    try {
      return await breaker.execute(operation);
    } catch (error) {
      if (error.code === 'CIRCUIT_OPEN') {
        return {
          error: {
            code: 'DELEGATION_UNAVAILABLE',
            message: `${targetId} is temporarily unavailable`,
            recoverable: true,
            suggestion: 'Try again later or use alternative'
          }
        };
      }
      throw error;
    }
  }
}
```

### 4. Distributed Tracing
```typescript
function createDelegationSpan(
  delegate: DelegateRequest,
  context: DelegationContext
): Span {
  const span = tracer.startSpan('librarian.delegation', {
    parent: context.parentSpanId,
    attributes: {
      'delegation.to': delegate.to,
      'delegation.depth': context.delegationDepth,
      'delegation.chain': context.delegationChain.join(' -> '),
      'delegation.reason': delegate.context?.reason
    }
  });

  return span;
}
```

## Performance Optimizations

### 1. Delegation Caching
```typescript
interface DelegationCache {
  // Cache delegation decisions
  shouldDelegate(query: string, context: Context): boolean | undefined;

  // Cache delegation results
  getCachedResponse(
    targetId: string,
    query: string
  ): Response | undefined;
}
```

### 2. Parallel Execution
```typescript
async function executeParallelDelegations(
  delegates: DelegateRequest[],
  context: Context
): Promise<Response[]> {
  // Create tasks with individual timeouts
  const tasks = delegates.map(delegate =>
    withTimeout(
      this.executeSingle(delegate, context),
      calculateDelegationTimeout(delegate, context)
    )
  );

  // Execute in parallel
  const results = await Promise.allSettled(tasks);

  // Convert to responses
  return results.map(result =>
    result.status === 'fulfilled'
      ? result.value
      : errorResponse('DELEGATION_FAILED', result.reason)
  );
}
```

### 3. Smart Routing
```typescript
interface SmartRouter {
  // Route to the best librarian based on historical performance
  selectOptimalTarget(
    candidates: string[],
    query: string
  ): string;

  // Get fallback options
  getFallbacks(primary: string): string[];
}
```

## Testing Strategy

### Unit Tests
```typescript
describe('DelegationExecutor', () => {
  it('prevents delegation loops', async () => {
    const context = {
      delegationChain: ['a', 'b', 'c'],
      delegationDepth: 3
    };

    const response = await executor.executeDelegation(
      { delegate: { to: 'b' } }, // Loop!
      context
    );

    expect(response.error?.code).toBe('LOOP_DETECTED');
  });

  it('respects timeout constraints', async () => {
    const context = {
      timeout: 1000,
      startTime: Date.now() - 800 // 200ms remaining
    };

    // Should timeout
    const response = await executor.executeDelegation(
      { delegate: { to: 'slow-librarian' } },
      context
    );

    expect(response.error?.code).toBe('TIMEOUT');
  });
});
```

### Integration Tests
```typescript
describe('Inter-Librarian Communication', () => {
  it('handles multi-hop delegation', async () => {
    // A delegates to B, B delegates to C
    const response = await router.route(
      'complex query requiring multiple hops',
      'librarian-a'
    );

    expect(response.answer).toBeDefined();
    expect(response.metadata?.delegationPath).toEqual(['a', 'b', 'c']);
  });
});
```

## Migration Path

### Phase 1: Local Delegation (Week 1)
- Implement in-process delegation execution
- Add delegation loop prevention
- Add timeout management

### Phase 2: Remote Delegation (Week 2)
- Add HTTP-based delegation
- Implement circuit breakers
- Add distributed tracing

### Phase 3: Advanced Features (Week 3)
- Response aggregation strategies
- Delegation caching
- Performance optimizations

## Summary

This specification provides a simple, performant, and reliable way for librarians to communicate:

1. **In-process calls** for co-located librarians (fast)
2. **HTTP calls** for distributed librarians (flexible)
3. **Built-in resilience** with timeouts and circuit breakers
4. **Full observability** with distributed tracing
5. **Type safety** preserved across boundaries

The design avoids the complexity of protocols like A2A while providing all necessary features for Constellation's use case.
