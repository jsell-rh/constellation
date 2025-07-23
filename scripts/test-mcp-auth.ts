#!/usr/bin/env tsx
/**
 * Test MCP authentication context passing
 */

import axios from 'axios';

const MCP_URL = 'http://localhost:3001/mcp';

async function testMCPAuth() {
  console.log('Testing MCP authentication context passing...\n');

  // Test 1: Query without user context (should only access public librarians)
  console.log('Test 1: Query without user context');
  try {
    const response1 = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'query',
          arguments: {
            query: 'How do I deploy to Kubernetes?',
          },
        },
        id: 1,
      },
      {
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
      },
    );
    console.log('Response:', JSON.stringify(response1.data, null, 2));
  } catch (error: any) {
    console.log('Error:', error.response?.data || error.message);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Test 2: Query with user context
  console.log('Test 2: Query WITH user context');
  try {
    const response2 = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'query',
          arguments: {
            query: 'How do I deploy to Kubernetes?',
            context: {
              user: {
                id: 'test-user',
                teams: ['platform', 'engineering', 'sre'],
                roles: ['developer'],
              },
            },
          },
        },
        id: 2,
      },
      {
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
      },
    );
    console.log('Response:', JSON.stringify(response2.data, null, 2));
  } catch (error: any) {
    console.log('Error:', error.response?.data || error.message);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Test 3: List librarians to see what's available
  console.log('Test 3: List available librarians');
  try {
    const response3 = await axios.post(
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
        id: 3,
      },
      {
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
      },
    );
    console.log('Response:', JSON.stringify(response3.data, null, 2));
  } catch (error: any) {
    console.log('Error:', error.response?.data || error.message);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Test 4: Direct query to a specific librarian
  console.log('Test 4: Direct query to kubernetes-expert with auth');
  try {
    const response4 = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'query_librarian',
          arguments: {
            librarian_id: 'kubernetes-expert',
            query: 'What are pods?',
            context: {
              user: {
                id: 'test-user',
                teams: ['sre'],
                roles: ['developer'],
              },
            },
          },
        },
        id: 4,
      },
      {
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
      },
    );
    console.log('Response:', JSON.stringify(response4.data, null, 2));
  } catch (error: any) {
    console.log('Error:', error.response?.data || error.message);
  }
}

testMCPAuth()
  .then(() => {
    console.log('\n✅ All tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
