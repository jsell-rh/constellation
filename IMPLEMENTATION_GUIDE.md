# Constellation - Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing Constellation from scratch. Follow the phases in order, as each builds on the previous.

## Prerequisites

- Node.js 18+ and TypeScript 5+
- Docker and Kubernetes access
- AI API access (OpenAI, Anthropic, or similar)
- Redis for caching
- Basic understanding of distributed systems

## Phase 1: Core Foundation (Week 1)

### Step 1.1: Set Up Project Structure

```bash
# Initialize the project
npm init -y
npm install typescript @types/node tsx
npm install express @types/express
npm install redis ioredis @types/ioredis
npm install openai anthropic

# Create TypeScript config
npx tsc --init
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 1.2: Implement Core Interfaces

Create `src/types/core.ts`:

```typescript
// Core librarian function type
export type Librarian = (
  query: string,
  context?: Context
) => Promise<Response>;

// Context passed to librarians
export interface Context {
  // Identity
  librarian?: LibrarianInfo;
  user?: User;

  // Tracing
  trace?: TraceContext;
  delegationChain?: string[];

  // AI and delegation
  ai?: AIClient;
  availableDelegates?: Delegate[];

  // Metadata
  metadata?: Record<string, any>;
}

// Response from librarians
export interface Response {
  answer?: string;
  sources?: Source[];
  delegate?: DelegateRequest | DelegateRequest[];
  confidence?: number;
  error?: ErrorInfo;
  partial?: boolean;
}

// Other core types
export interface Source {
  name: string;
  url?: string;
  type?: string;
  relevance?: number;
}

export interface DelegateRequest {
  to: string;
  query?: string;
  context?: any;
}

export interface LibrarianInfo {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  endpoint?: string;
}
```

### Step 1.3: Create Basic Librarian Executor

Create `src/core/executor.ts`:

```typescript
import { Librarian, Context, Response } from '../types/core';

export class LibrarianExecutor {
  async execute(
    librarian: Librarian,
    query: string,
    context: Context = {}
  ): Promise<Response> {
    try {
      // Add execution context
      const enrichedContext: Context = {
        ...context,
        trace: context.trace || this.createTraceContext(),
      };

      // Execute the librarian
      const response = await librarian(query, enrichedContext);

      // Validate response
      this.validateResponse(response);

      return response;
    } catch (error) {
      return this.handleError(error, query, context);
    }
  }

  private createTraceContext() {
    return {
      traceId: this.generateId(),
      spanId: this.generateId(),
      startTime: Date.now()
    };
  }

  private validateResponse(response: Response): void {
    if (!response.answer && !response.delegate && !response.error) {
      throw new Error('Response must include answer, delegate, or error');
    }
  }

  private handleError(error: any, query: string, context: Context): Response {
    return {
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        librarian: context.librarian?.id,
        query
      }
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
```

### Step 1.4: Implement Simple Router

Create `src/core/router.ts`:

```typescript
import { Librarian, Context, Response } from '../types/core';
import { LibrarianExecutor } from './executor';

export class SimpleRouter {
  private librarians = new Map<string, Librarian>();
  private executor = new LibrarianExecutor();

  register(id: string, librarian: Librarian): void {
    this.librarians.set(id, librarian);
  }

  async route(
    query: string,
    targetId: string,
    context: Context = {}
  ): Promise<Response> {
    const librarian = this.librarians.get(targetId);

    if (!librarian) {
      return {
        error: {
          code: 'LIBRARIAN_NOT_FOUND',
          message: `Librarian ${targetId} not found`
        }
      };
    }

    return this.executor.execute(librarian, query, {
      ...context,
      librarian: { id: targetId } as any
    });
  }
}
```

### Step 1.5: Create HTTP Server

Create `src/server/app.ts`:

```typescript
import express from 'express';
import { SimpleRouter } from '../core/router';

export function createApp(router: SimpleRouter) {
  const app = express();

  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date() });
  });

  // Query endpoint
  app.post('/query', async (req, res) => {
    const { query, librarian } = req.body;

    if (!query || !librarian) {
      return res.status(400).json({
        error: 'Missing required fields: query, librarian'
      });
    }

    try {
      const response = await router.route(query, librarian);
      res.json(response);
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  });

  return app;
}
```

### Step 1.6: Create First Librarian

Create `src/librarians/hello-world.ts`:

```typescript
import { Librarian } from '../types/core';

export const helloWorldLibrarian: Librarian = async (query, context) => {
  // Simple pattern matching
  if (query.toLowerCase().includes('hello')) {
    return {
      answer: 'Hello! I am a simple librarian. How can I help you?',
      confidence: 1.0
    };
  }

  return {
    answer: `I received your query: "${query}" but I'm just a hello world example.`,
    confidence: 0.5
  };
};
```

### Step 1.7: Wire Everything Together

Create `src/index.ts`:

```typescript
import { createApp } from './server/app';
import { SimpleRouter } from './core/router';
import { helloWorldLibrarian } from './librarians/hello-world';

