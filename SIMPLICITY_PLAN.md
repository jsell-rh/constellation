# Constellation: Simplicity-First Next Steps

## 🎯 Core Principle Reminder

**"Just a Function"** - Teams write a simple async function. The framework handles the rest.

```typescript
// This is ALL a team should need to write:
export default async function myLibrarian(query: string, context: Context) {
  const data = await fetchMyData(query);
  return { answer: data.summary };
}
```

## 📋 Immediate Next Steps (Prioritizing Simplicity)

### Step 1: Create the "Just a Function" Example (2 hours)

**Goal**: Show teams how simple it really is

1. Create `/examples/just-a-function/` directory
2. Show a librarian in its simplest form:
   ```typescript
   // weather-librarian.ts
   export default async function weatherLibrarian(query: string) {
     if (query.includes('weather')) {
       return { answer: "It's sunny today!" };
     }
     return { delegate: { to: 'general' } };
   }
   ```

3. Show how to register it (one line):
   ```yaml
   # registry.yaml
   - id: weather
     function: ./weather-librarian.ts
   ```

### Step 2: Simplified YAML Registry (1 day)

**Goal**: Make registration dead simple

```typescript
// src/registry/simple-loader.ts
export async function loadLibrarians(registryPath: string) {
  const yaml = await fs.readFile(registryPath, 'utf-8');
  const entries = parseYAML(yaml);
  
  for (const entry of entries) {
    const module = await import(entry.function);
    const librarian = createLibrarian(module.default);
    router.register({ id: entry.id }, librarian);
  }
}
```

**What we DON'T need**:
- Complex validation schemas
- Nested hierarchies
- Remote loading
- Hot reloading

### Step 3: Auto-Discovery at Startup (4 hours)

**Goal**: One command starts everything

```typescript
// src/index.ts
async function main() {
  // 1. Load all librarians from registry
  await loadLibrarians('./registry.yaml');
  
  // 2. Start MCP server
  await runMCPServer(router);
  
  console.log('✨ Ready! Your librarians are available.');
}
```

### Step 4: Getting Started Tutorial (2 hours)

Create `GETTING_STARTED.md`:

```markdown
# Build Your First Librarian in 5 Minutes

1. Write your function:
   ```typescript
   export default async function greetingLibrarian(query: string) {
     return { answer: `Hello! You asked: ${query}` };
   }
   ```

2. Add to registry.yaml:
   ```yaml
   - id: greeting
     function: ./greeting-librarian.ts
   ```

3. Start Constellation:
   ```bash
   npm start
   ```

That's it! Your librarian is now available through the AI assistant.
```

### Step 5: Simplify What We Have (1 day)

**Remove Complexity**:

1. **Delegation Engine**: 
   - Current: Complex keyword matching
   - New: Simple exact ID matching
   ```typescript
   async route(query: string, targetId?: string) {
     if (targetId) {
       return router.route(query, targetId);
     }
     // Let AI decide in one call
     const decision = await ai.ask(`Which librarian should handle: ${query}?`);
     return router.route(query, decision.librarianId);
   }
   ```

2. **Error Handling**:
   - Current: Complex error types
   - New: Simple string messages
   ```typescript
   if (error) {
     return { error: { message: error.message } };
   }
   ```

3. **Configuration**:
   - Current: Many env variables
   - New: Just the essentials
   ```env
   PORT=3001
   OPENAI_API_KEY=sk-xxx  # Optional
   REGISTRY_PATH=./registry.yaml
   ```

## 🚫 What We're NOT Doing (Yet)

To maintain simplicity, we're postponing:

1. **Complex Observability**: No OpenTelemetry, just basic logging
2. **Circuit Breakers**: Simple retries are enough for now
3. **Authentication**: Can be added later when needed
4. **Performance Optimization**: Focus on working first
5. **Complex Validation**: Trust the developers

## 📊 Success Metrics for Simplicity

1. **Time to First Librarian**: < 5 minutes
2. **Lines of Code for Basic Librarian**: < 10
3. **Configuration Required**: < 3 environment variables
4. **Dependencies**: Minimize to essentials

## 🗓️ Timeline

**Week 1**: 
- Day 1: "Just a Function" example
- Day 2-3: Simple YAML registry
- Day 4: Auto-discovery
- Day 5: Tutorial & documentation

**Week 2**:
- Simplify existing code
- Remove unnecessary features
- Polish developer experience

## 🎉 The Result

A developer should be able to:

1. Clone the repo
2. Write a 5-line function
3. Add 2 lines to YAML
4. Run `npm start`
5. Have a working AI-powered librarian

**No more steps required.**

## 💡 Key Decisions

1. **YAML over JSON**: More readable for humans
2. **File paths over npm packages**: Simpler for teams
3. **Convention over configuration**: Sensible defaults
4. **AI-powered routing**: Let AI handle complexity
5. **MCP protocol**: Direct integration with AI assistants

## 🚀 Next Phase After Simplification

Only after we've proven the simple approach works:

1. **Better AI Routing**: Smarter delegation using embeddings
2. **Caching**: Simple Redis integration
3. **Metrics**: Just response times and error rates
4. **Multi-librarian queries**: Parallel execution

But ONLY if we can add these without breaking the "just a function" principle.

---

**Remember**: Every feature we add should make it EASIER for teams to write librarians, not harder. If a feature requires teams to change their simple function, we probably shouldn't add it.