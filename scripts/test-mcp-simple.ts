#!/usr/bin/env tsx
/**
 * Simple MCP test to verify context passing
 */

import axios from 'axios';

const MCP_URL = 'http://localhost:3001/mcp';

async function testWithContext() {
  console.log('🧪 Testing MCP with user context...\n');

  const context = {
    user: {
      id: 'test-user',
      teams: ['platform', 'engineering', 'sre'],
      roles: ['developer'],
    },
  };

  console.log('📤 Sending context:', JSON.stringify(context, null, 2));

  try {
    const response = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'query',
          arguments: {
            query: 'How do I run Kubernetes?',
            context,
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

    // Parse SSE response
    const responseText = response.data as string;
    const lines = responseText.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.substring(6));
        if (data.result?.content?.[0]?.text) {
          console.log('\n✅ Response received successfully!');
          console.log('📄 Answer:', data.result.content[0].text.substring(0, 200) + '...');
          return;
        }
      }
    }
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Test without context
async function testWithoutContext() {
  console.log('\n🧪 Testing MCP without user context...\n');

  try {
    const response = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'query',
          arguments: {
            query: 'How do I run Kubernetes?',
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

    // Parse SSE response
    const responseText = response.data as string;
    const lines = responseText.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.substring(6));
        if (data.result?.content?.[0]?.text) {
          console.log('📄 Response:', data.result.content[0].text);
          return;
        }
      }
    }
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

async function main() {
  // Start the server first
  console.log('🚀 Starting Constellation MCP server...\n');
  const { spawn } = await import('child_process');
  const server = spawn('npm', ['run', 'dev'], {
    env: { ...process.env, LOG_LEVEL: 'info', AUTH_ENABLED: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Wait for server to start
  await new Promise<void>((resolve) => {
    server.stdout?.on('data', (data) => {
      if (data.toString().includes('MCP server started')) {
        resolve();
      }
    });
  });

  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Run tests
  await testWithoutContext();
  await testWithContext();

  // Cleanup
  server.kill();
  process.exit(0);
}

main().catch(console.error);