async function main() {
  // Create router
  const router = new SimpleRouter();

  // Register librarians
  router.register('hello-world', helloWorldLibrarian);

  // Create and start server
  const app = createApp(router);
  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log(`Constellation running on port ${port}`);
  });
}

main().catch(console.error);
```

### Step 1.8: Test Basic Functionality

```bash
# Start the server
npm run dev

# Test hello world librarian
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "hello", "librarian": "hello-world"}'

# Expected response:
# {"answer": "Hello! I am a simple librarian. How can I help you?", "confidence": 1}
```

## Phase 2: AI Integration (Week 2)

### Step 2.1: Create AI Client Interface

Create `src/ai/client.ts`:

```typescript
export interface AIClient {
  complete(prompt: string, options?: AIOptions): Promise<string>;
  analyze(text: string, schema: any): Promise<any>;
}

export interface AIOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// Factory for different AI providers
export function createAIClient(provider: string): AIClient {
  switch (provider) {
    case 'openai':
      return new OpenAIClient();
    case 'anthropic':
      return new AnthropicClient();
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}
```

### Step 2.2: Implement OpenAI Client

Create `src/ai/openai-client.ts`:

```typescript
import OpenAI from 'openai';
import { AIClient, AIOptions } from './client';

export class OpenAIClient implements AIClient {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async complete(prompt: string, options: AIOptions = {}): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: options.model || 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 500
    });

    return completion.choices[0].message.content || '';
  }

  async analyze(text: string, schema: any): Promise<any> {
    const prompt = `Analyze the following text and respond with JSON matching this schema:
    ${JSON.stringify(schema, null, 2)}

    Text: ${text}`;

    const response = await this.complete(prompt, {
      temperature: 0.3 // Lower temperature for structured output
    });

    return JSON.parse(response);
  }
}
```

### Step 2.3: Create AI-Powered Librarian

Create `src/librarians/platform-librarian.ts`:

```typescript
import { Librarian } from '../types/core';

// Mock data source
async function searchPlatformDocs(query: string) {
  // In real implementation, this would search actual documentation
  return {
    results: [
      {
        title: 'Kubernetes Deployment Guide',
        content: 'To deploy on Kubernetes, use kubectl apply...',
        url: 'https://docs.platform.com/k8s'
      }
    ]
  };
}

export const platformLibrarian: Librarian = async (query, context) => {
  // Search relevant documentation
  const docs = await searchPlatformDocs(query);

  // Use AI to generate answer
  if (context?.ai) {
    const prompt = `You are a platform engineering expert. Answer this question: ${query}

    Using this documentation:
    ${JSON.stringify(docs.results, null, 2)}

    Provide a helpful, specific answer.`;

    const answer = await context.ai.complete(prompt);

    return {
      answer,
      sources: docs.results.map(r => ({
        name: r.title,
        url: r.url
      })),
      confidence: 0.85
    };
  }

  // Fallback without AI
  return {
    answer: 'Platform documentation found. Please see sources.',
    sources: docs.results.map(r => ({
      name: r.title,
      url: r.url
    }))
  };
};
```

### Step 2.4: Add AI to Context

Update `src/core/executor.ts`:

```typescript
import { createAIClient } from '../ai/client';

export class LibrarianExecutor {
  private aiClient = createAIClient(process.env.AI_PROVIDER || 'openai');

  async execute(
    librarian: Librarian,
    query: string,
    context: Context = {}
  ): Promise<Response> {
    try {
      // Add AI to context
      const enrichedContext: Context = {
        ...context,
        ai: this.aiClient,
        trace: context.trace || this.createTraceContext(),
      };

      // Rest of implementation...
    }
  }
}
```

## Phase 3: Delegation Engine (Week 3)

### Step 3.1: Create Delegation Handler

Create `src/delegation/handler.ts`:

```typescript
import { Response, DelegateRequest, Context } from '../types/core';
import { SimpleRouter } from '../core/router';

export class DelegationHandler {
  constructor(private router: SimpleRouter) {}

  async handleDelegation(
    response: Response,
    originalQuery: string,
    context: Context
  ): Promise<Response> {
    if (!response.delegate) {
      return response;
    }

    // Handle single or multiple delegations
    const delegates = Array.isArray(response.delegate)
      ? response.delegate
      : [response.delegate];

    // Check for loops
    if (this.detectLoop(delegates, context)) {
      return {
        error: {
          code: 'DELEGATION_LOOP',
          message: 'Circular delegation detected'
        }
      };
    }

    // Execute delegations in parallel
    const delegatedResponses = await Promise.all(
      delegates.map(del => this.executeDelegation(del, originalQuery, context))
    );

    // Merge responses
    return this.mergeResponses(response, delegatedResponses);
  }

