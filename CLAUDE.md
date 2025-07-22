# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT: Start Here

**ALWAYS read `AGENT_INSTRUCTIONS.md` first before doing any work in this repository.** It contains the authoritative mission, implementation details, and success criteria for the Constellation project. This CLAUDE.md file supplements those instructions with additional guidelines for working effectively in this codebase.

## Project Overview

Constellation is a distributed AI-powered knowledge orchestration framework that enables teams to create AI-powered "librarians" providing intelligent access to enterprise data. The core principle: teams write simple async functions, the framework handles everything else.

## Mission & Success Criteria

Build a system where:
- Teams write simple async functions to create librarians
- AI automatically routes queries to appropriate librarians
- System handles failures gracefully with circuit breakers
- Full observability with distributed tracing
- Performance meets SLA (<2s response time at p99, 1000 QPS)
- All tests pass

## Git Commit Guidelines

**IMPORTANT**: Always follow these commit practices:

1. **Use atomic commits** - Each commit should represent one logical change
2. **Commit early and often** - Don't wait until everything is perfect
3. **Use conventional commits** format:
   ```
   type(scope): description
   
   [optional body]
   
   [optional footer]
   ```
   Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

4. **Sign off commits** with:
   ```
   Assisted-by: Claude Code <claude@anthropic.com>
   ```

5. **Set up pre-commit hooks** (if not already configured):
   ```bash
   # Install pre-commit
   npm install --save-dev pre-commit husky lint-staged
   
   # Configure hooks for:
   # - ESLint (npm run lint)
   # - Prettier (npm run format)
   # - TypeScript checking (npm run typecheck)
   # - Tests (npm test)
   ```

## Essential Commands

```bash
# Development
npm run dev          # Run development server with hot reload
npm run build        # Compile TypeScript
npm start           # Run production build

# Testing
npm test            # Run Jest tests
npm run test:watch  # Run tests in watch mode
npm run test:coverage # Generate coverage report

# Code Quality
npm run lint        # ESLint checking
npm run format      # Prettier formatting
npm run typecheck   # TypeScript type checking

# Docker
npm run docker:build # Build container
npm run docker:run   # Run container

# Git workflow
git add -p          # Stage changes interactively for atomic commits
git commit -m "type(scope): description" -m "" -m "Assisted-by: Claude Code <claude@anthropic.com>"
```

## Architecture

### Core Components
- **Librarians**: Simple async functions that answer queries
- **Query Gateway**: Entry point with auth, rate limiting, tracing
- **AI Delegation Engine**: Routes queries to appropriate librarians using AI
- **Service Registry**: YAML-based dynamic discovery
- **Response Aggregator**: Merges responses from multiple librarians

### Key Interfaces
- `LibrarianFunction`: Basic function signature `(query: Query, context: Context) => Promise<Response>`
- `Query`: Contains `text` (user question) and `metadata` (user ID, tags)
- `Context`: Provides `ai` (LiteLLM), `trace`, `delegate`, and `cache`
- `Response`: Contains `content`, `confidence`, `metadata`, and `sources`

### Project Structure
```
/interfaces/        # TypeScript interfaces and types
/registry/         # Service registry implementation
/specs/           # OpenAPI and interface specifications
/examples/        # Example librarian implementations
```

## Implementation Order (6 Phases)

### Phase 1: Core Foundation
**Goal**: Basic librarian execution
- Read: `ARCHITECTURE.md`, `interfaces/librarian.ts`, `examples/simple-librarian/index.ts`
- Implement: `src/types/`, `src/core/executor.ts`, `src/core/router.ts`, `src/server/app.ts`
- Test: Simple librarian responds to HTTP POST `/query`

### Phase 2: AI Integration
**Goal**: Intelligent query analysis and routing
- Read: `specs/02-ai-delegation.md`
- Implement: `src/ai/` (client interface, OpenAI/Anthropic implementations)
- Test: Librarians can use AI to generate answers

### Phase 3: Service Registry
**Goal**: Dynamic librarian discovery
- Read: `registry/schema.yaml`, `registry/example-registry.yaml`
- Implement: `src/registry/` (loader, validator, dynamic loader)
- Test: System discovers librarians from registry

### Phase 4: Delegation Engine
**Goal**: Intelligent routing between librarians
- Read: `interfaces/delegation.ts`
- Implement: `src/delegation/` (engine, handler, aggregator)
- Test: Complex queries route to multiple experts

### Phase 5: Observability
**Goal**: Tracing, metrics, and logging
- Read: `interfaces/observability.ts`
- Implement: `src/observability/` (tracer, metrics, logger)
- Test: Every request is traced end-to-end

### Phase 6: Resilience
**Goal**: Handle failures gracefully
- Read: `specs/05-resilience.md`
- Implement: `src/resilience/` (circuit breaker, retry, fallback)
- Test: System remains available during failures

## Development Guidelines

### Core Patterns
1. **Always return Response objects** - Never throw from librarians
   ```typescript
   export const myLibrarian: Librarian = async (query, context) => {
     try {
       return { answer: "..." };
     } catch (error) {
       return { error: { code: "ERROR", message: error.message } };
     }
   };
   ```

2. **Use Context for everything**
   ```typescript
   const answer = await context.ai.complete(prompt);
   context.trace.addEvent('data_fetched');
   ```

3. **Delegate when uncertain**
   ```typescript
   if (confidence < 0.6 && context.availableDelegates) {
     return { delegate: { to: 'expert-librarian' } };
   }
   ```

4. **Respect timeouts**
   ```typescript
   const timeout = context.timeout || 5000;
   return Promise.race([operation(), timeoutPromise(timeout)]);
   ```

5. **Prevent delegation loops**
   ```typescript
   if (context.delegationChain?.includes(targetLibrarian)) {
     return { error: { code: 'LOOP_DETECTED' } };
   }
   ```

### Common Pitfalls
- Don't block the event loop (use async/await)
- Don't mutate context objects
- Don't ignore timeouts
- Don't create delegation loops

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

### Testing Requirements
- Unit tests: Each module in isolation
- Integration tests: Full delegation flows, registry loading, AI integration
- End-to-end tests: Complete query flows, multi-librarian scenarios
- Performance tests: <2s response time at p99, handle 1000 QPS