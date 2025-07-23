#!/usr/bin/env tsx
/**
 * Test JWT Authentication
 * Demonstrates how to authenticate with the MCP server using JWT tokens
 */

import { generateToken } from '../src/auth/jwt-middleware';

// Configuration
const SERVER_URL = 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Test users
const users = {
  alice: {
    id: 'user-123',
    email: 'alice@example.com',
    teams: ['platform', 'sre'],
    roles: ['developer']
  },
  bob: {
    id: 'user-456', 
    email: 'bob@example.com',
    teams: ['hr'],
    roles: ['hr-admin']
  },
  charlie: {
    id: 'user-789',
    email: 'charlie@example.com',
    teams: ['finance'],
    roles: ['finance-analyst']
  }
};

async function testHealthCheck() {
  console.log('\n🏥 Testing health check (no auth required)...');
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    const data = await response.json();
    console.log('✅ Health check:', data);
  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
}

async function testMCPWithoutAuth() {
  console.log('\n🔒 Testing MCP without authentication...');
  try {
    const response = await fetch(`${SERVER_URL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'query',
          arguments: { query: 'What is the weather?' }
        },
        id: 1
      })
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    if (response.status === 401) {
      console.log('✅ Correctly rejected (401 Unauthorized)');
    } else {
      console.log('❌ Should have been rejected!');
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

async function testMCPWithAuth(userName: keyof typeof users) {
  const user = users[userName];
  console.log(`\n👤 Testing MCP as ${userName} (teams: ${user.teams.join(', ')})...`);
  
  // Generate JWT token
  const token = generateToken(user, JWT_SECRET);
  console.log(`🎫 Generated JWT token (first 20 chars): ${token.substring(0, 20)}...`);
  
  try {
    const response = await fetch(`${SERVER_URL}/mcp`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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
            name: 'test-client',
            version: '1.0.0'
          }
        },
        id: 1
      })
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    
    if (response.status === 200) {
      console.log('✅ Successfully authenticated');
      console.log('Server capabilities:', data.result?.capabilities);
    } else {
      console.log('❌ Authentication failed:', data);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

async function testQueryTool(userName: keyof typeof users, query: string) {
  const user = users[userName];
  console.log(`\n🔍 Testing query tool as ${userName}...`);
  console.log(`Query: "${query}"`);
  
  const token = generateToken(user, JWT_SECRET);
  
  try {
    const response = await fetch(`${SERVER_URL}/mcp`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'query',
          arguments: { query }
        },
        id: 2
      })
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    
    if (data.result) {
      console.log('✅ Query succeeded:', data.result.content?.[0]?.text || 'No response');
    } else {
      console.log('❌ Query failed:', data.error || data);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

async function main() {
  console.log('🧪 Testing JWT Authentication with Constellation MCP Server');
  console.log('=======================================================');
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`JWT Secret: ${JWT_SECRET === 'test-secret' ? 'test-secret (default)' : 'custom'}`);
  
  // Check if auth is enabled
  if (process.env.AUTH_ENABLED !== 'true') {
    console.log('\n⚠️  WARNING: AUTH_ENABLED is not set to true');
    console.log('Set AUTH_ENABLED=true in your .env file to test authentication');
  }
  
  await testHealthCheck();
  await testMCPWithoutAuth();
  await testMCPWithAuth('alice');
  await testMCPWithAuth('bob');
  
  // Test actual queries
  await testQueryTool('alice', 'Hello world');
  await testQueryTool('bob', 'Show me employee data');  // Should work if HR librarian allows
}

main().catch(console.error);