  private async executeDelegation(
    delegate: DelegateRequest,
    originalQuery: string,
    context: Context
  ): Promise<Response> {
    const query = delegate.query || originalQuery;
    const newContext: Context = {
      ...context,
      ...delegate.context,
      delegationChain: [
        ...(context.delegationChain || []),
        context.librarian?.id || 'unknown'
      ]
    };

    return this.router.route(query, delegate.to, newContext);
  }

  private detectLoop(delegates: DelegateRequest[], context: Context): boolean {
    const chain = context.delegationChain || [];
    return delegates.some(del => chain.includes(del.to));
  }

  private mergeResponses(
    original: Response,
    delegated: Response[]
  ): Response {
    // Simple merge - in production, use AI for intelligent merging
    const allAnswers = delegated
      .filter(r => r.answer)
      .map(r => r.answer);

    const allSources = delegated
      .flatMap(r => r.sources || []);

    return {
      answer: allAnswers.join('\n\n'),
      sources: this.deduplicateSources(allSources),
      partial: delegated.some(r => r.partial),
      confidence: this.averageConfidence(delegated)
    };
  }

  private deduplicateSources(sources: Source[]): Source[] {
    const seen = new Set<string>();
    return sources.filter(s => {
      const key = s.url || s.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private averageConfidence(responses: Response[]): number {
    const confidences = responses
      .map(r => r.confidence)
      .filter(c => c !== undefined) as number[];

    if (confidences.length === 0) return 0.5;

    return confidences.reduce((a, b) => a + b, 0) / confidences.length;
  }
}
```

### Step 3.2: Create AI Delegation Engine

Create `src/delegation/ai-engine.ts`:

```typescript
import { Context, LibrarianInfo } from '../types/core';
import { AIClient } from '../ai/client';

export class AIDelegationEngine {
  constructor(private ai: AIClient) {}

  async analyzeQuery(
    query: string,
    availableLibrarians: LibrarianInfo[]
  ) {
    const schema = {
      intent: 'string',
      domains: ['string'],
      complexity: 'single|multi',
      suggestedLibrarians: [{
        id: 'string',
        relevance: 'number',
        reason: 'string'
      }]
    };

    const prompt = `Analyze this query and determine which librarians should handle it.

    Query: "${query}"

    Available librarians:
    ${availableLibrarians.map(lib =>
      `- ${lib.id}: ${lib.description} (capabilities: ${lib.capabilities.join(', ')})`
    ).join('\n')}

    Respond with JSON matching the provided schema.`;

    return this.ai.analyze(prompt, schema);
  }

  async shouldDelegate(
    query: string,
    currentCapabilities: string[],
    availableDelegates: LibrarianInfo[],
    currentConfidence: number
  ) {
    const prompt = `Should this query be delegated to a specialist?

    Query: "${query}"
    Current librarian capabilities: ${currentCapabilities.join(', ')}
    Current confidence: ${currentConfidence}

    Available specialists:
    ${availableDelegates.map(d =>
      `- ${d.name}: ${d.capabilities.join(', ')}`
    ).join('\n')}

    Consider:
    - Would a specialist provide significantly better answer?
    - Is the query outside current capabilities?
    - Would multiple perspectives help?

    Respond with: {
      shouldDelegate: boolean,
      reason: string,
      suggestedDelegates: string[]
    }`;

    return this.ai.analyze(prompt, {
      shouldDelegate: 'boolean',
      reason: 'string',
      suggestedDelegates: ['string']
    });
  }
}
```

## Phase 4: Service Registry (Week 4)

### Step 4.1: Define Registry Schema

Create `src/registry/schema.ts`:

```typescript
export interface RegistryEntry {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  team?: string;
  parent?: string;

  capabilities: string[];

  data_sources?: DataSource[];

  resilience?: {
    circuit_breaker?: CircuitBreakerConfig;
    fallback?: FallbackStrategy[];
  };

  sla?: {
    response_time_ms?: number;
    availability?: number;
  };
}

export interface DataSource {
  name: string;
  type: 'api' | 'database' | 'filesystem';
  config?: any;
}

export interface CircuitBreakerConfig {
  error_threshold_percent: number;
  volume_threshold: number;
  timeout_ms: number;
  reset_timeout_ms: number;
}

export interface FallbackStrategy {
  type: 'cache' | 'delegate' | 'static';
  config?: any;
}
```

### Step 4.2: Implement Registry Loader

Create `src/registry/loader.ts`:

```typescript
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { RegistryEntry } from './schema';

export class RegistryLoader {
  private entries = new Map<string, RegistryEntry>();

  async loadFromFile(filePath: string): Promise<void> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const data = yaml.load(content) as any;

    for (const entry of data.librarians) {
      this.validateEntry(entry);
      this.entries.set(entry.id, entry);
    }
  }

  getEntry(id: string): RegistryEntry | undefined {
    return this.entries.get(id);
  }

  getAllEntries(): RegistryEntry[] {
    return Array.from(this.entries.values());
  }

  findByCapability(capability: string): RegistryEntry[] {
    return this.getAllEntries().filter(entry =>
      entry.capabilities.some(cap =>
        cap.includes(capability) || capability.includes(cap)
      )
    );
  }

  private validateEntry(entry: any): void {
    if (!entry.id || !entry.name || !entry.endpoint) {
      throw new Error(`Invalid registry entry: ${JSON.stringify(entry)}`);
    }

    if (!Array.isArray(entry.capabilities)) {
      throw new Error(`Entry ${entry.id} must have capabilities array`);
    }
  }
}
```

### Step 4.3: Create Dynamic Librarian Loader

Create `src/registry/dynamic-loader.ts`:

```typescript
import { Librarian } from '../types/core';
import { RegistryEntry } from './schema';
import axios from 'axios';

export class DynamicLibrarianLoader {
  private cache = new Map<string, Librarian>();

  async loadLibrarian(entry: RegistryEntry): Promise<Librarian> {
    // Check cache
    if (this.cache.has(entry.id)) {
      return this.cache.get(entry.id)!;
    }

    // Create HTTP-based librarian proxy
    const librarian: Librarian = async (query, context) => {
      try {
        const response = await axios.post(entry.endpoint, {
          query,
          context: {
            ...context,
            // Don't send functions over HTTP
            ai: undefined
          }
        });

        return response.data;
      } catch (error) {
        return {
          error: {
            code: 'LIBRARIAN_UNAVAILABLE',
            message: `Failed to reach ${entry.name}: ${error.message}`
          }
        };
      }
    };

    // Add metadata
    Object.defineProperty(librarian, 'name', {
      value: entry.id,
      writable: false
    });

    this.cache.set(entry.id, librarian);
    return librarian;
  }
}
```

## Phase 5: Observability (Week 5)

### Step 5.1: Implement Tracing

Create `src/observability/tracer.ts`:

```typescript
export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, any>;
  events: SpanEvent[];
  status: 'OK' | 'ERROR';
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, any>;
}

export class Tracer {
  private spans = new Map<string, Span>();

