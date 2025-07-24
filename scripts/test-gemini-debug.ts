#!/usr/bin/env tsx
/**
 * Debug Gemini empty responses
 */

import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function debugGemini() {
  console.log('🧪 Debugging Gemini Empty Responses\n');

  const baseURL = process.env.OPENAI_BASE_URL!;
  const apiKey = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_MODEL || 'gemini-2.5-flash';

  const client = new OpenAI({
    apiKey,
    baseURL,
  });

  // Test different prompts and configurations
  const tests = [
    {
      name: 'Simple hello',
      messages: [{ role: 'user' as const, content: 'Say hello' }],
      max_tokens: 10,
    },
    {
      name: 'Haiku',
      messages: [{ role: 'user' as const, content: 'Write a haiku about code' }],
      max_tokens: 100,
    },
    {
      name: 'Code review (short)',
      messages: [{ role: 'user' as const, content: 'Review this code: def add(a,b): return a+b' }],
      max_tokens: 200,
    },
    {
      name: 'Code review (security)',
      messages: [
        {
          role: 'user' as const,
          content:
            'Find security issues in: def get_user(id): query = "SELECT * FROM users WHERE id = " + id; return db.execute(query)',
        },
      ],
      max_tokens: 500,
    },
    {
      name: 'Long prompt',
      messages: [
        {
          role: 'user' as const,
          content: `You are an expert code reviewer. Please analyze this code:
def get_user(id):
  query = "SELECT * FROM users WHERE id = " + id
  return db.execute(query)

Focus on security issues.`,
        },
      ],
      max_tokens: 1000,
    },
  ];

  for (const test of tests) {
    console.log('='.repeat(60));
    console.log('Test:', test.name);
    console.log('Max tokens:', test.max_tokens);
    console.log('-'.repeat(60));

    try {
      const completion = await client.chat.completions.create({
        model,
        messages: test.messages,
        temperature: 0.7,
        max_tokens: test.max_tokens,
        top_p: 1,
        presence_penalty: 0,
      });

      const response = completion.choices[0]?.message?.content || '';
      console.log('Response:', response || '[EMPTY]');
      console.log('Response length:', response.length);
      console.log('Finish reason:', completion.choices[0]?.finish_reason);
      console.log('Usage:', completion.usage);

      if (!response) {
        console.log('⚠️  Empty response detected!');
        console.log('Full completion object:', JSON.stringify(completion, null, 2));
      }
    } catch (error: any) {
      console.log('❌ Error:', error.message);
    }
  }
}

debugGemini().catch(console.error);
