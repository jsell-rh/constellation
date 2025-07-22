# Constellation Project Notes

## Project Overview
Constellation is a distributed AI-powered knowledge orchestration framework that enables teams to create AI-powered "librarians" providing intelligent access to enterprise data. Teams write simple async functions, the framework handles everything else.

## Key Technical Decisions

### 1. **LLM Integration**
- **Choice**: LangChain (TypeScript)
- **Reason**: Native support for Gemini Vertex AI and other providers needed by Red Hat
- **Providers**: OpenAI, Anthropic, Vertex AI, Azure OpenAI

### 2. **Cache/State Management**
- **Choice**: Valkey (Redis fork)
- **Reason**: Open-source with good licensing, Redis-compatible

### 3. **Authentication**
- **Primary**: Keycloak OIDC (Red Hat internal standard)
- **Secondary**: Bearer tokens for testing/development
- **Approach**: Dual auth system with middleware

### 4. **Configuration Management**
- **Choice**: Convict
- **Reason**: Schema validation, env var mapping, TypeScript support
- **Sources**: Environment variables + YAML config files

### 5. **Service Discovery**
- **Approach**: Startup-time discovery from YAML registry
- **Workflow**: Users submit MR → Merged → New build deployed

### 6. **Error Handling**
- **Compile-time**: TypeScript types enforce Response return (no throws)
- **Runtime**: Framework catches any errors and converts to Response
- **Remote librarians**: Best-effort normalization with validation

### 7. **Testing Strategy**
- **Approach**: Test-Driven Development (TDD)
- **Framework**: Jest with full coverage
- **Structure**: Separate test directory (`/tests/unit/`, `/tests/integration/`, `/tests/e2e/`)

### 8. **Performance**
- **Benchmarking**: From day 1 using autocannon
- **Note**: LLM latency will impact <2s SLA target
- **Strategy**: Aggressive caching, parallel operations

## Implementation Roadmap

### Phase 1: Core Foundation (Days 1-3)
#### 1.1 Project Setup
- [x] Initialize TypeScript with strict settings
- [ ] Configure Convict for configuration management
- [ ] Set up Jest with coverage reporting
- [ ] Configure ESLint and Prettier
- [ ] Set up autocannon for benchmarking
- [ ] Create npm scripts for all operations

#### 1.2 Type-Safe Librarian System
- [ ] Create strict TypeScript interfaces
- [ ] Implement `createLibrarian` wrapper for compile-time safety
- [ ] Build Context interface with all required properties
- [ ] Create Response types with validation

#### 1.3 Core Executor
- [ ] Implement LibrarianExecutor with error boundary
- [ ] Add trace context generation
- [ ] Implement response validation
- [ ] Create error-to-response conversion

#### 1.4 Router Implementation
- [ ] Create SimpleRouter for librarian registration
- [ ] Implement route resolution
- [ ] Add librarian metadata management

#### 1.5 HTTP Server
- [ ] Express server with middleware setup
- [ ] Health check endpoints
- [ ] Query endpoint with validation
- [ ] Error handling middleware

### Phase 2: AI Integration (Days 4-5)
#### 2.1 LangChain Setup
- [ ] Configure LangChain with multiple providers
- [ ] Create provider configuration schema
- [ ] Implement provider selection logic
- [ ] Add retry and timeout handling

#### 2.2 AI-Powered Librarians
- [ ] Create example AI librarians
- [ ] Implement prompt templates
- [ ] Add streaming support
- [ ] Token usage tracking

### Phase 3: Service Registry (Days 6-7)
#### 3.1 YAML Registry
- [ ] Create registry schema with JSON Schema
- [ ] Implement YAML loader with validation
- [ ] Add capability indexing
- [ ] Startup discovery mechanism

#### 3.2 Dynamic Loading
- [ ] Remote librarian proxy implementation
- [ ] Response validation (strict local, lenient remote)
- [ ] Health checking for remote librarians

### Phase 4: Delegation Engine (Days 8-9)
#### 4.1 AI Routing
- [ ] Query analysis with LangChain
- [ ] Capability matching algorithm
- [ ] Delegation decision logic
- [ ] Loop detection

#### 4.2 Response Aggregation
- [ ] Parallel delegation execution
- [ ] AI-powered response merging
- [ ] Partial response assembly
- [ ] Source deduplication

