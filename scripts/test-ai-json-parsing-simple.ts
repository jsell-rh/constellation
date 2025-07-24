#!/usr/bin/env tsx
/**
 * Simple test for AI JSON parsing fix
 */

import { createAIClientFromEnv } from '../src/ai/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testJsonParsing() {
  console.log('🧪 Testing AI JSON Parsing Fix\n');

  try {
    const aiClient = createAIClientFromEnv();
    console.log('✅ AI client created\n');

    // Test the exact prompt that was failing
    const prompt = `Analyze this query and determine:
1. The user's intent (what they want to accomplish)
2. Required capabilities to answer this query (as dot-separated paths like "kubernetes.operations" or "ai.analysis")

Query: "hji can you look at this from security:

Def foo:
return 43"

Respond with ONLY valid JSON, no other text:
{
  "intent": "brief description of what user wants",
  "capabilities": ["capability1", "capability2", ...]
}

Examples:
- For "help me deploy to kubernetes": {"intent": "Deploy application to Kubernetes", "capabilities": ["kubernetes.deployment", "devops.operations"]}
- For "review this code": {"intent": "Code review", "capabilities": ["code.analysis", "security.review"]}
- For "what is the capital of France": {"intent": "General knowledge question", "capabilities": []}`;

    console.log('Sending prompt to AI...\n');

    const response = await aiClient.ask(prompt, {
      temperature: 0.3,
      max_tokens: 500,
    });

    console.log('Raw AI Response:');
    console.log('-'.repeat(60));
    console.log(response);
    console.log('-'.repeat(60));
    console.log('');

    // Try to parse the response
    try {
      // Try to extract JSON from the response
      let jsonStr = response.trim();

      // Try to find JSON object in the response
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
        console.log('Extracted JSON:', jsonStr);
      }

      const parsed = JSON.parse(jsonStr);
      console.log('\n✅ Successfully parsed JSON!');
      console.log('Intent:', parsed.intent);
      console.log('Capabilities:', parsed.capabilities);

      // Validate structure
      if (!parsed.intent || !Array.isArray(parsed.capabilities)) {
        console.log('\n⚠️  Warning: Response structure is invalid');
      }
    } catch (error: any) {
      console.log('\n❌ Failed to parse JSON:', error.message);
      console.log('\nFalling back to text analysis...');

      const intent = response.includes('security')
        ? 'Security analysis'
        : response.includes('code')
          ? 'Code analysis'
          : 'General query';

      console.log('Extracted intent:', intent);
    }
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
  }
}

testJsonParsing().catch(console.error);
