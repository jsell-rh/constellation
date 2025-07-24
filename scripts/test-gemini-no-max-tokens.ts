#!/usr/bin/env tsx
/**
 * Test Gemini without max_tokens parameter
 */

import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testGeminiNoMaxTokens() {
  console.log('🧪 Testing Gemini Without max_tokens\n');

  const baseURL = process.env.OPENAI_BASE_URL!;
  const apiKey = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_MODEL || 'gemini-2.5-flash';

  const client = new OpenAI({
    apiKey,
    baseURL,
  });

  const tests = [
    'Say hello',
    'Write a haiku about code',
    'Review this code: def add(a,b): return a+b',
    'Find security issues in: def get_user(id): query = "SELECT * FROM users WHERE id = " + id; return db.execute(query)',
  ];

  console.log('Testing WITHOUT max_tokens:\n');

  for (const prompt of tests) {
    console.log('-'.repeat(60));
    console.log('Prompt:', prompt.substring(0, 50) + '...');

    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        // NO max_tokens parameter
      });

      const response = completion.choices[0]?.message?.content || '';
      console.log('Response:', response ? response.substring(0, 100) + '...' : '[EMPTY]');
      console.log('Response length:', response.length);
      console.log('Finish reason:', completion.choices[0]?.finish_reason);
    } catch (error: any) {
      console.log('❌ Error:', error.message);
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');
  console.log('Testing WITH various max_tokens values:\n');

  const maxTokensValues = [null, undefined, 0, -1, 50, 100, 1000, 4096];

  for (const maxTokens of maxTokensValues) {
    console.log(`Testing with max_tokens = ${maxTokens}:`);

    try {
      const config: any = {
        model,
        messages: [{ role: 'user', content: 'Write one sentence about AI' }],
        temperature: 0.7,
      };

      if (maxTokens !== null && maxTokens !== undefined) {
        config.max_tokens = maxTokens;
      }

      const completion = await client.chat.completions.create(config);
      const response = completion.choices[0]?.message?.content || '';
      console.log(
        `  Response: ${response ? 'Got response (' + response.length + ' chars)' : '[EMPTY]'}`,
      );
      console.log(`  Finish reason: ${completion.choices[0]?.finish_reason}`);
    } catch (error: any) {
      console.log(`  Error: ${error.message}`);
    }
  }
}

testGeminiNoMaxTokens().catch(console.error);
