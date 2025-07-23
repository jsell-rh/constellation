#!/usr/bin/env tsx
/**
 * Simple test to debug Gemini issue
 */

import axios from 'axios';

async function testSimpleQuery() {
  console.log('🧪 Testing Simple Query\n');

  const MCP_URL = 'http://localhost:3335/mcp';

  try {
    const response = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'query',
          arguments: {
            query: 'Please analyze this code: def foo(): return 3',
            context: {
              user: {
                id: 'test-user',
                teams: ['engineering'],
                roles: ['developer'],
              },
            },
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

    console.log('Response received:', response.data);
  } catch (error: any) {
    console.error('Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
  }
}

testSimpleQuery();
