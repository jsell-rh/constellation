#!/usr/bin/env tsx
/**
 * Test to intercept the exact request LangChain makes
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Intercept HTTPS requests
const originalRequest = https.request;
(https as any).request = function (options: any, callback?: any) {
  console.log('\n🔍 Intercepted HTTPS request:');
  console.log('Method:', options.method);
  console.log('Host:', options.host || options.hostname);
  console.log('Path:', options.path);
  console.log('Headers:', options.headers);

  const req = originalRequest.call(https, options, callback);

  const originalWrite = req.write;
  req.write = function (data: any) {
    console.log('Body:', typeof data === 'string' ? data : data.toString());
    try {
      const parsed = JSON.parse(data.toString());
      console.log('Parsed body:', JSON.stringify(parsed, null, 2));
    } catch {}
    return originalWrite.call(req, data);
  };

  return req;
};

async function testLangChainRequest() {
  console.log('🧪 Testing LangChain Request Details\n');

  const baseURL =
    process.env.OPENAI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY is not set!');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log('Base URL:', baseURL);
  console.log('Model:', model);
  console.log('\n');

  // Test with our exact configuration
  console.log('=== Testing with Constellation Config ===');
  try {
    const llmConfig: any = {
      openAIApiKey: apiKey,
      modelName: model,
      temperature: 0.2,
      maxTokens: 1000,
      configuration: {
        baseURL,
      },
      // Gemini overrides
      streaming: false,
      timeout: 30000,
      frequencyPenalty: undefined,
      presencePenalty: 0,
      topP: 1,
    };

    const llm = new ChatOpenAI(llmConfig);

    const response = await llm.invoke([
      new HumanMessage('You are a code reviewer. Please say hello.'),
    ]);

    console.log('✅ Success! Response:', response.content);
  } catch (error: any) {
    console.log('❌ Failed:', error.message);
    console.log('Error details:', {
      status: error.status,
      headers: error.headers,
      body: error.error,
    });
  }
}

testLangChainRequest().catch(console.error);
