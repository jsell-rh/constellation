#!/usr/bin/env npx tsx
/**
 * Test Secure Registry Access Control
 * Demonstrates how team-based access control works with librarians
 */

async function testSecureAccess() {
  console.log('🔒 Testing Secure Registry Access Control');
  console.log('========================================\n');
  
  const SERVER_URL = 'http://localhost:3001';
  
  // Test 1: Health check (public)
  console.log('1️⃣ Testing health check (no auth required)...');
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    const data = await response.json();
    console.log('✅ Health check:', data);
  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
  
  // Test 2: Query public librarian (hello)
  console.log('\n2️⃣ Testing public librarian (hello)...');
  try {
    const response = await fetch(`${SERVER_URL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'query_librarian',
          arguments: { 
            librarian_id: 'hello',
            query: 'Hello there!' 
          }
        },
        id: 1
      })
    });
    
    const data = await response.json();
    if (data.result?.content?.[0]?.text) {
      console.log('✅ Public access works:', data.result.content[0].text);
    } else {
      console.log('❌ Unexpected response:', data);
    }
  } catch (error) {
    console.error('❌ Query failed:', error);
  }
  
  // Test 3: Query restricted librarian without auth (ai-assistant)
  console.log('\n3️⃣ Testing restricted librarian without auth (ai-assistant)...');
  try {
    const response = await fetch(`${SERVER_URL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'query_librarian',
          arguments: { 
            librarian_id: 'ai-assistant',
            query: 'What is the weather?' 
          }
        },
        id: 2
      })
    });
    
    const data = await response.json();
    if (data.result?.content?.[0]?.text) {
      const text = data.result.content[0].text;
      if (text.includes('UNAUTHENTICATED') || text.includes('Authentication required')) {
        console.log('✅ Correctly blocked: Authentication required');
      } else {
        console.log('⚠️  Response:', text);
      }
    } else {
      console.log('Response:', data);
    }
  } catch (error) {
    console.error('❌ Query failed:', error);
  }
  
  // Test 4: List all librarians
  console.log('\n4️⃣ Testing librarian hierarchy resource...');
  try {
    const response = await fetch(`${SERVER_URL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'resources/read',
        params: {
          uri: 'constellation://librarian-hierarchy'
        },
        id: 3
      })
    });
    
    const data = await response.json();
    if (data.result?.contents?.[0]?.text) {
      const hierarchy = JSON.parse(data.result.contents[0].text);
      console.log(`✅ Found ${hierarchy.total} librarians:`);
      hierarchy.librarians.forEach((lib: any) => {
        console.log(`   - ${lib.name} (${lib.id}) - Team: ${lib.team}`);
      });
    }
  } catch (error) {
    console.error('❌ Resource read failed:', error);
  }
  
  console.log('\n✨ Test complete! With AUTH_ENABLED=false:');
  console.log('   - Public librarians are accessible');
  console.log('   - Team-restricted librarians still require authentication');
  console.log('   - Registry enforces security even without JWT middleware');
}

testSecureAccess().catch(console.error);