  startSpan(
    operationName: string,
    parentContext?: { traceId: string; spanId: string }
  ): Span {
    const span: Span = {
      traceId: parentContext?.traceId || this.generateId(),
      spanId: this.generateId(),
      parentSpanId: parentContext?.spanId,
      operationName,
      startTime: Date.now(),
      attributes: {},
      events: [],
      status: 'OK'
    };

    this.spans.set(span.spanId, span);
    return span;
  }

  endSpan(spanId: string, status: 'OK' | 'ERROR' = 'OK'): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.endTime = Date.now();
      span.status = status;
      this.export(span);
    }
  }

  addEvent(spanId: string, name: string, attributes?: Record<string, any>): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.events.push({
        name,
        timestamp: Date.now(),
        attributes
      });
    }
  }

  setAttribute(spanId: string, key: string, value: any): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.attributes[key] = value;
    }
  }

  private export(span: Span): void {
    // In production, send to Jaeger or similar
    console.log('[TRACE]', JSON.stringify(span));
    this.spans.delete(span.spanId);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
```

### Step 5.2: Implement Metrics

Create `src/observability/metrics.ts`:

```typescript
export class Metrics {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();

  incrementCounter(name: string, labels: Record<string, string> = {}): void {
    const key = this.formatKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
  }

  recordHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    const key = this.formatKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
  }

  getMetrics(): string {
    const lines: string[] = [];

    // Export counters
    this.counters.forEach((value, key) => {
      lines.push(`${key} ${value}`);
    });

    // Export histograms
    this.histograms.forEach((values, key) => {
      const sorted = values.sort((a, b) => a - b);
      const p50 = this.percentile(sorted, 0.5);
      const p95 = this.percentile(sorted, 0.95);
      const p99 = this.percentile(sorted, 0.99);

      lines.push(`${key}{quantile="0.5"} ${p50}`);
      lines.push(`${key}{quantile="0.95"} ${p95}`);
      lines.push(`${key}{quantile="0.99"} ${p99}`);
    });

    return lines.join('\n');
  }

  private formatKey(name: string, labels: Record<string, string>): string {
    if (Object.keys(labels).length === 0) return name;

    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    return `${name}{${labelStr}}`;
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.floor(sorted.length * p);
    return sorted[index] || 0;
  }
}
```

### Step 5.3: Add Observability to Executor

Update `src/core/executor.ts`:

```typescript
import { Tracer } from '../observability/tracer';
import { Metrics } from '../observability/metrics';

export class LibrarianExecutor {
  private tracer = new Tracer();
  private metrics = new Metrics();

