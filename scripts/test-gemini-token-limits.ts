#!/usr/bin/env tsx
/**
 * Test Gemini token limits more comprehensively
 */

import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testGeminiTokenLimits() {
  console.log('🧪 Testing Gemini Token Limits\n');

  const baseURL = process.env.OPENAI_BASE_URL!;
  const apiKey = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_MODEL || 'gemini-2.5-flash';

  const client = new OpenAI({
    apiKey,
    baseURL,
  });

  // Test with simple prompt first
  const simplePrompt = 'Write a haiku about code';

  console.log('Testing simple prompt with different max_tokens values:\n');

  const tokenTests = [undefined, 100, 500, 1000, 1500, 2000, 2048, 3000, 4096, 8192];

  for (const maxTokens of tokenTests) {
    console.log('-'.repeat(60));
    console.log(`max_tokens: ${maxTokens}`);

    try {
      const config: any = {
        model,
        messages: [{ role: 'user', content: simplePrompt }],
        temperature: 0.7,
      };

      if (maxTokens !== undefined) {
        config.max_tokens = maxTokens;
      }

      const completion = await client.chat.completions.create(config);
      const response = completion.choices[0]?.message?.content || '';

      console.log(`Response length: ${response.length}`);
      console.log(`Empty: ${response.trim().length === 0}`);
      console.log(`Finish reason: ${completion.choices[0]?.finish_reason}`);
      console.log(
        `Usage: prompt=${completion.usage?.prompt_tokens}, completion=${completion.usage?.completion_tokens}, total=${completion.usage?.total_tokens}`,
      );

      if (response.trim().length === 0) {
        console.log('⚠️  EMPTY RESPONSE');
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  // Now test with the complex code review prompt
  console.log('\n' + '='.repeat(80) + '\n');
  console.log('Testing code review prompt with different max_tokens values:\n');

  const codeReviewPrompt = `You are an expert code reviewer. Please analyze this code:
def get_user(id): query = "SELECT * FROM users WHERE id = " + id; return db.execute(query)

Focus on security issues.`;

  for (const maxTokens of [undefined, 1000, 1500, 2000, 2048, 3000, 4096]) {
    console.log('-'.repeat(60));
    console.log(`max_tokens: ${maxTokens}`);

    try {
      const config: any = {
        model,
        messages: [{ role: 'user', content: codeReviewPrompt }],
        temperature: 0.2,
      };

      if (maxTokens !== undefined) {
        config.max_tokens = maxTokens;
      }

      const completion = await client.chat.completions.create(config);
      const response = completion.choices[0]?.message?.content || '';

      console.log(`Response length: ${response.length}`);
      console.log(`Empty: ${response.trim().length === 0}`);
      console.log(`Finish reason: ${completion.choices[0]?.finish_reason}`);
      console.log(
        `Usage: prompt=${completion.usage?.prompt_tokens}, completion=${completion.usage?.completion_tokens}, total=${completion.usage?.total_tokens}`,
      );

      if (response.trim().length === 0) {
        console.log('⚠️  EMPTY RESPONSE');
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

testGeminiTokenLimits().catch(console.error);
