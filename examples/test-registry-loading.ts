#!/usr/bin/env tsx
/**
 * Test Registry Loading
 * Verifies that the secure registry loader works correctly
 */

import { SimpleRouter } from '../src/core/router';
import { loadLibrarians } from '../src/registry/secure-loader';
import path from 'path';

async function testRegistryLoading() {
  console.log('🧪 Testing Registry Loading');
  console.log('========================\n');

  const router = new SimpleRouter();
  const registryPath = path.resolve(__dirname, '../registry/constellation-registry.yaml');
  
  console.log(`📁 Loading registry from: ${registryPath}`);
  
  try {
    await loadLibrarians(registryPath, router);
    
    const librarians = router.getAllLibrarians();
    console.log(`\n✅ Successfully loaded ${librarians.length} librarians:`);
    
    for (const id of librarians) {
      const metadata = router.getMetadata(id);
      if (metadata) {
        console.log(`\n📚 ${metadata.name} (${id})`);
        console.log(`   Team: ${metadata.team}`);
        console.log(`   Description: ${metadata.description}`);
      }
    }
    
    // Test a simple query
    console.log('\n🔍 Testing hello librarian...');
    const response = await router.route('Hello there!', 'hello');
    console.log('Response:', response.answer || response.error);
    
  } catch (error) {
    console.error('❌ Failed to load registry:', error);
  }
}

testRegistryLoading().catch(console.error);