  async execute(
    librarian: Librarian,
    query: string,
    context: Context = {}
  ): Promise<Response> {
    const span = this.tracer.startSpan(
      `librarian.execute`,
      context.trace
    );

    this.tracer.setAttribute(span.spanId, 'librarian.id', context.librarian?.id);
    this.tracer.setAttribute(span.spanId, 'query.length', query.length);

    const startTime = Date.now();

    try {
      const response = await librarian(query, {
        ...context,
        trace: {
          traceId: span.traceId,
          spanId: span.spanId
        }
      });

      // Record success metrics
      this.metrics.incrementCounter('librarian_requests_total', {
        librarian: context.librarian?.id || 'unknown',
        status: 'success'
      });

      const duration = Date.now() - startTime;
      this.metrics.recordHistogram('librarian_request_duration_ms', duration, {
        librarian: context.librarian?.id || 'unknown'
      });

      this.tracer.endSpan(span.spanId, 'OK');
      return response;

    } catch (error) {
      // Record error metrics
      this.metrics.incrementCounter('librarian_requests_total', {
        librarian: context.librarian?.id || 'unknown',
        status: 'error'
      });

      this.tracer.addEvent(span.spanId, 'error', {
        message: error.message,
        code: error.code
      });

      this.tracer.endSpan(span.spanId, 'ERROR');
      throw error;
    }
  }
}
```

## Phase 6: Resilience (Week 6)

### Step 6.1: Implement Circuit Breaker

Create `src/resilience/circuit-breaker.ts`:

```typescript
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  errorThresholdPercentage: number;
  volumeThreshold: number;
  timeout: number;
  resetTimeout: number;
}

export class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: number;
  private halfOpenTests = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenTests = 0;
      } else {
        if (fallback) {
          return fallback();
        }
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await this.withTimeout(operation(), this.options.timeout);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      )
    ]);
  }

  private onSuccess(): void {
    this.failures = 0;
    this.successes++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenTests++;
      if (this.halfOpenTests >= 3) {
        this.state = CircuitState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      return;
    }

    const totalRequests = this.failures + this.successes;
    if (totalRequests >= this.options.volumeThreshold) {
      const errorRate = (this.failures / totalRequests) * 100;
      if (errorRate >= this.options.errorThresholdPercentage) {
        this.state = CircuitState.OPEN;
      }
    }
  }

  private shouldAttemptReset(): boolean {
    return this.lastFailureTime
      ? Date.now() - this.lastFailureTime >= this.options.resetTimeout
      : false;
  }

  getState(): CircuitState {
    return this.state;
  }
}
```

### Step 6.2: Implement Fallback Strategies

Create `src/resilience/fallback.ts`:

```typescript
import { Response } from '../types/core';

export interface FallbackStrategy {
  type: 'cache' | 'delegate' | 'static' | 'partial';
  config?: any;
}

export class FallbackHandler {
  private cache = new Map<string, { response: Response; timestamp: number }>();

  async executeFallback(
    strategy: FallbackStrategy,
    query: string,
    error: Error
  ): Promise<Response | null> {
    switch (strategy.type) {
      case 'cache':
        return this.cacheStrategy(query);

      case 'static':
        return this.staticStrategy(strategy.config);

      case 'partial':
        return this.partialStrategy(error);

      default:
        return null;
    }
  }

  cacheResponse(query: string, response: Response): void {
    this.cache.set(query, {
      response,
      timestamp: Date.now()
    });
  }

  private cacheStrategy(query: string): Response | null {
    const cached = this.cache.get(query);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      return {
        ...cached.response,
        partial: true,
        metadata: {
          ...cached.response.metadata,
          cached: true,
          cacheAge: age
        }
      };
    }
    return null;
  }

  private staticStrategy(config: any): Response {
    return {
      answer: config?.message || 'Service temporarily unavailable',
      partial: true,
      static: true
    };
  }

  private partialStrategy(error: Error): Response {
    return {
      answer: 'Unable to provide complete answer due to service issues.',
      partial: true,
      error: {
        code: 'PARTIAL_FAILURE',
        message: error.message
      }
    };
  }
}
```

## Phase 7: Inter-Librarian Communication (Week 7)

### Step 7.1: Implement Delegation Executor

Create `src/delegation/executor.ts`:

```typescript
import { Response, Context, DelegateRequest } from '../types/core';
import { LibrarianRegistry } from '../registry/registry';

export interface DelegationContext extends Context {
  originalQuery: string;
  delegationChain: string[];
  delegationDepth: number;
  remainingTimeout: number;
  startTime: number;
  parentSpanId?: string;
  delegationReason?: string;
}

const MAX_DELEGATION_DEPTH = 5;
const MAX_DELEGATION_CHAIN = 10;
const MIN_DELEGATION_TIMEOUT = 1000;

export class DelegationExecutor {
  constructor(
    private registry: LibrarianRegistry,
    private tracer?: any
  ) {}

