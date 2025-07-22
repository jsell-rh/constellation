# MCP Server Testing Guide

This guide explains how to test the Constellation MCP (Model Context Protocol) server over HTTP.

## Quick Start

```bash
# Start the server
npm start

# Test the health check
curl http://localhost:3001/health
```

The server runs on **http://localhost:3001** by default with these endpoints:
- **Health Check**: `http://localhost:3001/health`
- **MCP Endpoint**: `http://localhost:3001/mcp`

## Testing Methods

### 1. Health Check (Basic Test)

Test if the server is running:

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "server": "constellation", 
  "version": "0.1.0",
  "librarians": 1,
  "protocol": "MCP (Model Context Protocol)",
  "transport": "HTTP"
}
```

### 2. MCP HTTP Client

Use HTTP POST requests to interact with the MCP server:

```bash
# List available tools
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "x-mcp-session-id: test-session" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'

# Call the query tool
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "x-mcp-session-id: test-session" \
  -d '{
    "jsonrpc": "2.0", 
    "method": "tools/call", 
    "params": {
      "name": "query",
      "arguments": {"query": "Hello, how can you help me?"}
    },
    "id": 2
  }'

# Get librarian hierarchy resource
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "x-mcp-session-id: test-session" \
  -d '{
    "jsonrpc": "2.0",
    "method": "resources/read", 
    "params": {"uri": "constellation://librarian-hierarchy"},
    "id": 3
  }'
```

### 3. Claude Desktop Integration

Add Constellation to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "constellation": {
      "command": "npm",
      "args": ["start"],
      "cwd": "/path/to/constellation"
    }
  }
}
```

### 3. MCP Client SDK (Programmatic)

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

const client = new Client({
  name: "test-client",
  version: "1.0.0"
});

const serverProcess = spawn('npm', ['start'], { 
  cwd: '/path/to/constellation',
  stdio: ['pipe', 'pipe', 'inherit']
});

const transport = new StdioClientTransport({
  stdin: serverProcess.stdin,
  stdout: serverProcess.stdout
});

await client.connect(transport);

// Test the query tool
const response = await client.request({
  method: 'tools/call',
  params: {
    name: 'query',
    arguments: {
      query: 'Hello, how can you help me?'
    }
  }
});
```

## Available Tools & Resources

### Tools

#### `query`
Routes queries through the AI delegation engine to find the best librarian.

**Arguments:**
- `query` (string, required): Your question
- `context` (object, optional): Additional context
  - `user_id` (string): User identifier
  - `session_id` (string): Session identifier
  - `metadata` (object): Additional metadata

**Example:**
```json
{
  "query": "Hello, how can you help me?",
  "context": {
    "user_id": "test-user"
  }
}
```

#### `query_librarian`
Query a specific librarian directly, bypassing the delegation engine.

**Arguments:**
- `librarian_id` (string, required): ID of the librarian to query
- `query` (string, required): Your question
- `context` (object, optional): Same as above

**Example:**
```json
{
  "librarian_id": "hello",
  "query": "Say hello to me"
}
```

### Resources

#### `constellation://librarian-hierarchy`
Returns the complete hierarchy of available librarians with their capabilities.

**Response format:**
```json
{
  "total": 1,
  "librarians": [
    {
      "id": "hello",
      "name": "Hello World",
      "description": "A friendly greeting librarian",
      "capabilities": ["greeting", "introduction"]
    }
  ]
}
```

## Example Test Cases

### Test 1: Basic Query
```json
{
  "name": "query",
  "arguments": {
    "query": "Hello, introduce yourself"
  }
}
```

### Test 2: Direct Librarian Query
```json
{
  "name": "query_librarian", 
  "arguments": {
    "librarian_id": "hello",
    "query": "What can you do?"
  }
}
```

### Test 3: Get Librarian Hierarchy
Read the resource `constellation://librarian-hierarchy`

## Troubleshooting

### Common Issues

1. **"MCP server not responding"**
   - Ensure `npm start` runs without errors
   - Check that all dependencies are installed (`npm install`)
   - Verify TypeScript compilation (`npm run build`)

2. **"Tool not found"**
   - Verify the tool name is correct: `query` or `query_librarian`
   - Check server logs for registration issues

3. **"No librarians available"**
   - Ensure at least one librarian is registered
   - Check server startup logs for "Registered X librarians"

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

This will show detailed logs of all MCP interactions and librarian routing decisions.

## Integration Examples

### With AI Assistants
The MCP server can be integrated with any AI assistant that supports the MCP protocol, including:
- Claude Desktop
- Custom AI applications
- LangChain applications
- Other MCP-compatible tools

### With Development Tools
- VS Code extensions
- API testing tools
- Custom scripts and automation

## Next Steps

Once you've verified the MCP server is working:
1. Add more librarians by registering them with the router
2. Implement YAML registry loading for dynamic librarian discovery
3. Add AI-powered librarians using LangChain integration
4. Configure authentication and authorization