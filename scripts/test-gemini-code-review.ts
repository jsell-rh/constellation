#!/usr/bin/env tsx
/**
 * Test Gemini's code review response
 */

import { createAIClientFromEnv } from '../src/ai/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testGeminiCodeReview() {
  console.log('🧪 Testing Gemini Code Review Response\n');

  try {
    const aiClient = createAIClientFromEnv();
    console.log('✅ AI client created\n');

    const prompt = `You are an expert code reviewer that is part of the Constellation distributed knowledge system.
You specialize in:
- Security vulnerability detection
- Bug identification
- Performance optimization
- Code quality and maintainability
- Best practices and design patterns

Please analyze and provide feedback on:

Can you review this Python code for security issues: def get_user(id): query = "SELECT * FROM users WHERE id = " + id; return db.execute(query)

Focus on:
1. Security issues (injection, XSS, authentication flaws)
2. Potential bugs or logic errors
3. Performance concerns
4. Code readability and maintainability
5. Suggestions for improvement`;

    console.log('Sending code review prompt to Gemini...\n');

    const response = await aiClient.ask(prompt, {
      temperature: 0.2,
      max_tokens: 1000,
    });

    console.log('Raw Response:');
    console.log('='.repeat(60));
    console.log(response);
    console.log('='.repeat(60));
    console.log('\nResponse length:', response.length, 'characters');
    console.log('Response starts with:', response.substring(0, 50) + '...');
    console.log('Response ends with:', '...' + response.substring(response.length - 50));

    // Check if response is empty or just whitespace
    if (!response || response.trim().length === 0) {
      console.log('\n❌ Response is empty!');
    } else {
      console.log('\n✅ Response received successfully');
    }
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
  }
}

testGeminiCodeReview().catch(console.error);
