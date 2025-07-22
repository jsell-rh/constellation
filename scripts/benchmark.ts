#!/usr/bin/env tsx
/**
 * Performance benchmark script for Constellation
 * Uses autocannon to test HTTP endpoints
 */

import autocannon from 'autocannon';
import { spawn } from 'child_process';

const BENCHMARK_CONFIG = {
  url: 'http://localhost:3000',
  connections: 10,
  duration: 30,
  pipelining: 1,
  workers: 4,
};

const ENDPOINTS = [
  {
    path: '/health',
    method: 'GET' as const,
    title: 'Health Check Endpoint',
  },
  {
    path: '/query',
    method: 'POST' as const,
    title: 'Query Endpoint - Simple',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'hello',
      librarian: 'hello-world',
    }),
  },
];

async function startServer(): Promise<() => void> {
  console.log('Starting server...');
  const server = spawn('npm', ['run', 'dev'], {
    stdio: 'ignore',
    detached: false,
  });

  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 3000));

  return () => {
    server.kill();
  };
}

async function runBenchmark(endpoint: typeof ENDPOINTS[0]): Promise<void> {
  console.log(`\n🔥 Benchmarking: ${endpoint.title}`);
  console.log(`   ${endpoint.method} ${endpoint.path}`);
  console.log('─'.repeat(60));

  const result = await autocannon({
    ...BENCHMARK_CONFIG,
    url: `${BENCHMARK_CONFIG.url}${endpoint.path}`,
    method: endpoint.method,
    headers: endpoint.headers,
    body: endpoint.body,
  });

  console.log(`
📊 Results:
   Latency (ms):
     - p50: ${result.latency.p50}
     - p90: ${result.latency.p90}
     - p95: ${result.latency.p95}
     - p99: ${result.latency.p99}
   
   Throughput:
     - Requests/sec: ${result.requests.average}
     - Bytes/sec: ${result.throughput.average}
   
   Errors: ${result.errors}
   Timeouts: ${result.timeouts}
`);
}

async function main(): Promise<void> {
  let stopServer: (() => void) | null = null;

  try {
    // Check if server is already running
    try {
      const response = await fetch(`${BENCHMARK_CONFIG.url}/health`);
      if (!response.ok) {
        throw new Error('Server not healthy');
      }
      console.log('Server already running, using existing instance');
    } catch {
      stopServer = await startServer();
    }

    // Run benchmarks
    for (const endpoint of ENDPOINTS) {
      await runBenchmark(endpoint);
    }

    console.log('\n✅ Benchmark completed!');
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  } finally {
    if (stopServer) {
      console.log('\nStopping server...');
      stopServer();
    }
  }
}

// Run if called directly
if (require.main === module) {
  void main();
}