  async executeDelegation(
    response: Response,
    context: Context
  ): Promise<Response> {
    if (!response.delegate) {
      return response;
    }

    // Handle single or multiple delegations
    if (!Array.isArray(response.delegate)) {
      return this.executeSingle(response.delegate, context);
    }

    return this.executeMultiple(response.delegate, context);
  }

  private async executeSingle(
    delegate: DelegateRequest,
    context: Context
  ): Promise<Response> {
    // Validate delegation
    const validation = this.validateDelegation(delegate, context);
    if (!validation.valid) {
      return {
        error: {
          code: 'DELEGATION_INVALID',
          message: validation.reason!
        }
      };
    }

    // Create delegation context
    const delegationContext: DelegationContext = {
      ...context,
      originalQuery: (context as DelegationContext).originalQuery || context.query || '',
      delegationChain: [
        ...((context as DelegationContext).delegationChain || []),
        context.librarian?.id || 'unknown'
      ],
      delegationDepth: ((context as DelegationContext).delegationDepth || 0) + 1,
      remainingTimeout: this.calculateRemainingTimeout(context),
      startTime: (context as DelegationContext).startTime || Date.now(),
      parentSpanId: this.getCurrentSpanId(),
      delegationReason: delegate.context?.reason
    };

    // Execute based on location
    if (this.isLocal(delegate.to)) {
      return this.executeLocal(delegate, delegationContext);
    } else {
      return this.executeRemote(delegate, delegationContext);
    }
  }

  private async executeLocal(
    delegate: DelegateRequest,
    context: DelegationContext
  ): Promise<Response> {
    const span = this.createDelegationSpan(delegate, context);

    try {
      const librarian = this.registry.get(delegate.to);
      if (!librarian) {
        throw new Error(`Librarian not found: ${delegate.to}`);
      }

      // Execute with timeout
      const timeout = context.remainingTimeout;
      const result = await Promise.race([
        librarian.execute(delegate.query || context.originalQuery, context),
        this.createTimeoutPromise(timeout)
      ]);

      return result;
    } catch (error: any) {
      return {
        error: {
          code: 'DELEGATION_FAILED',
          message: error.message
        }
      };
    } finally {
      span?.end();
    }
  }

  private async executeRemote(
    delegate: DelegateRequest,
    context: DelegationContext
  ): Promise<Response> {
    // TODO: Implement HTTP-based delegation
    return {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Remote delegation not yet implemented'
      }
    };
  }

  private async executeMultiple(
    delegates: DelegateRequest[],
    context: Context
  ): Promise<Response> {
    const responses = await this.executeParallelDelegations(delegates, context);
    return this.aggregateResponses(responses, 'best-confidence');
  }

  private validateDelegation(
    delegate: DelegateRequest,
    context: Context
  ): { valid: boolean; reason?: string } {
    const ctx = context as DelegationContext;

    // Check depth
    if ((ctx.delegationDepth || 0) >= MAX_DELEGATION_DEPTH) {
      return { valid: false, reason: 'Maximum delegation depth exceeded' };
    }

    // Check chain length
    if ((ctx.delegationChain?.length || 0) >= MAX_DELEGATION_CHAIN) {
      return { valid: false, reason: 'Delegation chain too long' };
    }

    // Check for loops
    if (ctx.delegationChain?.includes(delegate.to)) {
      return { valid: false, reason: 'Delegation loop detected' };
    }

    return { valid: true };
  }

  private calculateRemainingTimeout(context: Context): number {
    const ctx = context as DelegationContext;
    const totalTimeout = context.timeout || 30000;
    const elapsed = Date.now() - (ctx.startTime || Date.now());
    const remaining = totalTimeout - elapsed;

    // Reserve time for response
    const responseBuffer = 500;

    return Math.max(remaining - responseBuffer, MIN_DELEGATION_TIMEOUT);
  }

  private createTimeoutPromise(timeout: number): Promise<Response> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          error: {
            code: 'TIMEOUT',
            message: 'Delegation timeout'
          }
        });
      }, timeout);
    });
  }

  private isLocal(targetId: string): boolean {
    return this.registry.has(targetId);
  }

  private getCurrentSpanId(): string | undefined {
    // TODO: Get from tracer
    return undefined;
  }

  private createDelegationSpan(
    delegate: DelegateRequest,
    context: DelegationContext
  ): any {
    if (!this.tracer) return null;

    return this.tracer.startSpan('librarian.delegation', {
      parent: context.parentSpanId,
      attributes: {
        'delegation.to': delegate.to,
        'delegation.depth': context.delegationDepth,
        'delegation.chain': context.delegationChain.join(' -> '),
        'delegation.reason': delegate.context?.reason
      }
    });
  }

  private async executeParallelDelegations(
    delegates: DelegateRequest[],
    context: Context
  ): Promise<Response[]> {
    const tasks = delegates.map(delegate =>
      this.executeSingle(delegate, context)
    );

    const results = await Promise.allSettled(tasks);

    return results.map(result =>
      result.status === 'fulfilled'
        ? result.value
        : {
            error: {
              code: 'DELEGATION_FAILED',
              message: result.reason
            }
          }
    );
  }

  private aggregateResponses(
    responses: Response[],
    strategy: string
  ): Response {
    // For now, implement best-confidence strategy
    const successful = responses.filter(r => !r.error);

    if (successful.length === 0) {
      return responses[0]; // Return first error
    }

    // Sort by confidence and return best
    successful.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    return successful[0];
  }
}
```

### Step 7.2: Implement Response Aggregator

Create `src/delegation/aggregator.ts`:

```typescript
import { Response } from '../types/core';
import { AIClient } from '../ai/client';

