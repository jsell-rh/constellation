#!/usr/bin/env tsx
/**
 * Test raw Gemini API call to debug the issue
 */

import axios from 'axios';

async function testRawGemini() {
  const baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
  const apiKey = process.env.OPENAI_API_KEY || 'test-key';

  console.log('🧪 Testing Raw Gemini API\n');
  console.log('Base URL:', baseURL);
  console.log('API Key:', apiKey ? 'Set' : 'Not Set');
  console.log('\n');

  // Test different model names
  const modelNames = [
    'gemini-2.5-flash',
    'gemini-2.0-flash-latest',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-pro',
    'gpt-3.5-turbo', // Try OpenAI model name
  ];

  for (const model of modelNames) {
    console.log(`Testing model: ${model}`);
    try {
      const response = await axios.post(
        `${baseURL}chat/completions`,
        {
          model,
          messages: [
            {
              role: 'user',
              content: 'Say "hello" in one word only',
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
          timeout: 5000,
        },
      );

      console.log(`✅ ${model} works!`);
      console.log('Response:', response.data.choices?.[0]?.message?.content);
      break; // Found working model
    } catch (error: any) {
      console.log(`❌ ${model} failed:`, error.response?.status || error.message);
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test with different endpoints
  console.log('Testing different endpoint paths:');
  const endpoints = ['chat/completions', 'v1/chat/completions', 'completions'];

  for (const endpoint of endpoints) {
    console.log(`Testing endpoint: ${endpoint}`);
    try {
      const response = await axios.post(
        `${baseURL}${endpoint}`,
        {
          model: 'gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: 'Hello',
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
          timeout: 5000,
        },
      );

      console.log(`✅ ${endpoint} works!`);
      break;
    } catch (error: any) {
      console.log(`❌ ${endpoint} failed:`, error.response?.status || error.message);
    }
  }
}

testRawGemini().catch(console.error);
