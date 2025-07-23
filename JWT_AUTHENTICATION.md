# JWT Authentication Guide

Constellation supports JWT (JSON Web Token) authentication to secure access to librarians and ensure team-based access control.

## Overview

When authentication is enabled, all MCP endpoints (except health checks) require a valid JWT bearer token. The framework automatically:

- Validates JWT tokens
- Extracts user identity and team membership
- Enforces team-based access control on librarians
- Provides user context to librarian functions

## Configuration

### Environment Variables

```bash
# Enable authentication (default: false)
AUTH_ENABLED=true

# JWT secret key (required when AUTH_ENABLED=true)
JWT_SECRET=your-secret-key-change-in-production
```

⚠️ **Important**: Always use a strong, unique secret in production. Never commit secrets to version control.

## JWT Token Structure

Constellation expects JWT tokens with the following payload structure:

```typescript
{
  sub: string;      // User ID (required)
  email: string;    // User email (required)
  teams: string[];  // Team memberships (required)
  roles: string[];  // User roles (optional)
  iat?: number;     // Issued at (optional)
  exp?: number;     // Expiration (optional)
}
```

Example token payload:
```json
{
  "sub": "user-123",
  "email": "alice@example.com",
  "teams": ["platform", "sre"],
  "roles": ["developer", "on-call"],
  "iat": 1707123456,
  "exp": 1707209856
}
```

## Making Authenticated Requests

### MCP Client Authentication

Include the JWT token in the Authorization header:

```typescript
const response = await fetch('http://localhost:3001/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'query',
      arguments: { query: 'Hello world' }
    },
    id: 1
  })
});
```

### Testing Authentication

Use the provided test script:

```bash
# Test with authentication disabled (default)
npm run dev  # In one terminal
tsx examples/test-jwt-auth.ts  # In another terminal

# Test with authentication enabled
AUTH_ENABLED=true JWT_SECRET=test-secret npm run dev
tsx examples/test-jwt-auth.ts
```

## Access Control in Librarians

When authentication is enabled, librarians receive the authenticated user in the context:

```typescript
export default async function secureLibrarian(query: string, context: Context) {
  // Access authenticated user
  const user = context.user;
  
  if (!user) {
    return { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } };
  }
  
  // Check team membership
  if (!user.teams?.includes('platform')) {
    return { error: { code: 'UNAUTHORIZED', message: 'Platform team access required' } };
  }
  
  // Access is granted - process the query
  return { answer: `Hello ${user.email}, welcome to the platform team resources!` };
}
```

## Registry-Based Security

The secure registry automatically enforces access control based on configuration:

```yaml
librarians:
  # Public librarian - no auth required
  - id: public-docs
    function: ./docs-librarian.ts
    team: platform
    permissions:
      public: true

  # Team-restricted librarian
  - id: platform-tools
    function: ./platform-librarian.ts
    team: platform
    permissions:
      allowedTeams: [platform, sre]
      
  # Role-restricted librarian
  - id: admin-panel
    function: ./admin-librarian.ts
    team: security
    permissions:
      allowedRoles: [admin, security-lead]
      
  # Sensitive data librarian
  - id: hr-data
    function: ./hr-librarian.ts
    team: hr
    permissions:
      allowedTeams: [hr]
      sensitiveData: true  # Extra audit logging
```

## Security Best Practices

### 1. Token Generation

Generate tokens in your authentication service:

```typescript
import { generateToken } from './src/auth/jwt-middleware';

const token = generateToken({
  id: 'user-123',
  email: 'user@example.com',
  teams: ['platform', 'sre'],
  roles: ['developer']
}, JWT_SECRET, '24h');
```

### 2. Token Validation

The framework automatically validates:
- Token signature
- Token expiration
- Required fields (sub, email, teams)

### 3. Error Handling

Authentication errors return appropriate HTTP status codes:
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Valid token but insufficient permissions

### 4. Development vs Production

**Development Mode** (default):
```bash
AUTH_ENABLED=false  # No authentication required
```

**Production Mode**:
```bash
AUTH_ENABLED=true
JWT_SECRET=<strong-random-secret>
```

### 5. Secret Management

- Use environment variables for secrets
- Rotate secrets regularly
- Use a secrets management service in production
- Never commit secrets to version control

## Troubleshooting

### Common Issues

1. **"Missing Authorization header"**
   - Ensure you're including the `Authorization: Bearer <token>` header

2. **"Invalid authentication token"**
   - Check that the JWT secret matches between token generation and server
   - Verify token hasn't been modified

3. **"Authentication token has expired"**
   - Generate a new token with appropriate expiration

4. **"You do not have permission to access this librarian"**
   - Verify user's teams include required teams for the librarian
   - Check librarian's permission configuration in registry

### Debug Mode

Enable debug logging to troubleshoot authentication:

```bash
LOG_LEVEL=debug AUTH_ENABLED=true npm run dev
```

This will log:
- Authentication attempts
- User extraction details
- Authorization decisions

## Future Enhancements

- Keycloak SSO integration
- OAuth2/OIDC support
- Token refresh mechanism
- API key authentication for service accounts
- Multi-tenant isolation