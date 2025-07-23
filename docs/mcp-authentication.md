# MCP Authentication Guide

This guide explains how to use Constellation's MCP (Model Context Protocol) server with authentication.

## Understanding Authentication

Constellation librarians can have different access levels:
- **Public librarians**: No authentication required (e.g., `hello`, `docs`)
- **Restricted librarians**: Require specific teams or roles

## MCP Tool Usage

### 1. List Available Librarians

First, discover what librarians are available and their access requirements:

```javascript
// MCP tool call
{
  "tool": "list_librarians",
  "arguments": {
    "include_permissions": true
  }
}
```

This returns:
```json
{
  "librarians": [
    {
      "id": "hello",
      "name": "Hello World",
      "description": "A friendly greeting librarian",
      "team": "platform",
      "access": {
        "public": true,
        "requiresAuth": false
      }
    },
    {
      "id": "ai-assistant",
      "name": "AI Assistant",
      "description": "General purpose AI assistant",
      "team": "platform",
      "access": {
        "public": false,
        "allowedTeams": ["platform", "engineering", "product"],
        "requiresAuth": true
      }
    }
  ]
}
```

### 2. Query Without Authentication (Public Librarians Only)

For public librarians, you can query without user context:

```javascript
{
  "tool": "query",
  "arguments": {
    "query": "Hello, how are you?"
  }
}
```

### 3. Query With Authentication

For restricted librarians, include user context:

```javascript
{
  "tool": "query",
  "arguments": {
    "query": "How do I deploy to Kubernetes?",
    "context": {
      "user": {
        "id": "user123",
        "teams": ["platform", "engineering"],
        "roles": ["developer"]
      }
    }
  }
}
```

### 4. Direct Librarian Query

Query a specific librarian directly:

```javascript
{
  "tool": "query_librarian",
  "arguments": {
    "librarian_id": "kubernetes-expert",
    "query": "What are pods?",
    "context": {
      "user": {
        "id": "user123",
        "teams": ["sre", "platform"],
        "roles": ["sre-engineer"]
      }
    }
  }
}
```

## Authentication Requirements by Librarian

Based on the default registry:

| Librarian | Public | Required Teams | Required Roles |
|-----------|--------|----------------|----------------|
| hello | ✅ Yes | - | - |
| docs | ✅ Yes | - | - |
| ai-assistant | ❌ No | platform, engineering, product | - |
| kubernetes-expert | ❌ No | sre, platform, devops | developer, sre-engineer |
| code-reviewer | ❌ No | engineering, security, qa | developer, tech-lead, security-engineer |
| deployment-helper | ❌ No | platform, sre, devops | - |
| metrics-analyzer | ❌ No | analytics, sre, management | - |

## Error Messages

### UNAUTHENTICATED
```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Authentication required to access this librarian"
  }
}
```
**Solution**: Include user context with at least an ID.

### UNAUTHORIZED
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "You do not have permission to access this librarian"
  }
}
```
**Solution**: Ensure the user has the required teams or roles.

## Example: Complete Authentication Flow

```javascript
// 1. First, list librarians to see what's available
const librarians = await mcp.call('list_librarians', {
  include_permissions: true
});

// 2. Find a librarian you want to use
const kubernetesExpert = librarians.find(l => l.id === 'kubernetes-expert');
console.log('Required teams:', kubernetesExpert.access.allowedTeams);
// Output: ["sre", "platform", "devops"]

// 3. Query with appropriate user context
const response = await mcp.call('query', {
  query: "How do I scale a deployment?",
  context: {
    user: {
      id: "alice@company.com",
      teams: ["platform"],  // User is in platform team
      roles: ["developer"]
    }
  }
});
```

## Tips for MCP Client Developers

1. **Always check access requirements first** using the `list_librarians` tool
2. **Include minimal required permissions** - only add teams/roles that are needed
3. **Cache user context** - reuse the same user object across queries in a session
4. **Handle authentication errors gracefully** - prompt for login or use public librarians as fallback
5. **Use the delegation engine** - the `query` tool automatically routes to the best available librarian based on permissions

## Testing Without Authentication

For development/testing, you can:
1. Use only public librarians (`hello`, `docs`)
2. Create a test registry with all librarians marked as public
3. Always include a test user with all teams:
   ```javascript
   {
     "user": {
       "id": "test-user",
       "teams": ["platform", "engineering", "sre", "analytics"],
       "roles": ["developer", "admin"]
     }
   }
   ```
