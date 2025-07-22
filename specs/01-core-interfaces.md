# Specification: Core Interfaces

## Overview

This specification defines the core interfaces that form the foundation of Constellation. All implementations must conform to these interfaces.

## The Librarian Function

### Definition

```typescript
type Librarian = (query: string, context?: Context) => Promise<Response>;
```

### Requirements

1. **MUST** be an async function
2. **MUST** accept a query string as first parameter
3. **MAY** accept an optional context as second parameter
4. **MUST** return a Promise that resolves to a Response
5. **MUST NOT** throw exceptions (handle all errors internally)
6. **SHOULD** complete within timeout specified in context
7. **SHOULD** respect cancellation signals if provided

### Implementation Guidelines

```typescript
// Good: Handles all cases
export const myLibrarian: Librarian = async (query, context) => {
  try {
    // Implementation
    return { answer: "..." };
  } catch (error) {
    return { error: { code: "ERROR", message: error.message } };
  }
};

// Bad: Can throw exceptions
export const badLibrarian: Librarian = async (query, context) => {
  const data = await fetchData(); // Can throw!
  return { answer: data };
};
```

## Context Object

### Purpose

The Context object provides:
- Identity information (who's asking)
- Tracing context (for observability)
- AI client access (for intelligent responses)
- Available delegates (for routing)
- Metadata (additional information)

### Required Fields

None - all fields are optional to allow flexibility

### Standard Fields

```typescript
interface Context {
  // Identity
  librarian?: LibrarianInfo;  // Current librarian info
  user?: User;                // Requesting user
  
  // Tracing
  trace?: TraceContext;        // Distributed tracing
  delegationChain?: string[];  // Prevent loops
  
  // Capabilities
  ai?: AIClient;              // AI for intelligent responses
  availableDelegates?: Delegate[]; // For delegation
  
  // Metadata
  metadata?: Record<string, any>;  // Arbitrary data
}
```

### Usage Rules

1. **MUST NOT** modify context object (treat as immutable)
2. **SHOULD** pass context through to delegates
3. **SHOULD** use trace context for observability
4. **MAY** add metadata for downstream librarians

## Response Object

### Purpose

The Response object can represent:
- A direct answer to the query
- A delegation request
- An error condition
- A partial answer

### Valid Response Types

1. **Answer Response**
   ```typescript
   {
     answer: "The answer to your query...",
     sources: [...],
     confidence: 0.9
   }
   ```

2. **Delegation Response**
   ```typescript
   {
     delegate: {
       to: "expert-librarian",
       query: "refined query"
     }
   }
   ```

3. **Error Response**
   ```typescript
   {
     error: {
       code: "NOT_FOUND",
       message: "Could not find information",
       recoverable: true
     }
   }
   ```

4. **Partial Response**
   ```typescript
   {
     answer: "Partial information...",
     partial: true,
     confidence: 0.5
   }
   ```

### Field Specifications

#### answer (string)
- The textual answer to the query
- SHOULD be in markdown format
- SHOULD be self-contained
- SHOULD NOT exceed 4000 characters

#### sources (Source[])
- Array of sources used to generate answer
- MUST include name for each source
- SHOULD include URL when available
- SHOULD be deduplicated
- SHOULD be ordered by relevance

#### delegate (DelegateRequest | DelegateRequest[])
- Request to delegate to another librarian
- MUST include 'to' field with target ID
- MAY include refined query
- MAY include additional context
- MAY be an array for parallel delegation

#### confidence (number)
- Confidence in the answer (0-1)
- 0 = no confidence
- 1 = complete confidence
- SHOULD reflect data quality
- SHOULD reflect query match

#### error (ErrorInfo)
- Error information
- MUST include code and message
- SHOULD include recoverable flag
- SHOULD include helpful suggestion
- MAY include additional details

#### partial (boolean)
- Indicates incomplete answer
- true = answer is incomplete
- SHOULD be true when some data sources failed
- SHOULD be true when confidence < 0.6

## Error Handling

### Error Codes

Standard error codes that should be used:

```typescript
enum ErrorCode {
  // Client errors (4xx equivalent)
  INVALID_QUERY = "INVALID_QUERY",
  UNAUTHORIZED = "UNAUTHORIZED",
  NOT_FOUND = "NOT_FOUND",
  RATE_LIMITED = "RATE_LIMITED",
  
  // Server errors (5xx equivalent)
  INTERNAL_ERROR = "INTERNAL_ERROR",
  TIMEOUT = "TIMEOUT",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  DELEGATION_FAILED = "DELEGATION_FAILED",
  
  // Specific errors
  LOOP_DETECTED = "LOOP_DETECTED",
  MAX_DEPTH_EXCEEDED = "MAX_DEPTH_EXCEEDED",
  AI_UNAVAILABLE = "AI_UNAVAILABLE",
  DATA_SOURCE_ERROR = "DATA_SOURCE_ERROR"
}
```

### Error Response Format

```typescript
interface ErrorInfo {
  code: string;              // One of ErrorCode
  message: string;           // Human readable message
  librarian?: string;        // Which librarian errored
  query?: string;            // Original query
  recoverable?: boolean;     // Can retry?
  suggestion?: string;       // Helpful suggestion
  details?: Record<string, any>; // Additional context
}
```

## Best Practices

### 1. Always Return Something

```typescript
// Good: Always returns a response
export const resilientLibrarian: Librarian = async (query, context) => {
  try {
    const answer = await generateAnswer(query);
    return { answer };
  } catch (error) {
    // Fallback to error response
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to generate answer",
        recoverable: true,
        suggestion: "Try rephrasing your query"
      }
    };
  }
};
```

### 2. Use Confidence Scores

```typescript
// Good: Indicates confidence
const response: Response = {
  answer: "Based on limited data...",
  confidence: 0.3,
  partial: true
};
```

### 3. Provide Sources

```typescript
// Good: Cites sources
const response: Response = {
  answer: "According to our documentation...",
  sources: [
    {
      name: "Deployment Guide",
      url: "https://docs.example.com/deploy",
      type: "document",
      relevance: 0.9
    }
  ]
};
```

### 4. Delegate When Appropriate

```typescript
// Good: Delegates to expert
if (isComplexKubernetesQuery(query) && context?.availableDelegates) {
  const k8sExpert = context.availableDelegates.find(d => d.id === 'k8s-expert');
  if (k8sExpert) {
    return {
      delegate: {
        to: 'k8s-expert',
        query: query,
        context: { reason: 'Complex Kubernetes query' }
      }
    };
  }
}
```

## Validation

Implementations MUST pass these validation checks:

1. **Response Validation**
   - Has at least one of: answer, delegate, or error
   - Confidence is between 0 and 1 if provided
   - Sources have required fields

2. **Error Validation**
   - Error has code and message
   - Error code is from standard set
   - Suggestion is helpful if provided

3. **Delegation Validation**
   - Delegate has 'to' field
   - Target librarian exists
   - No delegation loops

## Testing Requirements

Every librarian implementation MUST have tests for:

1. **Happy Path**: Normal query returns answer
2. **Error Handling**: Errors return proper error response
3. **Delegation**: Delegates when appropriate
4. **Timeout**: Respects timeout in context
5. **No AI**: Works without AI in context

Example test:

```typescript
describe('MyLibrarian', () => {
  it('answers simple queries', async () => {
    const response = await myLibrarian('test query');
    expect(response.answer).toBeDefined();
    expect(response.error).toBeUndefined();
  });
  
  it('handles errors gracefully', async () => {
    const response = await myLibrarian('cause-error');
    expect(response.error).toBeDefined();
    expect(response.error.code).toBe('INTERNAL_ERROR');
  });
});
```