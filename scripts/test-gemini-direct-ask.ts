#!/usr/bin/env tsx
/**
 * Test Gemini's ask method directly
 */

import { GeminiProvider } from '../src/ai/providers/gemini';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testGeminiDirectAsk() {
  console.log('🧪 Testing Gemini Ask Method Directly\n');

  const provider = new GeminiProvider({
    apiKey: process.env.OPENAI_API_KEY!,
    baseURL: process.env.OPENAI_BASE_URL!,
    model: process.env.OPENAI_MODEL || 'gemini-2.5-flash',
  });

  const prompt = `You are an expert code reviewer that is part of the Constellation distributed knowledge system.
You specialize in:
- Security vulnerability detection
- Bug identification
- Performance optimization
- Code quality and maintainability
- Best practices and design patterns

Please analyze and provide feedback on:

def get_user(id): query = "SELECT * FROM users WHERE id = " + id; return db.execute(query)

Focus on:
1. Security issues (injection, XSS, authentication flaws)
2. Potential bugs or logic errors
3. Performance concerns
4. Code readability and maintainability
5. Suggestions for improvement`;

  console.log('Testing with different max_tokens values:\n');

  const maxTokensTests = [
    { max_tokens: undefined, label: 'undefined (default)' },
    { max_tokens: 100, label: '100 (will be adjusted to 1000)' },
    { max_tokens: 1000, label: '1000' },
    { max_tokens: 2000, label: '2000' },
  ];

  for (const test of maxTokensTests) {
    console.log('-'.repeat(60));
    console.log(`Testing with max_tokens = ${test.label}:`);

    try {
      const options = {
        temperature: 0.2,
        ...(test.max_tokens !== undefined && { max_tokens: test.max_tokens }),
      };

      console.log('Options:', options);

      const response = await provider.ask(prompt, options);

      console.log('Response length:', response.length);
      console.log(
        'Response preview:',
        response.substring(0, 200) + (response.length > 200 ? '...' : ''),
      );
      console.log('Is empty?', response.trim().length === 0);
    } catch (error: any) {
      console.log('Error:', error.message);
    }
  }
}

testGeminiDirectAsk().catch(console.error);
