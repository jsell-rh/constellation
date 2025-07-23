#!/usr/bin/env tsx
/**
 * Example MCP client showing correct usage with user context
 */

import axios from 'axios';

const MCP_URL = 'http://localhost:3001/mcp';

// Helper to parse SSE response
function parseSSEResponse(data: string): any {
  const lines = data.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        return JSON.parse(line.substring(6));
      } catch (e) {
        // Continue to next line
      }
    }
  }
  return null;
}

// Query with proper headers and context
async function queryWithContext(query: string, userContext?: any) {
  const response = await axios.post(
    MCP_URL,
    {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'query',
        arguments: {
          query,
          ...(userContext && { context: userContext }),
        },
      },
      id: Date.now(),
    },
    {
      headers: {
        Accept: 'application/json, text/event-stream', // REQUIRED!
        'Content-Type': 'application/json',
      },
    },
  );

  const parsed = parseSSEResponse(response.data);
  if (parsed?.result?.content?.[0]?.text) {
    return parsed.result.content[0].text;
  }

  if (parsed?.error) {
    throw new Error(`${parsed.error.code}: ${parsed.error.message}`);
  }

  throw new Error('Unexpected response format');
}

// List available librarians
async function listLibrarians() {
  const response = await axios.post(
    MCP_URL,
    {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'list_librarians',
        arguments: {
          include_permissions: true,
        },
      },
      id: Date.now(),
    },
    {
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
    },
  );

  const parsed = parseSSEResponse(response.data);
  return JSON.parse(parsed.result.content[0].text);
}

// Main example
async function main() {
  console.log('🌟 Constellation MCP Client Example\n');

  // 1. List available librarians
  console.log('📚 Available Librarians:');
  const librarians = await listLibrarians();
  console.log(
    `Total: ${librarians.summary.total} (Public: ${librarians.summary.public}, Restricted: ${librarians.summary.restricted})\n`,
  );

  // 2. Query without authentication (will only access public librarians)
  console.log('🔓 Query without authentication:');
  try {
    const response1 = await queryWithContext('Hello, how can you help me?');
    console.log('Response:', response1);
  } catch (error: any) {
    console.log('Error:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // 3. Query with authentication (can access restricted librarians)
  console.log('🔐 Query with authentication:');
  const userContext = {
    user: {
      id: 'alice@company.com',
      teams: ['platform', 'engineering', 'sre'],
      roles: ['developer', 'tech-lead'],
    },
  };

  console.log('User context:', JSON.stringify(userContext, null, 2));

  try {
    const response2 = await queryWithContext(
      'How do I deploy an application to Kubernetes?',
      userContext,
    );
    console.log('\nResponse:', response2.substring(0, 300) + '...');
  } catch (error: any) {
    console.log('Error:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // 4. Direct query to specific librarian
  console.log('🎯 Direct query to kubernetes-expert:');
  try {
    const response3 = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'query_librarian',
          arguments: {
            librarian_id: 'kubernetes-expert',
            query: 'What is a Kubernetes pod?',
            context: userContext,
          },
        },
        id: Date.now(),
      },
      {
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
      },
    );

    const parsed = parseSSEResponse(response3.data);
    console.log('Response:', parsed.result.content[0].text.substring(0, 300) + '...');
  } catch (error: any) {
    console.log('Error:', error.message);
  }
}

// Run the example
main().catch(console.error);