### Phase 5: Observability (Days 10-11)
#### 5.1 Tracing
- [ ] OpenTelemetry integration
- [ ] Distributed trace context
- [ ] Span management
- [ ] Trace export configuration

#### 5.2 Metrics
- [ ] Prometheus metrics setup
- [ ] Request/response metrics
- [ ] LLM usage metrics
- [ ] Custom business metrics

### Phase 6: Resilience (Days 12-13)
#### 6.1 Circuit Breakers
- [ ] Circuit breaker implementation
- [ ] Configurable thresholds
- [ ] State management
- [ ] Fallback strategies

#### 6.2 Retry & Timeouts
- [ ] Exponential backoff
- [ ] Jitter implementation
- [ ] Adaptive timeouts
- [ ] Bulkhead isolation

### Phase 7: Authentication (Days 14-15)
#### 7.1 Auth Middleware
- [ ] Bearer token validation
- [ ] Keycloak OIDC integration
- [ ] Role-based access control
- [ ] Auth caching

## Architecture Patterns

### 1. **Librarian Safety Pattern**
```typescript
// Ensures compile-time safety
export function createLibrarian(
  fn: (query: string, context?: Context) => Promise<Response>
): Librarian {
  return async (query, context) => {
    try {
      return await fn(query, context);
    } catch (error) {
      return {
        error: {
          code: 'UNEXPECTED_ERROR',
          message: 'Librarian implementation error',
          details: error
        }
      };
    }
  };
}
```

### 2. **Response Validation Pattern**
- Local librarians: Strict validation, fail fast
- Remote librarians: Best-effort normalization
- Always return valid Response object

### 3. **Configuration Pattern**
```typescript
// Convict schema example
const config = convict({
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 3000,
    env: 'PORT'
  },
  ai: {
    provider: {
      doc: 'LLM provider',
      format: ['openai', 'anthropic', 'vertex-ai'],
      default: 'openai',
      env: 'AI_PROVIDER'
    }
  }
});
```

## Testing Guidelines

1. **TDD Approach**
   - Write test first
   - Implement minimal code to pass
   - Refactor with confidence

2. **Test Structure**
   ```
   /tests/
     /unit/         # Isolated component tests
     /integration/  # Multi-component tests
     /e2e/         # Full system tests
     /fixtures/    # Test data
     /helpers/     # Test utilities
   ```

3. **Coverage Requirements**
   - Minimum 80% code coverage
   - 100% coverage for critical paths
   - Branch coverage for error handling

## Performance Considerations

1. **Benchmarking Setup**
   - Use autocannon for HTTP benchmarking
   - Custom metrics for LLM latency
   - Memory usage profiling

2. **Optimization Strategies**
   - Response caching with Valkey
   - Parallel librarian execution
   - Connection pooling
   - Streaming responses

## Security Considerations

1. **Authentication**
   - Keycloak for enterprise SSO
   - JWT validation
   - Rate limiting per user

2. **Authorization**
   - Role-based librarian access
   - Query filtering based on user context
   - Audit logging

3. **Data Protection**
   - No PII in logs
   - Encrypted cache storage
   - Secure configuration management

## Development Workflow

1. **Branch Strategy**
   - Feature branches from main
   - PR review required
   - CI/CD validation

2. **Commit Convention**
   ```
   feat(scope): add new feature
   fix(scope): fix bug
   test(scope): add tests
   docs(scope): update documentation
   refactor(scope): refactor code
   chore(scope): maintenance tasks
   ```

3. **Code Style**
   - ESLint with strict rules
   - Prettier for formatting
   - TypeScript strict mode
   - No any types without justification

## Deployment Notes

1. **Container Strategy**
   - Multi-stage Docker build
   - Non-root user
   - Health check included

2. **Kubernetes Deployment**
   - ConfigMaps for configuration
   - Secrets for sensitive data
   - Horizontal pod autoscaling
   - Service mesh ready

## Open Questions / Future Considerations

1. **Multi-tenancy**: How to isolate librarians per team/tenant?
2. **Versioning**: How to handle librarian API versioning?
3. **Monitoring**: Which APM tool to integrate?
4. **Data Sources**: How to standardize data source connections?
5. **Testing in Production**: Canary deployment strategy?

## Next Steps

1. Set up project foundation with all tooling
2. Implement Phase 1 with full test coverage
3. Create first working librarian
4. Benchmark baseline performance
5. Iterate based on learnings

---

Last Updated: 2025-07-22