#!/usr/bin/env npx tsx
/**
 * Test OpenTelemetry Tracing
 * Verifies that distributed tracing is working correctly
 */

import { SimpleRouter } from '../src/core/router';
import { LibrarianExecutor } from '../src/core/executor';
import { createLibrarian } from '../src/types/librarian-factory';
import { initializeTracing } from '../src/observability';
import type { Context } from '../src/types/core';

async function testTracing() {
  console.log('🔍 Testing OpenTelemetry Tracing');
  console.log('================================\n');

  // Initialize tracing with console exporter for testing
  initializeTracing({
    serviceName: 'constellation-test',
    enabled: true,
    enableConsoleExporter: true,
    otlpEndpoint: 'none', // Disable OTLP for this test
  });

  // Wait a moment for tracing to initialize
  await new Promise(resolve => setTimeout(resolve, 100));

  // Create executor and router
  const executor = new LibrarianExecutor();
  const router = new SimpleRouter({ executor });

  // Register test librarians
  console.log('📚 Registering test librarians...\n');

  // Simple librarian
  const simpleLibrarian = createLibrarian(async (query: string, context?: Context) => {
    console.log(`Simple librarian processing: "${query}"`);
    return {
      answer: `Simple response to: ${query}`,
      confidence: 0.9,
      metadata: {
        librarianType: 'simple',
      },
    };
  });

  router.register({
    id: 'simple',
    name: 'Simple Test Librarian',
    description: 'A simple librarian for testing',
    capabilities: ['test'],
    team: 'test-team',
  }, simpleLibrarian);

  // Slow librarian (to test timing)
  const slowLibrarian = createLibrarian(async (query: string, context?: Context) => {
    console.log(`Slow librarian processing: "${query}"`);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate slow operation
    return {
      answer: `Slow response after 500ms`,
      confidence: 0.8,
    };
  });

  router.register({
    id: 'slow',
    name: 'Slow Test Librarian',
    description: 'A slow librarian for testing timing',
    capabilities: ['slow'],
    team: 'test-team',
  }, slowLibrarian);

  // Error librarian (to test error handling)
  const errorLibrarian = createLibrarian(async (query: string, context?: Context) => {
    console.log(`Error librarian processing: "${query}"`);
    if (query.includes('error')) {
      throw new Error('Intentional test error');
    }
    return {
      answer: 'This should not be returned',
    };
  });

  router.register({
    id: 'error',
    name: 'Error Test Librarian',
    description: 'A librarian that throws errors for testing',
    capabilities: ['error'],
    team: 'test-team',
  }, errorLibrarian);

  // Test scenarios
  console.log('\n🧪 Running test scenarios...\n');

  // Test 1: Simple successful execution
  console.log('1️⃣ Test: Simple successful execution');
  const response1 = await router.route('Hello world', 'simple', {
    user: { id: 'test-user', teams: ['test-team'] },
  });
  console.log(`   Result: ${response1.answer}`);
  console.log(`   Trace ID: ${response1.metadata?.traceId}\n`);

  // Test 2: Slow execution (tests timing attributes)
  console.log('2️⃣ Test: Slow execution');
  const start = Date.now();
  const response2 = await router.route('Take your time', 'slow', {
    user: { id: 'test-user', teams: ['test-team'] },
  });
  const duration = Date.now() - start;
  console.log(`   Result: ${response2.answer}`);
  console.log(`   Duration: ${duration}ms`);
  console.log(`   Execution time in metadata: ${response2.metadata?.executionTimeMs}ms\n`);

  // Test 3: Error handling
  console.log('3️⃣ Test: Error handling');
  const response3 = await router.route('Cause an error please', 'error', {
    user: { id: 'test-user', teams: ['test-team'] },
  });
  console.log(`   Error: ${response3.error?.message}`);
  console.log(`   Error code: ${response3.error?.code}\n`);

  // Test 4: Missing librarian
  console.log('4️⃣ Test: Missing librarian');
  const response4 = await router.route('Find me', 'non-existent', {
    user: { id: 'test-user', teams: ['test-team'] },
  });
  console.log(`   Error: ${response4.error?.message}`);
  console.log(`   Available librarians: ${response4.error?.details?.availableLibrarians?.join(', ')}\n`);

  // Test 5: Multiple sequential calls (trace parent-child relationships)
  console.log('5️⃣ Test: Multiple sequential calls');
  for (let i = 1; i <= 3; i++) {
    const response = await router.route(`Call ${i}`, 'simple', {
      user: { id: 'test-user', teams: ['test-team'] },
    });
    console.log(`   Call ${i} - Trace ID: ${response.metadata?.traceId}`);
  }

  console.log('\n✨ Tracing test complete!');
  console.log('\n📊 Check the console output above for trace spans.');
  console.log('   Each span should show:');
  console.log('   - Span name: librarian.execute');
  console.log('   - Attributes: librarian ID, query, user info');
  console.log('   - Events: execution start/complete/error');
  console.log('   - Duration: execution time');
  
  // Give time for spans to flush
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  process.exit(0);
}

testTracing().catch(console.error);