export type AggregationStrategy =
  | 'first-success'
  | 'best-confidence'
  | 'merge-all'
  | 'ai-blend';

export class ResponseAggregator {
  constructor(private ai?: AIClient) {}

  async aggregate(
    responses: Response[],
    strategy: AggregationStrategy = 'best-confidence'
  ): Promise<Response> {
    if (responses.length === 0) {
      return {
        error: {
          code: 'NO_RESPONSES',
          message: 'No responses to aggregate'
        }
      };
    }

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
        return this.bestConfidence(responses);
    }
  }

  private firstSuccess(responses: Response[]): Response {
    const success = responses.find(r => !r.error);
    return success || responses[0];
  }

  private bestConfidence(responses: Response[]): Response {
    const successful = responses.filter(r => !r.error);

    if (successful.length === 0) {
      return responses[0];
    }

    return successful.reduce((best, current) =>
      (current.confidence || 0) > (best.confidence || 0) ? current : best
    );
  }

  private mergeAll(responses: Response[]): Response {
    const successful = responses.filter(r => !r.error);

    if (successful.length === 0) {
      return responses[0];
    }

    const answers = successful.map(r => r.answer).filter(Boolean);
    const sources = successful.flatMap(r => r.sources || []);
    const confidence = successful.reduce((sum, r) =>
      sum + (r.confidence || 0), 0
    ) / successful.length;

    return {
      answer: this.combineAnswers(answers),
      sources: [...new Set(sources)], // Deduplicate
      confidence,
      metadata: {
        aggregated: true,
        responseCount: successful.length,
        strategy: 'merge-all'
      }
    };
  }

  private async aiBlend(responses: Response[]): Promise<Response> {
    if (!this.ai) {
      return this.mergeAll(responses);
    }

    const successful = responses.filter(r => !r.error);

    if (successful.length === 0) {
      return responses[0];
    }

    const prompt = `You are a response aggregator. Combine these responses into a single, coherent answer:

${successful.map((r, i) => `Response ${i + 1} (confidence: ${r.confidence || 0}):
${r.answer}`).join('\n\n')}

Create a unified response that incorporates the best information from all responses.`;

    try {
      const blended = await this.ai.ask(prompt, { temperature: 0.3 });

      return {
        answer: blended,
        sources: successful.flatMap(r => r.sources || []),
        confidence: Math.max(...successful.map(r => r.confidence || 0)),
        metadata: {
          aggregated: true,
          responseCount: successful.length,
          strategy: 'ai-blend'
        }
      };
    } catch (error) {
      // Fallback to merge-all
      return this.mergeAll(responses);
    }
  }

  private combineAnswers(answers: string[]): string {
    if (answers.length === 1) {
      return answers[0];
    }

    return answers.map((answer, i) =>
      `[Response ${i + 1}]:\n${answer}`
    ).join('\n\n');
  }
}
```

### Step 7.3: Update Delegation Handler

Update `src/delegation/handler.ts` to use the executor:

```typescript
import { Response, Context } from '../types/core';
import { DelegationExecutor } from './executor';
import { ResponseAggregator } from './aggregator';
import { LibrarianRegistry } from '../registry/registry';

export class DelegationHandler {
  private executor: DelegationExecutor;
  private aggregator: ResponseAggregator;

  constructor(
    private registry: LibrarianRegistry,
    private ai?: any,
    private tracer?: any
  ) {
    this.executor = new DelegationExecutor(registry, tracer);
    this.aggregator = new ResponseAggregator(ai);
  }

  async handleDelegation(
    response: Response,
    query: string,
    context: Context
  ): Promise<Response> {
    if (!response.delegate) {
      return response;
    }

    // Execute delegation
    const delegatedResponse = await this.executor.executeDelegation(
      response,
      context
    );

    // If the delegated response also wants to delegate, handle recursively
    if (delegatedResponse.delegate) {
      return this.handleDelegation(delegatedResponse, query, context);
    }

    return delegatedResponse;
  }

  async handleMultipleDelegations(
    responses: Response[],
    strategy: 'first-success' | 'best-confidence' | 'merge-all' | 'ai-blend'
  ): Promise<Response> {
    return this.aggregator.aggregate(responses, strategy);
  }
}
```

### Step 7.4: Add Delegation Caching

Create `src/delegation/cache.ts`:

```typescript
import { Response } from '../types/core';

