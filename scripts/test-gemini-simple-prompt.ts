#!/usr/bin/env tsx
/**
 * Test Gemini with simple prompts
 */

import { createAIClientFromEnv } from '../src/ai/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testGeminiSimple() {
  console.log('🧪 Testing Gemini with Simple Prompts\n');

  try {
    const aiClient = createAIClientFromEnv();
    console.log('✅ AI client created\n');

    const prompts = [
      'Say hello',
      'What is 2+2?',
      'Write a haiku about code',
      'List 3 programming languages',
    ];

    for (const prompt of prompts) {
      console.log('-'.repeat(60));
      console.log('Prompt:', prompt);

      try {
        const response = await aiClient.ask(prompt, {
          temperature: 0.7,
          max_tokens: 100,
        });

        console.log('Response:', response || '[EMPTY]');
        console.log('Length:', response.length);
      } catch (error: any) {
        console.log('Error:', error.message);
      }
    }

    // Now test the complete method directly
    console.log('\n' + '='.repeat(60));
    console.log('Testing complete() method directly:\n');

    const messages = [{ role: 'user' as const, content: 'What is the capital of France?' }];

    const completeResponse = await aiClient.complete(messages, {
      temperature: 0.7,
      max_tokens: 100,
    });

    console.log('Complete response:', completeResponse);
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
  }
}

testGeminiSimple().catch(console.error);
