#!/usr/bin/env tsx
/**
 * Test frequency penalty handling
 */

import OpenAI from 'openai';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testFrequencyPenalty() {
  console.log('🧪 Testing Frequency Penalty Handling\n');

  const baseURL =
    process.env.OPENAI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
  const apiKey = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_MODEL || 'gemini-2.5-flash';

  console.log('Configuration:');
  console.log('Base URL:', baseURL);
  console.log('Model:', model);
  console.log('\n');

  // Test 1: OpenAI SDK without frequency_penalty
  console.log('=== Test 1: OpenAI SDK (no frequency_penalty) ===');
  try {
    const openai = new OpenAI({ apiKey, baseURL });
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Hi' }],
      temperature: 0.2,
      max_tokens: 100,
      // No frequency_penalty
    });
    console.log('✅ Works without frequency_penalty');
  } catch (error: any) {
    console.log('❌ Failed:', error.message);
  }

  // Test 2: OpenAI SDK with frequency_penalty = null
  console.log('\n=== Test 2: OpenAI SDK (frequency_penalty = null) ===');
  try {
    const openai = new OpenAI({ apiKey, baseURL });
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Hi' }],
      temperature: 0.2,
      max_tokens: 100,
      frequency_penalty: null as any,
    });
    console.log('✅ Works with frequency_penalty = null');
  } catch (error: any) {
    console.log('❌ Failed:', error.message);
  }

  // Test 3: OpenAI SDK with frequency_penalty = undefined
  console.log('\n=== Test 3: OpenAI SDK (frequency_penalty = undefined) ===');
  try {
    const openai = new OpenAI({ apiKey, baseURL });
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Hi' }],
      temperature: 0.2,
      max_tokens: 100,
      frequency_penalty: undefined,
    });
    console.log('✅ Works with frequency_penalty = undefined');
  } catch (error: any) {
    console.log('❌ Failed:', error.message);
  }

  // Test 4: LangChain without any penalty settings
  console.log('\n=== Test 4: LangChain (no penalty settings) ===');
  try {
    const llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: model,
      temperature: 0.2,
      maxTokens: 100,
      configuration: { baseURL },
    });
    const response = await llm.invoke([new HumanMessage('Hi')]);
    console.log('✅ Works without penalty settings');
  } catch (error: any) {
    console.log('❌ Failed:', error.message);
  }

  // Test 5: LangChain with frequencyPenalty = null
  console.log('\n=== Test 5: LangChain (frequencyPenalty = null) ===');
  try {
    const llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: model,
      temperature: 0.2,
      maxTokens: 100,
      configuration: { baseURL },
      frequencyPenalty: null as any,
    });
    const response = await llm.invoke([new HumanMessage('Hi')]);
    console.log('✅ Works with frequencyPenalty = null');
  } catch (error: any) {
    console.log('❌ Failed:', error.message);
  }

  // Test 6: Using bind to override
  console.log('\n=== Test 6: LangChain with bind override ===');
  try {
    const llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: model,
      configuration: { baseURL },
    });

    const boundLlm = llm.bind({
      temperature: 0.2,
      maxTokens: 100,
      frequencyPenalty: null,
    });

    const response = await boundLlm.invoke([new HumanMessage('Hi')]);
    console.log('✅ Works with bind override');
  } catch (error: any) {
    console.log('❌ Failed:', error.message);
  }
}

testFrequencyPenalty().catch(console.error);
