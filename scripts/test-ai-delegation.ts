#!/usr/bin/env tsx
/**
 * Test AI delegation with code review query
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

async function testCodeReview() {
  console.log('🧪 Testing AI Delegation with Code Review Query\n');

  const query = `can you take a look at thse here thingies and tell me what ya think?

Def foo:
return 3`;

  const context = {
    user: {
      id: 'test-user',
      teams: ['platform', 'engineering', 'sre'],
      roles: ['developer'],
    },
  };

  console.log('📝 Query:', query);
  console.log('\n👤 User context:', JSON.stringify(context, null, 2));

  try {
    const response = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'query',
          arguments: {
            query,
            context,
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
    if (parsed?.result?.content?.[0]?.text) {
      console.log('\n✅ Response received!');
      console.log('📄 Answer:', parsed.result.content[0].text.substring(0, 500) + '...');

      // Check which librarian was used (from metadata if available)
      if (parsed.result.metadata?.librarian) {
        console.log('\n🎯 Routed to librarian:', parsed.result.metadata.librarian);
      }
    } else if (parsed?.error) {
      console.log('\n❌ Error:', parsed.error.code, '-', parsed.error.message);
    } else {
      console.log('\n❓ Unexpected response:', JSON.stringify(parsed, null, 2));
    }
  } catch (error: any) {
    console.error('\n💥 Request failed:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }

  // Check the logs to see if AI routing was used
  console.log('\n📋 Checking server logs for AI routing...');
  const { execSync } = await import('child_process');
  try {
    const logs = execSync(
      'tail -50 mcp-server-debug.log | grep -E "(AI|ai-powered|Using AI|AI analysis)" || true',
      { encoding: 'utf-8' },
    );
    if (logs.trim()) {
      console.log('🤖 AI routing logs found:');
      console.log(logs);
    } else {
      console.log('⚠️  No AI routing logs found - may be using simple routing');
    }
  } catch (e) {
    console.log('⚠️  Could not check logs');
  }
}

testCodeReview().catch(console.error);
