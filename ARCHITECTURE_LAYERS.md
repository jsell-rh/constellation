# Constellation Architecture: Simplicity Through Layers

## 🏗️ The Key Insight

Complexity should flow DOWN the layers, never UP. Developers interact with the top layer (simple), while the framework handles complexity in lower layers.

```
┌─────────────────────────────────────────────┐
│          Developer Experience Layer          │ ← "Just a Function"
│                                             │
│  - Write async functions                    │
│  - Return { answer: "..." }                 │
│  - Access context when needed               │
└─────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────┐
│           Framework Core Layer              │ ← Handles Complexity
│                                             │
│  - Authentication & Authorization           │
│  - Request Routing & Delegation             │
│  - Error Handling & Recovery                │
│  - Caching & Performance                    │
│  - Observability & Metrics                  │
└─────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────┐
│         Infrastructure Layer                │ ← Enterprise Ready
│                                             │
│  - Kubernetes Deployment                    │
│  - High Availability                        │
│  - Security Scanning                        │
│  - Compliance & Audit                       │
│  - Disaster Recovery                        │
└─────────────────────────────────────────────┘
```

## 🔍 Example: How a Request Flows

### What the Developer Sees:
```typescript
export default async function priceLibrarian(query: string, context: Context) {
  const product = await findProduct(query);
  return { answer: `The price is $${product.price}` };
}
```

### What Actually Happens:

```
1. Request Arrives
   └─> Infrastructure Layer
       - TLS termination
       - Rate limit check
       - DDoS protection

2. Authentication
   └─> Framework Core
       - JWT validation
       - Team extraction
       - Role verification

3. Authorization
   └─> Framework Core
       - Check librarian permissions
       - Verify team access
       - Audit log entry

4. Pre-execution
   └─> Framework Core
       - Circuit breaker check
       - Create trace span
       - Check cache

5. Execution
   └─> Developer Layer ⭐
       - Run the simple function
       - Automatic error catching
       - Context enrichment

6. Post-execution
   └─> Framework Core
       - Cache response
       - Emit metrics
       - Complete trace

7. Response
   └─> Infrastructure Layer
       - Response sanitization
       - Compression
       - Audit completion
```

## 🛡️ Security at Each Layer

### Developer Layer (What they write)
```typescript
// No security code needed!
export default async function hrLibrarian(query: string, context: Context) {
  // Context already has authenticated user
  if (context.user.teams.includes('hr')) {
    return { answer: await getEmployeeInfo(query) };
  }
  return { error: { message: "HR access required" } };
}
```

### Framework Layer (What we provide)
```typescript
// Automatic security wrapper (invisible to developers)
function secureLibrarian(librarianFn: Librarian, metadata: LibrarianInfo) {
  return async (query: string, rawContext: Context) => {
    // 1. Verify authentication
    if (!rawContext.auth?.isValid) {
      return { error: { code: 'UNAUTHENTICATED' } };
    }
    
    // 2. Check authorization
    if (!canAccess(rawContext.user, metadata)) {
      auditUnauthorizedAccess(rawContext.user, metadata);
      return { error: { code: 'UNAUTHORIZED' } };
    }
    
    // 3. Sanitize inputs
    const sanitizedQuery = sanitizeInput(query);
    
    // 4. Add security context
    const secureContext = {
      ...rawContext,
      user: rawContext.auth.user,
      auth: createAuthHelpers(rawContext.auth)
    };
    
    // 5. Execute with monitoring
    return await withSecurityMonitoring(
      () => librarianFn(sanitizedQuery, secureContext),
      metadata
    );
  };
}
```

### Infrastructure Layer (Platform handles)
- Network policies
- Pod security policies  
- Secret management
- Certificate rotation
- Vulnerability scanning

## 📊 Observability Without Complexity

### Developer writes:
```typescript
export default async function slowLibrarian(query: string) {
  const data = await slowDatabase.query(query);  // Might be slow
  return { answer: processData(data) };
}
```

### Framework automatically provides:
- Latency histogram: `librarian_duration_seconds{id="slow-librarian"}`
- Error rate: `librarian_errors_total{id="slow-librarian"}`
- Request rate: `librarian_requests_total{id="slow-librarian"}`
- Trace spans: `slowDatabase.query` automatically instrumented
- Slow query alerts: Automatic alerting if p99 > 2s

### Dashboards show:
```
┌─────────────────────────────────┐
│   Slow Librarian Performance    │
├─────────────────────────────────┤
│ Requests/sec: 42                │
│ Error rate: 0.1%                │
│ P50 latency: 200ms              │
│ P99 latency: 1.8s               │
│                                 │
│ Top Slow Queries:               │
│ - "complex product search" 2.1s │
│ - "inventory full scan" 1.9s    │
└─────────────────────────────────┘
```

## 🔄 Progressive Enhancement

### Start Simple (Day 1)
```yaml
# registry.yaml
librarians:
  - id: hello
    function: ./hello.ts
```

### Add Security (When Ready)
```yaml
librarians:
  - id: hello
    function: ./hello.ts
    team: platform  # Now requires auth
```

### Add Permissions (As Needed)
```yaml
librarians:
  - id: hello
    function: ./hello.ts
    team: platform
    permissions:
      public: false
      allowedTeams: [platform, sre]
```

### Add Performance Hints (Optional)
```yaml
librarians:
  - id: hello
    function: ./hello.ts
    team: platform
    performance:
      cache: true
      timeout: 5000
      rateLimit: 100
```

## 🎯 The Result

Teams get:
- Simple function interface
- Automatic security
- Built-in observability
- Enterprise resilience
- Zero security/ops code to write

Platform team gets:
- Central security control
- Unified observability
- Consistent performance
- Compliance automation
- Easy troubleshooting

**Everyone wins through proper layering!**