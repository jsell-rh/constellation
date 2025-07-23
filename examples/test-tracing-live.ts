#!/usr/bin/env npx tsx
/**
 * Test Tracing with Live Server
 * Makes requests to the running server to verify tracing is working
 */

async function testLiveTracing() {
  console.log('🔍 Testing Live Server Tracing');
  console.log('=============================\n');
  
  const SERVER_URL = 'http://localhost:3001';
  
  // Test 1: Health check
  console.log('1️⃣ Testing health check...');
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    const data = await response.json();
    console.log('✅ Server is healthy:', data);
  } catch (error) {
    console.error('❌ Health check failed:', error);
    return;
  }
  
  // Test 2: Query a public librarian (hello)
  console.log('\n2️⃣ Testing public librarian query...');
  try {
    // First get capabilities to work with MCP protocol
    const initResponse = await fetch(`${SERVER_URL}/mcp`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: true,
            resources: true
          },
          clientInfo: {
            name: 'tracing-test',
            version: '1.0.0'
          }
        },
        id: 1
      })
    });
    
    const initData = await initResponse.json();
    console.log('MCP initialized:', initData.result?.protocolVersion);
    
    // Now query the hello librarian
    const queryResponse = await fetch(`${SERVER_URL}/mcp`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'query_librarian',
          arguments: { 
            librarian_id: 'hello',
            query: 'Hello from tracing test!' 
          }
        },
        id: 2
      })
    });
    
    const queryData = await queryResponse.json();
    console.log('Query response:', queryData.result?.content?.[0]?.text || queryData);
    
  } catch (error) {
    console.error('❌ Query failed:', error);
  }
  
  // Test 3: Multiple rapid queries (to see concurrent traces)
  console.log('\n3️⃣ Testing multiple concurrent queries...');
  try {
    const queries = [
      { id: 'hello', query: 'Hi 1' },
      { id: 'docs', query: 'What is a librarian?' },
      { id: 'hello', query: 'Hi 2' },
    ];
    
    const promises = queries.map(async (q, index) => {
      const response = await fetch(`${SERVER_URL}/mcp`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'query_librarian',
            arguments: { 
              librarian_id: q.id,
              query: q.query 
            }
          },
          id: 10 + index
        })
      });
      
      const data = await response.json();
      return {
        query: q.query,
        response: data.result?.content?.[0]?.text?.substring(0, 50) || 'No response'
      };
    });
    
    const results = await Promise.all(promises);
    results.forEach(r => {
      console.log(`   "${r.query}" → "${r.response}..."`);
    });
    
  } catch (error) {
    console.error('❌ Concurrent queries failed:', error);
  }
  
  console.log('\n✨ Live tracing test complete!');
  console.log('\n📊 Check the server logs for trace output.');
  console.log('   You should see debug logs showing:');
  console.log('   - Span creation for each query');
  console.log('   - Trace IDs and durations');
  console.log('   - Attributes like librarian ID and user info');
}

testLiveTracing().catch(console.error);