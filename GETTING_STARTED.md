# Getting Started with Constellation 🚀

Build your first AI-powered librarian in under 5 minutes!

## What is Constellation?

Constellation lets you create "librarians" - simple functions that answer questions about your domain. The framework handles all the complexity of AI routing, error handling, and integration.

## Quick Start

### 1. Install Constellation

```bash
# Clone the repository
git clone https://github.com/your-org/constellation.git
cd constellation

# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Write Your First Librarian

Create a new file `my-librarian.ts`:

```typescript
export default async function myLibrarian(query: string) {
  // Your domain logic here
  if (query.includes('hello')) {
    return { answer: 'Hello! Welcome to Constellation!' };
  }
  
  return { answer: 'I can help you with greetings. Try saying hello!' };
}
```

**That's it!** No imports, no complex setup. Just a function.

### 3. Register Your Librarian

Add your librarian to `registry.yaml`:

```yaml
librarians:
  - id: my-first-librarian
    name: My First Librarian
    function: ./my-librarian.ts
```

### 4. Start Constellation

```bash
npm start
```

You'll see:
```
🚀 Starting Constellation...
✨ Registered 4 librarians
🌟 MCP Server ready at http://localhost:3001
```

### 5. Test Your Librarian

```bash
# Test with curl
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "query",
      "arguments": {"query": "hello"}
    },
    "id": 1
  }'
```

## Real-World Example: Customer Support Librarian

Let's build something more useful - a customer support librarian:

```typescript
// customer-support-librarian.ts
export default async function customerSupport(query: string, context?: any) {
  const q = query.toLowerCase();
  
  // Handle common support questions
  if (q.includes('refund')) {
    return {
      answer: 'To request a refund, please email refunds@company.com with your order number. Refunds are processed within 3-5 business days.',
      sources: [{ name: 'Refund Policy', url: 'https://company.com/refunds' }]
    };
  }
  
  if (q.includes('shipping') || q.includes('delivery')) {
    return {
      answer: 'Standard shipping takes 5-7 business days. Express shipping (2-3 days) is available for an additional $15.',
      confidence: 0.95
    };
  }
  
  if (q.includes('password') || q.includes('login')) {
    return {
      answer: 'To reset your password, click "Forgot Password" on the login page. You\'ll receive a reset link via email.',
      sources: [{ name: 'Account Help', url: 'https://company.com/help/account' }]
    };
  }
  
  // Use AI for complex questions
  if (context?.ai) {
    const answer = await context.ai.ask(
      `You are a helpful customer support agent. Answer this question: ${query}`
    );
    return { answer, confidence: 0.8 };
  }
  
  // Delegate to human support for unhandled cases
  return {
    answer: 'I\'ll connect you with our support team for help with that.',
    delegate: { to: 'human-support' }
  };
}
```

## Using AI in Your Librarian

If you have AI configured, you can use it in your librarians:

```typescript
export default async function smartLibrarian(query: string, context?: any) {
  // Check if AI is available
  if (!context?.ai) {
    return { answer: 'AI features require configuration. See .env.example' };
  }
  
  // Use AI to analyze the query
  const analysis = await context.ai.ask(
    `What category does this question belong to: ${query}? 
     Categories: technical, sales, support, general`
  );
  
  // Route based on analysis
  if (analysis.includes('technical')) {
    return { delegate: { to: 'tech-docs' } };
  }
  
  // Generate a response
  const response = await context.ai.ask(query);
  return { answer: response, confidence: 0.9 };
}
```

## Configuration

### Basic Configuration (.env)

```bash
# Server
PORT=3001
LOG_LEVEL=info

# AI Providers (optional)
OPENAI_API_KEY=sk-your-key-here
# or
ANTHROPIC_API_KEY=sk-ant-your-key-here
# or for local models
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=ollama
```

### Registry Configuration (registry.yaml)

```yaml
librarians:
  # Simple function
  - id: greeting
    function: ./examples/greeting.ts
  
  # With metadata
  - id: weather
    name: Weather Assistant
    function: ./examples/weather.ts
    description: Answers questions about weather
    
  # With capabilities (for better routing)
  - id: technical-docs
    function: ./docs-librarian.ts
    capabilities: 
      - documentation
      - api-reference
      - troubleshooting
```

## Common Patterns

### 1. Domain-Specific Responses

```typescript
export default async function productLibrarian(query: string) {
  // Load your data (database, API, files)
  const products = await loadProducts();
  
  // Search for relevant products
  const matches = products.filter(p => 
    query.toLowerCase().includes(p.name.toLowerCase())
  );
  
  if (matches.length > 0) {
    return {
      answer: `We have ${matches.length} products matching your search:`,
      sources: matches.map(p => ({
        name: p.name,
        url: p.url
      }))
    };
  }
  
  return { delegate: { to: 'general' } };
}
```

### 2. Error Handling

```typescript
export default async function safeLibrarian(query: string) {
  try {
    const data = await riskyOperation(query);
    return { answer: data.result };
  } catch (error) {
    // Errors are automatically handled, but you can customize
    return {
      error: {
        message: 'Service temporarily unavailable',
        recoverable: true
      }
    };
  }
}
```

### 3. Delegation Chains

```typescript
export default async function routerLibrarian(query: string) {
  if (query.includes('technical')) {
    return { delegate: { to: 'tech-support' } };
  }
  
  if (query.includes('billing')) {
    return { delegate: { to: 'billing-dept' } };
  }
  
  // Default fallback
  return { delegate: { to: 'general-support' } };
}
```

## Testing Your Librarians

### Unit Testing

```typescript
// my-librarian.test.ts
import myLibrarian from './my-librarian';

test('handles greetings', async () => {
  const response = await myLibrarian('hello world');
  expect(response.answer).toContain('Hello');
});

test('delegates unknown queries', async () => {
  const response = await myLibrarian('unknown topic');
  expect(response.delegate).toBeDefined();
});
```

### Integration Testing

Use the MCP testing guide to test your librarians with the full system.

## Best Practices

1. **Keep it Simple**: Start with basic pattern matching before adding AI
2. **Return Quickly**: Aim for responses under 2 seconds
3. **Provide Sources**: Include links to documentation when relevant
4. **Use Confidence**: Indicate how certain you are about answers
5. **Delegate Wisely**: Let other librarians handle off-topic queries

## Next Steps

1. Explore the [examples directory](./examples/just-a-function/) for more patterns
2. Read the [AI Integration Guide](./AI_INTEGRATION_GUIDE.md) for advanced AI usage
3. Check the [Architecture Guide](./ARCHITECTURE.md) to understand the system
4. Join our community forum for help and ideas

## Troubleshooting

### "Cannot find module"
- Ensure your function path in registry.yaml is correct
- Use relative paths from the project root

### "AI not available"
- Check your .env file has AI provider credentials
- See AI_INTEGRATION_GUIDE.md for setup instructions

### "No librarians registered"
- Verify registry.yaml is in the correct location
- Check for YAML syntax errors

## Get Help

- 📖 Documentation: [Full docs](./docs/)
- 💬 Community: [Discord/Slack]
- 🐛 Issues: [GitHub Issues]
- 📧 Email: support@constellation.ai

---

**Remember**: The power of Constellation is its simplicity. Your librarians are just functions - keep them focused, clear, and easy to understand. The framework handles the rest!