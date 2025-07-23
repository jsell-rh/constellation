# Secure Registry Guide

The Constellation secure registry provides automatic team-based access control for all librarians while maintaining the simplicity of the developer experience.

## Overview

The secure registry ensures:
- Every librarian has a team owner
- Access control is enforced automatically
- Authentication requirements are transparent to developers
- Security is built-in, not bolted on

## Registry Configuration

### Basic Structure

```yaml
# registry/constellation-registry.yaml
version: "1.0"

librarians:
  - id: unique-id
    name: Human Readable Name
    function: ./path/to/librarian.ts
    team: owning-team          # REQUIRED: Team ownership
    description: What this librarian does
    permissions:               # Optional security settings
      public: true            # If true, no auth required
      allowedTeams: []        # Teams that can access
      allowedRoles: []        # Roles that can access
      sensitiveData: false    # Extra audit logging
    performance:              # Optional hints
      timeout: 30000         # Custom timeout in ms
      cache: 300             # Cache TTL in seconds
      rateLimit: 100         # Requests per minute
```

### Security Patterns

#### 1. Public Librarian
```yaml
- id: docs-helper
  function: ./src/librarians/docs.ts
  team: platform
  permissions:
    public: true  # Anyone can access, no auth required
```

#### 2. Team-Restricted Librarian
```yaml
- id: deployment-assistant
  function: ./src/librarians/deployment.ts
  team: platform
  permissions:
    allowedTeams: [platform, sre, devops]
```

#### 3. Role-Based Access
```yaml
- id: admin-tools
  function: ./src/librarians/admin.ts
  team: security
  permissions:
    allowedRoles: [admin, security-lead]
```

#### 4. Sensitive Data Handling
```yaml
- id: hr-assistant
  function: ./src/librarians/hr.ts
  team: human-resources
  permissions:
    allowedTeams: [hr]
    sensitiveData: true  # Enables audit logging
```

## Developer Experience

### Writing Librarians

Developers still write simple functions - security is handled by the framework:

```typescript
// deployment-librarian.ts
export default async function deploymentLibrarian(query: string, context: Context) {
  // Context automatically includes authenticated user
  const user = context.user;
  
  // Optional: Additional authorization logic
  if (query.includes('production') && !user?.roles?.includes('senior')) {
    return { error: { message: 'Production deployments require senior role' } };
  }
  
  // Normal librarian logic
  return { answer: 'Deployment configuration: ...' };
}
```

### Access Control Flow

1. **Public Librarians**: Skip all auth checks
2. **Team Ownership**: User must belong to owning team OR be in allowedTeams
3. **Role Checks**: If specified, user must have required role
4. **Automatic Enforcement**: Framework handles all checks

## Testing Access Control

### Without Authentication
```bash
# Start server without auth
AUTH_ENABLED=false npm run dev

# Public librarians work
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"query_librarian","arguments":{"librarian_id":"hello","query":"Hi!"}},"id":1}'

# Restricted librarians are blocked
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"query_librarian","arguments":{"librarian_id":"ai-assistant","query":"Help"}},"id":2}'
# Returns: Authentication required
```

### With Authentication
```bash
# Start server with auth
AUTH_ENABLED=true JWT_SECRET=test-secret npm run dev

# Generate test token
tsx examples/test-jwt-auth.ts

# Access with valid token
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"query_librarian","arguments":{"librarian_id":"ai-assistant","query":"Help"}},"id":3}'
```

## Best Practices

### 1. Always Specify Team Ownership
```yaml
# ✅ Good - clear ownership
- id: metrics
  team: analytics
  function: ./metrics.ts

# ❌ Bad - missing team
- id: metrics
  function: ./metrics.ts
```

### 2. Start Public, Add Security Later
```yaml
# Initial version
- id: weather
  team: platform
  function: ./weather.ts
  permissions:
    public: true

# Later, add restrictions
- id: weather
  team: platform
  function: ./weather.ts
  permissions:
    allowedTeams: [platform, product]
```

### 3. Use Performance Hints
```yaml
- id: expensive-analysis
  team: analytics
  function: ./analysis.ts
  performance:
    timeout: 60000      # 1 minute for complex analysis
    cache: 3600        # Cache for 1 hour
    rateLimit: 10      # Prevent abuse
```

### 4. Document Sensitive Operations
```yaml
- id: customer-data
  team: support
  function: ./customer.ts
  description: "Accesses PII - handles customer records"
  permissions:
    allowedTeams: [support, compliance]
    sensitiveData: true  # Triggers audit logging
```

## Registry Validation

The loader validates:
- ✅ Every librarian has an ID
- ✅ Every librarian has a team owner
- ✅ Function paths exist and export valid functions
- ✅ Permissions are properly structured
- ✅ No duplicate IDs

## Error Handling

Common errors and solutions:

### Missing Team
```
Error: Invalid librarian hello: missing team ownership
Solution: Add team field to registry entry
```

### Function Not Found
```
Error: Failed to load librarian from ./missing.ts
Solution: Verify file path and default export
```

### Unauthorized Access
```
Error: You do not have permission to access this librarian
Solution: Ensure user's JWT includes required teams/roles
```

## Migration Guide

To migrate existing librarians:

1. **Add Registry Entry**:
```yaml
- id: existing-librarian
  name: Existing Librarian
  function: ./path/to/existing.ts
  team: your-team
  description: What it does
  permissions:
    public: true  # Start public
```

2. **Update Function** (if needed):
```typescript
// No changes required! Just ensure it exports default function
export default async function existingLibrarian(query: string, context?: Context) {
  // Your existing logic works as-is
}
```

3. **Test Access**:
```bash
npm run dev
# Test with examples/test-registry-loading.ts
```

4. **Add Security** (when ready):
```yaml
permissions:
  public: false  # Remove public access
  allowedTeams: [your-team, other-team]
```

## Summary

The secure registry provides enterprise-grade security while maintaining developer simplicity:

- **Developers**: Write simple async functions
- **Framework**: Handles authentication, authorization, and audit
- **Registry**: Central configuration for all security policies
- **Result**: Secure by default, simple to use