export interface DelegationCache {
  shouldDelegate(query: string, context: any): boolean | undefined;
  getCachedResponse(targetId: string, query: string): Response | undefined;
  cacheDelegationDecision(query: string, context: any, decision: boolean): void;
  cacheResponse(targetId: string, query: string, response: Response): void;
}

export class InMemoryDelegationCache implements DelegationCache {
  private decisionCache = new Map<string, boolean>();
  private responseCache = new Map<string, { response: Response; timestamp: number }>();
  private maxAge = 5 * 60 * 1000; // 5 minutes

  shouldDelegate(query: string, context: any): boolean | undefined {
    const key = this.getDecisionKey(query, context);
    return this.decisionCache.get(key);
  }

  getCachedResponse(targetId: string, query: string): Response | undefined {
    const key = this.getResponseKey(targetId, query);
    const cached = this.responseCache.get(key);

    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.maxAge) {
        return {
          ...cached.response,
          metadata: {
            ...cached.response.metadata,
            cached: true,
            cacheAge: age
          }
        };
      } else {
        this.responseCache.delete(key);
      }
    }

    return undefined;
  }

  cacheDelegationDecision(query: string, context: any, decision: boolean): void {
    const key = this.getDecisionKey(query, context);
    this.decisionCache.set(key, decision);
  }

  cacheResponse(targetId: string, query: string, response: Response): void {
    const key = this.getResponseKey(targetId, query);
    this.responseCache.set(key, {
      response,
      timestamp: Date.now()
    });
  }

  private getDecisionKey(query: string, context: any): string {
    return `decision:${query}:${context.user?.id || 'anonymous'}`;
  }

  private getResponseKey(targetId: string, query: string): string {
    return `response:${targetId}:${query}`;
  }
}
```

## Testing Strategy

### Unit Tests

Create `tests/unit/librarian.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { helloWorldLibrarian } from '../../src/librarians/hello-world';

describe('Hello World Librarian', () => {
  it('responds to hello', async () => {
    const response = await helloWorldLibrarian('hello there', {});
    expect(response.answer).toContain('Hello');
    expect(response.confidence).toBe(1.0);
  });

  it('handles unknown queries', async () => {
    const response = await helloWorldLibrarian('random query', {});
    expect(response.confidence).toBeLessThan(1.0);
  });
});
```

### Integration Tests

Create `tests/integration/delegation.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { SimpleRouter } from '../../src/core/router';
import { DelegationHandler } from '../../src/delegation/handler';

describe('Delegation', () => {
  it('handles single delegation', async () => {
    const router = new SimpleRouter();
    const handler = new DelegationHandler(router);

    // Register librarians
    router.register('delegator', async (query) => ({
      delegate: { to: 'expert', query }
    }));

    router.register('expert', async (query) => ({
      answer: `Expert answer to: ${query}`
    }));

    // Test delegation
    const response = await router.route('test query', 'delegator');
    const final = await handler.handleDelegation(response, 'test query', {});

    expect(final.answer).toContain('Expert answer');
  });
});
```

### End-to-End Tests

Create `tests/e2e/full-flow.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import axios from 'axios';

describe('E2E Flow', () => {
  const baseURL = 'http://localhost:3000';

  it('handles complete query flow', async () => {
    const response = await axios.post(`${baseURL}/query`, {
      query: 'How do I deploy to Kubernetes?',
      librarian: 'platform'
    });

    expect(response.status).toBe(200);
    expect(response.data.answer).toBeTruthy();
    expect(response.data.sources).toBeInstanceOf(Array);
  });
});
```

## Deployment

### Docker Configuration

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Kubernetes Deployment

Create `deployment/kubernetes/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: data-library-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: data-library-gateway
  template:
    metadata:
      labels:
        app: data-library-gateway
    spec:
      containers:
      - name: gateway
        image: constellation/gateway:latest
        ports:
        - containerPort: 3000
        env:
        - name: AI_PROVIDER
          value: openai
        - name: REDIS_URL
          value: redis://redis:6379
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: data-library-gateway
spec:
  selector:
    app: data-library-gateway
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Next Steps

1. Complete Phase 7 (Inter-Librarian Communication) for full delegation execution
2. Implement remaining AI providers (Anthropic, local models)
3. Add remote HTTP-based delegation for distributed librarians
4. Enhance response aggregation with more sophisticated strategies
5. Implement full observability stack integration
6. Build management UI for monitoring delegation chains
7. Create more example librarians that leverage delegation
8. Set up CI/CD pipeline
9. Write comprehensive documentation on delegation patterns

This implementation guide provides the foundation. Each component can be enhanced and optimized based on specific requirements. The Inter-Librarian Communication phase (Phase 7) is particularly critical as it unlocks the full potential of the distributed knowledge system.
