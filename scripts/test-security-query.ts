#!/usr/bin/env tsx
/**
 * Test security query that was causing JSON parsing error
 */

import axios from 'axios';

async function testSecurityQuery() {
  console.log('🧪 Testing Security Query with JSON Fix\n');

  const MCP_URL = 'http://localhost:3335/mcp';

  const query = `hji can you look at this from security:

Def foo:
return 43`;

  console.log('Query:', query);
  console.log('\n');

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
            context: {
              user: {
                id: 'test-user',
                teams: ['engineering', 'security'],
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

    // Parse SSE response
    const lines = response.data.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6));
          if (data.result?.content?.[0]?.text) {
            console.log('✅ Success! Response received');
            console.log('Response preview:', data.result.content[0].text.substring(0, 200) + '...');
            return;
          } else if (data.error) {
            console.log('❌ Error from server:', data.error);
            return;
          }
        } catch (e) {
          // Continue to next line
        }
      }
    }

    console.log('⚠️  No valid response found in SSE stream');
  } catch (error: any) {
    console.error('❌ Request failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testSecurityQuery().catch(console.error);
