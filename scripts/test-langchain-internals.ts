#!/usr/bin/env tsx
/**
 * Deep dive into LangChain internals to understand Gemini issue
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Patch fetch to intercept all HTTP requests
const originalFetch = global.fetch;
global.fetch = async function (...args: any[]) {
  console.log('\n🔍 Intercepted fetch request:');
  const [url, options] = args;
  console.log('URL:', url);
  console.log('Method:', options?.method || 'GET');
  console.log('Headers:', options?.headers);
  if (options?.body) {
    console.log(
      'Body:',
      typeof options.body === 'string' ? JSON.parse(options.body) : options.body,
    );
  }

  try {
    const response = await originalFetch(...args);
    const clonedResponse = response.clone();
    const text = await clonedResponse.text();
    console.log('✅ Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    try {
      console.log('Response body:', JSON.parse(text));
    } catch {
      console.log('Response body (text):', text);
    }
    return response;
  } catch (error: any) {
    console.log('❌ Request failed:', error.message);
    throw error;
  }
};

async function testLangChainInternals() {
  console.log('🧪 Testing LangChain Internals with Gemini\n');

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
  console.log('API Key:', apiKey ? 'Set' : 'Not Set');
  console.log('\n');

  // Test with very simple configuration
  console.log('=== Test: LangChain with Minimal Config ===');
  try {
    const llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: model,
      temperature: 0.7,
      maxTokens: 100, // Increase from 10
      configuration: {
        baseURL,
      },
    });

    // Enable verbose mode
    llm.verbose = true;

    const response = await llm.invoke([new HumanMessage('Say hello')]);
    console.log('✅ Success! Response:', response.content);
  } catch (error: any) {
    console.log('❌ Failed:', error.message);
    console.log('Full error:', error);
  }
}

testLangChainInternals().catch(console.error);
