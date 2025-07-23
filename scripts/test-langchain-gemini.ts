#!/usr/bin/env tsx
/**
 * Test LangChain with Gemini to understand the exact issue
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Monkey patch axios to log requests
const originalPost = axios.post;
axios.post = async function (...args: any[]) {
  console.log('\n🔍 Intercepted axios request:');
  console.log('URL:', args[0]);
  console.log('Body:', JSON.stringify(args[1], null, 2));
  console.log('Headers:', args[2]?.headers);

  try {
    const result = await originalPost.apply(axios, args);
    console.log('✅ Response status:', result.status);
    console.log('Response data:', JSON.stringify(result.data, null, 2));
    return result;
  } catch (error: any) {
    console.log('❌ Request failed:', error.response?.status);
    console.log('Error response:', JSON.stringify(error.response?.data, null, 2));
    console.log('Error headers:', error.response?.headers);
    throw error;
  }
};

async function testLangChainGemini() {
  console.log('🧪 Testing LangChain with Gemini\n');

  const baseURL =
    process.env.OPENAI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY is not set!');
    console.error('Please set it with: export OPENAI_API_KEY=your-gemini-api-key');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log('Base URL:', baseURL);
  console.log('Model:', model);
  console.log('API Key:', apiKey ? 'Set' : 'Not Set');
  console.log('\n');

  // Test 1: Raw API call (known to work)
  console.log('=== Test 1: Raw API Call ===');
  try {
    const response = await axios.post(
      `${baseURL}chat/completions`,
      {
        model,
        messages: [
          {
            role: 'user',
            content: 'Say hello',
          },
        ],
        temperature: 0.7,
        max_tokens: 10,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const content =
      response.data.choices?.[0]?.message?.content ||
      response.data.candidates?.[0]?.content?.parts?.[0]?.text ||
      'No content found';
    console.log('✅ Raw API works! Response:', content);
  } catch (error: any) {
    console.log('❌ Raw API failed:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: LangChain with minimal config
  console.log('=== Test 2: LangChain Minimal Config ===');
  try {
    const llm1 = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: model,
      configuration: {
        baseURL,
      },
    });

    const response1 = await llm1.invoke([new HumanMessage('Say hello')]);
    console.log('✅ LangChain minimal works!', response1.content);
  } catch (error: any) {
    console.log('❌ LangChain minimal failed:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: LangChain with full config (like our provider)
  console.log('=== Test 3: LangChain Full Config ===');
  try {
    const llm2 = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: model,
      temperature: 0.7,
      maxTokens: 10,
      configuration: {
        baseURL,
      },
      streaming: false,
      timeout: 30000,
    });

    const response2 = await llm2.invoke([new HumanMessage('Say hello')]);
    console.log('✅ LangChain full works!', response2.content);
  } catch (error: any) {
    console.log('❌ LangChain full failed:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 4: Different base URL formats
  console.log('=== Test 4: Testing Base URL Formats ===');
  const baseURLVariants = [
    baseURL,
    baseURL.replace(/\/$/, ''), // Remove trailing slash
    'https://generativelanguage.googleapis.com/v1beta/openai',
    'https://generativelanguage.googleapis.com/v1beta/openai/v1',
  ];

  for (const url of baseURLVariants) {
    console.log(`\nTrying base URL: ${url}`);
    try {
      const llm = new ChatOpenAI({
        openAIApiKey: apiKey,
        modelName: model,
        configuration: {
          baseURL: url,
        },
      });

      const response = await llm.invoke([new HumanMessage('Say hello')]);
      console.log(`✅ Works with URL: ${url}`);
      break;
    } catch (error: any) {
      console.log(`❌ Failed with URL: ${url} - ${error.message}`);
    }
  }
}

testLangChainGemini().catch(console.error);
