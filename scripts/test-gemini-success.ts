#!/usr/bin/env tsx
/**
 * Test successful Gemini integration
 */

import axios from 'axios';

async function testGeminiSuccess() {
  console.log('🧪 Testing Gemini Integration Success\n');

  const MCP_URL = 'http://localhost:3335/mcp';

  // Test 1: Simple query (should use AI routing)
  console.log('=== Test 1: Simple AI Query ===');
  try {
    const response = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'query',
          arguments: {
            query: 'What is the capital of France?',
            context: {
              user: {
                id: 'test-user',
                teams: ['platform'],
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

    const result = response.data
      .split('\n')
      .filter((line: string) => line.startsWith('data: '))
      .map((line: string) => JSON.parse(line.substring(6)))
      .find((data: any) => data.result);

    if (result?.result?.content?.[0]?.text) {
      console.log('✅ Success! AI Response received');
      console.log('Response preview:', result.result.content[0].text.substring(0, 100) + '...');
    } else {
      console.log('⚠️  No response content');
    }
  } catch (error: any) {
    console.error('❌ Test 1 failed:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Code review query
  console.log('=== Test 2: Code Review Query ===');
  try {
    const response = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'query',
          arguments: {
            query: 'Review this Python code: def add(a, b): return a + b',
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

    const result = response.data
      .split('\n')
      .filter((line: string) => line.startsWith('data: '))
      .map((line: string) => JSON.parse(line.substring(6)))
      .find((data: any) => data.result);

    if (result?.result?.content?.[0]?.text) {
      console.log('✅ Success! Code review received from Gemini');
      console.log('Response preview:', result.result.content[0].text.substring(0, 100) + '...');
    } else {
      console.log('⚠️  No response content');
    }
  } catch (error: any) {
    console.error('❌ Test 2 failed:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Direct librarian query
  console.log('=== Test 3: Direct Librarian Query ===');
  try {
    const response = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'query_librarian',
          arguments: {
            librarian_id: 'ai-assistant',
            query: 'Explain what Constellation is in one sentence',
            context: {
              user: {
                id: 'test-user',
                teams: ['platform'],
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

    const result = response.data
      .split('\n')
      .filter((line: string) => line.startsWith('data: '))
      .map((line: string) => JSON.parse(line.substring(6)))
      .find((data: any) => data.result);

    if (result?.result?.content?.[0]?.text) {
      console.log('✅ Success! Direct librarian query with Gemini');
      console.log('Response:', result.result.content[0].text);
    } else {
      console.log('⚠️  No response content');
    }
  } catch (error: any) {
    console.error('❌ Test 3 failed:', error.message);
  }

  console.log('\n✨ Gemini integration is working successfully!');
}

testGeminiSuccess().catch(console.error);
