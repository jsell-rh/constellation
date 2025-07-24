#!/usr/bin/env tsx
/**
 * Test Gemini with default configuration
 */

import { GeminiProvider } from '../src/ai/providers/gemini';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testGeminiDefault() {
  console.log('🧪 Testing Gemini Default Configuration\n');

  // Test 1: Provider with defaults
  console.log('Test 1: Provider with all defaults');
  const provider1 = new GeminiProvider({
    apiKey: process.env.OPENAI_API_KEY!,
    baseURL: process.env.OPENAI_BASE_URL!,
    model: process.env.OPENAI_MODEL || 'gemini-2.5-flash',
  });

  try {
    const response1 = await provider1.ask('Say hello', { temperature: 0.2 });
    console.log('Response length:', response1.length);
    console.log('Empty?', response1.trim().length === 0);
  } catch (error: any) {
    console.log('Error:', error.message);
  }

  console.log('\n' + '-'.repeat(60) + '\n');

  // Test 2: Provider with explicit maxTokens
  console.log('Test 2: Provider with explicit maxTokens=2048');
  const provider2 = new GeminiProvider({
    apiKey: process.env.OPENAI_API_KEY!,
    baseURL: process.env.OPENAI_BASE_URL!,
    model: process.env.OPENAI_MODEL || 'gemini-2.5-flash',
    maxTokens: 2048,
  });

  try {
    const response2 = await provider2.ask('Say hello', { temperature: 0.2 });
    console.log('Response length:', response2.length);
    console.log('Empty?', response2.trim().length === 0);
  } catch (error: any) {
    console.log('Error:', error.message);
  }

  console.log('\n' + '-'.repeat(60) + '\n');

  // Test 3: Provider with no default, no options
  console.log('Test 3: Provider with maxTokens undefined in both config and options');
  const provider3 = new GeminiProvider({
    apiKey: process.env.OPENAI_API_KEY!,
    baseURL: process.env.OPENAI_BASE_URL!,
    model: process.env.OPENAI_MODEL || 'gemini-2.5-flash',
    maxTokens: undefined,
  });

  try {
    const response3 = await provider3.ask('Say hello', { temperature: 0.2 });
    console.log('Response length:', response3.length);
    console.log('Empty?', response3.trim().length === 0);
  } catch (error: any) {
    console.log('Error:', error.message);
  }
}

testGeminiDefault().catch(console.error);
