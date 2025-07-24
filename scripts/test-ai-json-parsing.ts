#!/usr/bin/env tsx
/**
 * Test AI JSON parsing robustness
 */

import { createAIClientFromEnv } from '../src/ai/client';
import { AIQueryAnalyzer } from '../src/delegation/ai-analyzer';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Mock librarian registry for testing
const mockRegistry = {
  getLibrarians: () => [
    {
      id: 'code-reviewer',
      name: 'Code Reviewer',
      description: 'Reviews code for security and quality',
      capabilities: ['code.review', 'security.analysis'],
      team: 'engineering',
      public: false,
    },
    {
      id: 'security-expert',
      name: 'Security Expert',
      description: 'Analyzes security vulnerabilities',
      capabilities: ['security.vulnerability', 'security.analysis'],
      team: 'security',
      public: false,
    },
  ],
};

async function testAIJsonParsing() {
  console.log('🧪 Testing AI JSON Parsing Robustness\n');

  try {
    // Create AI client
    const aiClient = createAIClientFromEnv();
    console.log('✅ AI client created successfully');

    // Create analyzer
    const analyzer = new AIQueryAnalyzer(aiClient, mockRegistry as any);
    console.log('✅ AI analyzer created successfully\n');

    // Test queries that might cause JSON parsing issues
    const testQueries = [
      'hji can you look at this from security:\n\nDef foo:\nreturn 43',
      'review this code: def test(): return {"key": "value"}',
      'what is the purpose of this function?',
      'help me deploy to kubernetes {{{test}}}',
      'analyze: {"test": true, "nested": {"value": 123}}',
    ];

    for (const query of testQueries) {
      console.log('='.repeat(60));
      console.log('Testing query:', query);
      console.log('-'.repeat(60));

      try {
        // Analyze with context
        const result = await analyzer.analyze(query, {
          user: {
            id: 'test-user',
            teams: ['engineering', 'security'],
            roles: ['developer'],
          },
        });

        console.log('✅ Analysis successful!');
        console.log('Intent:', result.intent);
        console.log('Capabilities:', result.capabilities);
        console.log('Recommended librarians:', result.librarians.map((l) => l.id).join(', '));
        console.log('');
      } catch (error: any) {
        console.log('❌ Analysis failed:', error.message);
        console.log('');
      }
    }

    console.log('✨ JSON parsing test completed!');
  } catch (error: any) {
    console.error('❌ Test setup failed:', error.message);
  }
}

testAIJsonParsing().catch(console.error);
