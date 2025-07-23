#!/usr/bin/env tsx
/**
 * Test Gemini connection directly
 */

import { createAIClientFromEnv } from '../src/ai/client';
import axios from 'axios';

async function testGeminiDirect() {
  console.log('🧪 Testing Gemini Connection\n');

  // Log environment configuration
  console.log('Environment Configuration:');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Not Set');
  console.log('OPENAI_BASE_URL:', process.env.OPENAI_BASE_URL || 'Not Set');
  console.log('OPENAI_MODEL:', process.env.OPENAI_MODEL || 'Not Set');
  console.log('AI_DEFAULT_PROVIDER:', process.env.AI_DEFAULT_PROVIDER || 'Not Set');
  console.log('\n');

  // Test 1: Direct API Call
  console.log('Test 1: Direct API Call to Gemini\n');
  if (process.env.OPENAI_BASE_URL && process.env.OPENAI_API_KEY) {
    try {
      const response = await axios.post(
        `${process.env.OPENAI_BASE_URL}/chat/completions`,
        {
          model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: 'Say hello in one word',
            },
          ],
          temperature: 0.7,
          max_tokens: 10,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        },
      );
      console.log('✅ Direct API Success:', response.data);
    } catch (error: any) {
      console.error('❌ Direct API Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Through AI Client
  console.log('Test 2: Through Constellation AI Client\n');
  try {
    const aiClient = createAIClientFromEnv();
    console.log('AI Client created successfully');
    console.log('Default provider:', aiClient.defaultProvider.name);
    console.log('Available providers:', aiClient.getAvailableProviders());

    const response = await aiClient.ask('Say hello in one word', {
      temperature: 0.7,
      max_tokens: 10,
    });
    console.log('✅ AI Client Success:', response);
  } catch (error: any) {
    console.error('❌ AI Client Error:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: JSON Response Test
  console.log('Test 3: JSON Response Test\n');
  try {
    const aiClient = createAIClientFromEnv();
    const jsonPrompt = `Respond with JSON only: {"greeting": "hello"}`;

    const response = await aiClient.ask(jsonPrompt, {
      temperature: 0,
      max_tokens: 50,
    });
    console.log('Response:', response);

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(response);
      console.log('✅ Valid JSON:', parsed);
    } catch (e) {
      console.log('⚠️  Response is not valid JSON');
    }
  } catch (error: any) {
    console.error('❌ JSON Test Error:', error.message);
  }
}

testGeminiDirect().catch(console.error);
