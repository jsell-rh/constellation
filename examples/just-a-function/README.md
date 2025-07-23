# Just a Function - The Simplest Librarians

This directory shows how simple Constellation librarians can be. No imports, no complex types, just functions that answer questions.

## The Examples

### 1. Weather Librarian (`weather-librarian.ts`)
- Answers questions about weather
- Shows basic pattern matching
- Delegates non-weather questions

### 2. Greeting Librarian (`greeting-librarian.ts`) 
- The absolute minimum - just 3 lines!
- Always responds with a greeting
- Shows that librarians can be trivial

### 3. Math Librarian (`math-librarian.ts`)
- Handles basic arithmetic
- Shows how to use context (optional)
- Falls back to AI for complex math

## How to Use

1. **Write your function**:
   ```typescript
   export default async function myLibrarian(query: string) {
     return { answer: "Your answer here" };
   }
   ```

2. **Add to registry.yaml**:
   ```yaml
   - id: my-librarian
     function: ./my-librarian.ts
   ```

3. **That's it!** When Constellation starts, your librarian is automatically available.

## Key Points

- **No imports required** - Constellation handles everything
- **Return types are flexible** - Just include `answer`, `error`, or `delegate`
- **Context is optional** - Only use it if you need AI or metadata
- **Errors are handled** - The framework ensures your function never crashes the system

## Try It Yourself

1. Copy any example as a starting point
2. Modify the logic to answer your domain's questions  
3. Add to the registry
4. Run Constellation

Your librarian is now part of the AI knowledge network!