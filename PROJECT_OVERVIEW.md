# Constellation - Project Overview

## What We're Building

A framework that enables every team at Red Hat to create AI-powered assistants (librarians) that provide intelligent access to their data. The key innovation: teams just write a simple function, and the framework provides enterprise-grade features automatically.

## Why This Matters

- **Scale**: 40,000+ data sources across 100+ teams
- **Complexity**: Each team has unique data and expertise
- **Problem**: No single AI can know everything
- **Solution**: Distributed AI librarians that collaborate

## Core Innovation

### What Teams Write (5 minutes)
```typescript
export default async function myLibrarian(query: string, context: Context) {
  const data = await searchMyData(query);
  const answer = await context.ai.complete(`Answer: ${query} using ${data}`);
  return { answer };
}
```

### What They Get (Automatically)
- ✅ AI-powered intelligent routing
- ✅ Multi-expert coordination
- ✅ Distributed tracing
- ✅ Metrics and dashboards
- ✅ Circuit breaker protection
- ✅ Graceful error handling
- ✅ Caching and performance
- ✅ Security and compliance

## System Architecture

```
User Query → Gateway → AI Router → Librarian(s) → Response

With automatic:
- Authentication
- Rate limiting  
- Tracing
- Metrics
- Circuit breaking
- Error recovery
```

## Key Design Decisions

### 1. Function Over Configuration
- **Why**: Simplicity enables adoption
- **How**: Just write a function, no YAML/XML
- **Result**: Teams productive in minutes

### 2. AI-Driven Routing
- **Why**: Better than hardcoded rules
- **How**: AI understands queries and capabilities
- **Result**: Automatic optimal routing

### 3. Service Registry
- **Why**: Dynamic discovery without coupling
- **How**: Simple YAML registry in Git
- **Result**: Add teams without code changes

### 4. Built-in Resilience
- **Why**: Distributed systems fail
- **How**: Circuit breakers, retries, fallbacks
- **Result**: 99.9% availability

### 5. Observable by Default
- **Why**: Can't fix what you can't see
- **How**: Automatic tracing and metrics
- **Result**: Easy debugging and optimization

## Implementation Phases

### Phase 1: Core (Week 1)
- Basic librarian execution
- Simple HTTP server
- Manual routing

### Phase 2: AI (Week 2)  
- AI client integration
- Intelligent responses
- Query analysis

### Phase 3: Registry (Week 3)
- YAML service registry
- Dynamic discovery
- Health checking

### Phase 4: Delegation (Week 4)
- AI-driven routing
- Multi-expert coordination
- Response aggregation

### Phase 5: Observability (Week 5)
- Distributed tracing
- Metrics collection
- Structured logging

### Phase 6: Resilience (Week 6)
- Circuit breakers
- Retry strategies
- Fallback mechanisms

## File Organization

```
fresh_start/
├── Documentation
│   ├── README.md                 # Quick start guide
│   ├── ARCHITECTURE.md          # System design
│   ├── IMPLEMENTATION_GUIDE.md  # Build instructions
│   └── AGENT_INSTRUCTIONS.md    # For autonomous agents
│
├── Interfaces (Contracts)
│   ├── interfaces/
│   │   ├── librarian.ts         # Core types
│   │   ├── registry.ts          # Registry types
│   │   ├── delegation.ts        # Delegation types
│   │   └── observability.ts     # Monitoring types
│
├── Specifications
│   ├── specs/
│   │   ├── 01-core-interfaces.md
│   │   ├── 02-ai-delegation.md
│   │   └── ... (more specs)
│
├── Examples
│   ├── examples/
│   │   ├── simple-librarian/    # Basic example
│   │   └── team-librarian/      # Advanced example
│
├── Registry
│   ├── registry/
│   │   ├── schema.yaml          # Registry schema
│   │   └── example-registry.yaml
│
└── Configuration
    ├── package.json             # Dependencies
    ├── tsconfig.json           # TypeScript config
    └── Dockerfile              # Container build
```

## Critical Success Factors

### 1. Simplicity
- If it takes more than 5 minutes to create a librarian, we've failed
- Every added complexity must provide 10x value
- Documentation should fit on one page

### 2. Reliability
- 99.9% uptime (43 minutes downtime/month)
- <2 second response time at p99
- Graceful degradation during failures

### 3. Intelligence
- AI makes better routing decisions than humans
- System learns and improves over time
- Multi-expert coordination feels magical

### 4. Observability
- Every query fully traced
- Performance visible in real-time
- Problems self-evident in dashboards

## Common Patterns

### Pattern 1: Simple Q&A
```
User: "How do I deploy?"
  → Platform librarian
  → Direct answer
```

### Pattern 2: Multi-Domain
```
User: "Secure Node.js on OpenShift?"
  → AI recognizes 3 domains
  → Parallel: Security + Platform + Node.js
  → Merged comprehensive answer
```

### Pattern 3: Deep Expertise
```
User: "Why is kube-scheduler not binding?"
  → Platform → K8s expert → Scheduler specialist
  → Deep technical answer
```

### Pattern 4: Graceful Degradation
```
User: "Deploy Java app"
  → Java team (circuit open)
  → Fallback: cached answer + platform team
  → Partial but useful answer
```

## Risks and Mitigations

### Risk 1: AI Costs
- **Mitigation**: Aggressive caching, local models for routing

### Risk 2: Complexity Creep
- **Mitigation**: Strict simplicity reviews, usage metrics

### Risk 3: Performance
- **Mitigation**: Parallel execution, smart timeouts

### Risk 4: Adoption
- **Mitigation**: 5-minute onboarding, clear value prop

## Measuring Success

### Technical Metrics
- Response time (target: <2s p99)
- Availability (target: 99.9%)
- Error rate (target: <1%)
- AI costs (target: <$100/day)

### Business Metrics
- Teams onboarded (target: 100)
- Queries/day (target: 10,000)
- User satisfaction (target: >90%)
- Time to answer (target: 10x faster)

## Future Vision

### Year 1: Foundation
- 100 teams onboarded
- 10,000 queries/day
- Core features stable

### Year 2: Intelligence
- Learns from usage patterns
- Proactive suggestions
- Cross-team insights

### Year 3: Platform
- External API access
- Partner integrations
- Industry standard

## Final Thoughts

Constellation represents a fundamental shift in how enterprises access their collective knowledge. By making it trivially easy for teams to contribute their expertise while providing enterprise-grade features automatically, we create a system that grows more valuable with each new librarian added.

The key insight: **complexity in the framework enables simplicity for teams**.

Start building with `IMPLEMENTATION_GUIDE.md`. Good luck!