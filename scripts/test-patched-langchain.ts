#!/usr/bin/env tsx
/**
 * Test our patched LangChain implementation
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testPatchedLangChain() {
  console.log('🧪 Testing Patched LangChain Implementation\n');

  const baseURL =
    process.env.OPENAI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
  const apiKey = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_MODEL || 'gemini-2.5-flash';

  console.log('Configuration:');
  console.log('Base URL:', baseURL);
  console.log('Model:', model);
  console.log('\n');

  // Create instance like our provider does
  const llm = new ChatOpenAI({
    openAIApiKey: apiKey,
    modelName: model,
    temperature: 0.7,
    maxTokens: 100,
    streaming: false,
    configuration: {
      baseURL: baseURL,
      defaultHeaders: {},
      defaultQuery: {},
    },
    modelKwargs: {
      temperature: 0.7,
      max_tokens: 100,
      top_p: 1,
      presence_penalty: 0,
    },
  });

  // Apply our patch
  const originalInvoke = llm.invoke.bind(llm);
  (llm as any).invoke = async function (messages: any, options?: any) {
    console.log('🔍 Intercepted invoke call');
    console.log('Options before patch:', JSON.stringify(options, null, 2));

    // Remove frequency_penalty from options if present
    if (options?.frequency_penalty !== undefined) {
      console.log('Removing frequency_penalty from options');
      delete options.frequency_penalty;
    }
    // Also check model_kwargs
    if (options?.model_kwargs?.frequency_penalty !== undefined) {
      console.log('Removing frequency_penalty from model_kwargs');
      delete options.model_kwargs.frequency_penalty;
    }

    console.log('Options after patch:', JSON.stringify(options, null, 2));

    return originalInvoke(messages, options);
  };

  // Test the patched instance
  console.log('=== Testing Patched LangChain ===');
  try {
    const response = await llm.invoke([new HumanMessage('Say hello')]);
    console.log('✅ Success! Response:', response.content);
  } catch (error: any) {
    console.log('❌ Failed:', error.message);
    console.log('Error details:', {
      status: error.status,
      headers: error.headers,
      error: error.error,
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test with bind like our provider does
  console.log('=== Testing with bind ===');
  try {
    const bindOptions: any = {
      maxTokens: 100,
      temperature: 0.7,
    };

    // Don't include frequency_penalty
    delete bindOptions.frequencyPenalty;

    const boundLlm = llm.bind(bindOptions);

    const response = await boundLlm.invoke([new HumanMessage('Say hello')]);
    console.log('✅ Success with bind! Response:', response.content);
  } catch (error: any) {
    console.log('❌ Failed with bind:', error.message);
  }
}

testPatchedLangChain().catch(console.error);
