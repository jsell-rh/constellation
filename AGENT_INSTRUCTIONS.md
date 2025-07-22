# Instructions for Autonomous Coding Agents

## Your Mission

Build Constellation - a system that enables teams to create AI-powered "librarians" that provide intelligent access to enterprise data. Teams write simple functions, the framework handles everything else.

## Success Criteria

- [ ] Teams can write a simple async function to create a librarian
- [ ] AI automatically routes queries to the right librarians
- [ ] System handles failures gracefully with circuit breakers
- [ ] Full observability with distributed tracing
- [ ] Performance meets SLA (<2s response time)
- [ ] All tests pass

## Implementation Order

### Phase 1: Core Foundation (Start Here)
**Goal**: Get basic librarian execution working

1. **Read First**:
   - `ARCHITECTURE.md` - Understand the system
   - `interfaces/librarian.ts` - Core contracts
   - `examples/simple-librarian/index.ts` - Basic example

2. **Implement**:
   ```
   src/
   ├── types/           # Copy interfaces here
   ├── core/
   │   ├── executor.ts  # Executes librarians
   │   └── router.ts    # Routes queries
   └── server/
       └── app.ts       # HTTP server
   ```

3. **Test**: Simple librarian should respond to HTTP POST `/query`

### Phase 2: AI Integration
**Goal**: Add intelligent query analysis and routing

1. **Read**: `specs/02-ai-delegation.md`

2. **Implement**:
   ```
   src/ai/
   ├── client.ts        # AI client interface
   ├── openai-client.ts # OpenAI implementation
   └── anthropic-client.ts # Anthropic implementation
   ```

3. **Test**: Librarians can use AI to generate answers

### Phase 3: Service Registry
**Goal**: Dynamic librarian discovery

1. **Read**: 
   - `registry/schema.yaml` - Registry structure
   - `registry/example-registry.yaml` - Examples

2. **Implement**:
   ```
   src/registry/
   ├── loader.ts        # Load YAML registry
   ├── validator.ts     # Validate entries
   └── dynamic-loader.ts # Load remote librarians
   ```

3. **Test**: System discovers librarians from registry

### Phase 4: Delegation Engine
**Goal**: Enable intelligent routing between librarians

1. **Read**: `interfaces/delegation.ts`

2. **Implement**:
   ```
   src/delegation/
   ├── engine.ts        # AI delegation logic
   ├── handler.ts       # Execute delegations
   └── aggregator.ts    # Merge responses
   ```

3. **Test**: Complex queries route to multiple experts

### Phase 5: Observability
**Goal**: Add tracing, metrics, and logging

1. **Read**: `interfaces/observability.ts`

2. **Implement**:
   ```
   src/observability/
   ├── tracer.ts        # Distributed tracing
   ├── metrics.ts       # Prometheus metrics
   └── logger.ts        # Structured logging
   ```

3. **Test**: Every request is traced end-to-end

### Phase 6: Resilience
**Goal**: Handle failures gracefully

1. **Read**: `specs/05-resilience.md` (when available)

2. **Implement**:
   ```
   src/resilience/
   ├── circuit-breaker.ts # Prevent cascades
   ├── retry.ts          # Smart retries
   └── fallback.ts       # Fallback strategies
   ```

3. **Test**: System remains available during failures

## Key Implementation Details

### Environment Variables
```bash
# Required
AI_PROVIDER=openai          # or anthropic
OPENAI_API_KEY=sk-...       # or ANTHROPIC_API_KEY
REDIS_URL=redis://localhost:6379

# Optional
PORT=3000
LOG_LEVEL=info
METRICS_PORT=9090
TRACE_ENDPOINT=http://jaeger:14268/api/traces
```

### Core Patterns

#### 1. Always Return a Response
```typescript
// Never throw from a librarian
export const myLibrarian: Librarian = async (query, context) => {
  try {
    return { answer: "..." };
  } catch (error) {
    return { error: { code: "ERROR", message: error.message } };
  }
};
```

#### 2. Use Context for Everything
```typescript
// Context provides AI, tracing, and more
const answer = await context.ai.complete(prompt);
context.trace.addEvent('data_fetched');
```

#### 3. Delegate When Uncertain
```typescript
if (confidence < 0.6 && context.availableDelegates) {
  return { delegate: { to: 'expert-librarian' } };
}
```

## Testing Requirements

### Unit Tests
- Each module in isolation
- Mock external dependencies
- Test error cases

### Integration Tests
- Full delegation flows
- Registry loading
- AI integration

### End-to-End Tests
- Complete query flows
- Multi-librarian scenarios
- Error recovery

### Performance Tests
- Response time < 2s at p99
- Handle 1000 QPS
- Circuit breaker effectiveness

## Common Pitfalls to Avoid

1. **Don't Block the Event Loop**
   ```typescript
   // Bad
   const data = fs.readFileSync('large-file.json');
   
   // Good
   const data = await fs.promises.readFile('large-file.json');
   ```

2. **Don't Mutate Context**
   ```typescript
   // Bad
   context.metadata.processed = true;
   
   // Good
   const newContext = { ...context, metadata: { ...context.metadata, processed: true } };
   ```

3. **Don't Ignore Timeouts**
   ```typescript
   // Always respect timeouts
   const timeout = context.timeout || 5000;
   return Promise.race([operation(), timeoutPromise(timeout)]);
   ```

4. **Don't Create Delegation Loops**
   ```typescript
   // Always check delegation chain
   if (context.delegationChain?.includes(targetLibrarian)) {
     return { error: { code: 'LOOP_DETECTED' } };
   }
   ```

## Debugging Tips

1. **Enable Debug Logging**
   ```bash
   LOG_LEVEL=debug npm run dev
   ```

2. **Trace Specific Requests**
   ```bash
   curl -H "X-Trace-Id: debug-123" ...
   ```

3. **Check Metrics**
   ```bash
   curl http://localhost:9090/metrics
   ```

4. **Inspect Circuit Breaker State**
   ```bash
   curl http://localhost:3000/health/circuit-breakers
   ```

## Performance Optimization

1. **Cache Aggressively**
   - Cache AI responses
   - Cache registry lookups
   - Cache delegation decisions

2. **Parallelize Operations**
   ```typescript
   const [data1, data2, data3] = await Promise.all([
     fetchSource1(),
     fetchSource2(),
     fetchSource3()
   ]);
   ```

3. **Use Connection Pooling**
   - Redis connection pool
   - HTTP keep-alive
   - Database connection pools

## Security Considerations

1. **Validate All Inputs**
   - Sanitize queries
   - Validate registry entries
   - Check response sizes

2. **Implement Rate Limiting**
   - Per-user limits
   - Per-librarian limits
   - Global limits

3. **Use Least Privilege**
   - Librarians only access needed data
   - Minimal container permissions
   - Network segmentation

## Final Checklist

Before considering the implementation complete:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Performance meets SLA
- [ ] Security scan passes
- [ ] Documentation is complete
- [ ] Monitoring is configured
- [ ] Deployment works in Kubernetes
- [ ] Example librarians work end-to-end

## Questions?

If you encounter issues:

1. Check the specifications in `specs/`
2. Review the examples in `examples/`
3. Look at the interfaces in `interfaces/`
4. Read the architecture in `ARCHITECTURE.md`

Good luck building Constellation!