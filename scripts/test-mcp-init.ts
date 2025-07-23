#!/usr/bin/env tsx
import axios from 'axios';

async function testInit() {
  try {
    const response = await axios.post(
      'http://localhost:3001/mcp',
      {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '0.1.0',
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
        id: 1,
      },
      {
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        responseType: 'text',
      },
    );

    console.log('Response headers:', response.headers);
    console.log('Response data:', response.data);
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
  }
}

testInit();
