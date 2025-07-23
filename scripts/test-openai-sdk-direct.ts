#!/usr/bin/env tsx
/**
 * Test OpenAI SDK directly to understand the issue
 */

import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testOpenAISDK() {
  console.log('🧪 Testing OpenAI SDK with Gemini\n');

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

  // Test 1: Default OpenAI SDK usage
  console.log('=== Test 1: OpenAI SDK with Gemini ===');
  try {
    const openai = new OpenAI({
      apiKey,
      baseURL,
    });

    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Say hello' }],
      temperature: 0.7,
      max_tokens: 100,
    });

    console.log('✅ Success!');
    console.log('Response:', completion.choices[0]?.message?.content);
    console.log('Full response:', JSON.stringify(completion, null, 2));
  } catch (error: any) {
    console.log('❌ Failed:', error.message);
    console.log('Error status:', error.status);
    console.log('Error headers:', error.headers);
    console.log('Error body:', error.error);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: With different configurations
  console.log('=== Test 2: Different Configurations ===');

  const configs = [
    { stream: false },
    { n: 1 },
    { top_p: 1 },
    { frequency_penalty: 0 },
    { presence_penalty: 0 },
  ];

  for (const extraConfig of configs) {
    console.log(`\nTesting with:`, extraConfig);
    try {
      const openai = new OpenAI({
        apiKey,
        baseURL,
      });

      const completion = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'Hi' }],
        temperature: 0.7,
        max_tokens: 50,
        ...extraConfig,
      });

      console.log('✅ Works with config:', extraConfig);
    } catch (error: any) {
      console.log('❌ Fails with config:', extraConfig, '-', error.message);
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Minimal request
  console.log('=== Test 3: Minimal Request ===');
  try {
    const openai = new OpenAI({
      apiKey,
      baseURL,
    });

    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Hi' }],
    });

    console.log('✅ Minimal request works!');
    console.log('Response:', completion.choices[0]?.message?.content);
  } catch (error: any) {
    console.log('❌ Minimal request failed:', error.message);
  }
}

testOpenAISDK().catch(console.error);
