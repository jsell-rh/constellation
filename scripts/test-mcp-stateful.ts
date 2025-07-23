#!/usr/bin/env tsx
/**
 * Test MCP stateful mode with proper session initialization
 */

import axios from 'axios';

const MCP_URL = 'http://localhost:3001/mcp';

class MCPClient {
  private sessionId?: string;

  async initialize() {
    console.log('🔄 Initializing MCP session...');

    // Send initialize request
    const response = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
        id: 'init',
      },
      {
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
      },
    );

    // Extract session ID from response headers
    this.sessionId = response.headers['mcp-session-id'];
    console.log('✅ Session initialized:', this.sessionId);

    // Parse SSE response
    const responseText = response.data as string;
    const lines = responseText.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.substring(6));
        console.log('Server info:', data.result);
      }
    }
  }

  async query(query: string, context?: any) {
    if (!this.sessionId) {
      throw new Error('Session not initialized');
    }

    const response = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'query',
          arguments: {
            query,
            ...(context && { context }),
          },
        },
        id: Date.now(),
      },
      {
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
          'Mcp-Session-Id': this.sessionId,
        },
      },
    );

    // Parse SSE response
    const responseText = response.data as string;
    const lines = responseText.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.substring(6));
        if (data.result?.content?.[0]?.text) {
          return data.result.content[0].text;
        }
      }
    }

    throw new Error('No response received');
  }

  async close() {
    if (!this.sessionId) return;

    await axios.delete(MCP_URL, {
      headers: {
        'Mcp-Session-Id': this.sessionId,
      },
    });

    console.log('🔚 Session closed');
  }
}

async function testStatefulMCP() {
  const client = new MCPClient();

  try {
    // Initialize session
    await client.initialize();

    console.log('\n📍 Test 1: Query without user context');
    try {
      const response1 = await client.query('How do I deploy to Kubernetes?');
      console.log('Response:', response1);
    } catch (error: any) {
      console.log('Error:', error.message);
    }

    console.log('\n📍 Test 2: Query with user context');
    try {
      const response2 = await client.query('How do I deploy to Kubernetes?', {
        user: {
          id: 'test-user',
          teams: ['platform', 'engineering', 'sre'],
          roles: ['developer'],
        },
      });
      console.log('Response:', response2.substring(0, 200) + '...');
    } catch (error: any) {
      console.log('Error:', error.message);
    }

    // Close session
    await client.close();
  } catch (error: any) {
    console.error('Fatal error:', error.message);
    console.error('Response:', error.response?.data);
  }
}

testStatefulMCP().catch(console.error);
