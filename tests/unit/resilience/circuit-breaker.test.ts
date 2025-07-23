/**
 * Tests for Circuit Breaker implementation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CircuitBreaker } from '../../../src/resilience/circuit-breaker';
import type { Response } from '../../../src/types/core';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test-breaker',
      failureThreshold: 0.5,
      volumeThreshold: 3,
      windowSize: 1000,
      timeout: 2000,
      successThreshold: 2,
    });
  });

  describe('Closed State', () => {
    it('should execute functions successfully when closed', async () => {
      const result = await breaker.execute(() => Promise.resolve('success'));
      expect(result).toBe('success');
      expect(breaker.getState().status).toBe('closed');
    });

    it('should remain closed with successful requests', async () => {
      for (let i = 0; i < 5; i++) {
        await breaker.execute(() => Promise.resolve('success'));
      }
      expect(breaker.getState().status).toBe('closed');
    });

    it('should count failures but stay closed below threshold', async () => {
      // One success, one failure - 50% failure rate but below volume threshold
      await breaker.execute(() => Promise.resolve('success'));
      try {
        await breaker.execute(async () => {
          throw new Error('test error');
        });
      } catch {
        // Expected
      }
      
      expect(breaker.getState().status).toBe('closed');
    });
  });

  describe('Open State', () => {
    it('should open when failure threshold is exceeded', async () => {
      // Need at least 3 requests (volumeThreshold) with 50% failure rate
      await breaker.execute(() => Promise.resolve('success'));
      
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test error');
          });
        } catch {
          // Expected
        }
      }
      
      expect(breaker.getState().status).toBe('open');
    });

    it('should reject requests when open', async () => {
      // Open the circuit
      await breaker.execute(() => Promise.resolve('success'));
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test error');
          });
        } catch {
          // Expected
        }
      }
      
      // Should reject with circuit breaker error
      try {
        await breaker.execute(() => Promise.resolve('should not execute'));
        fail('Should have thrown');
      } catch (error) {
        const response = error as Response;
        expect(response.error?.code).toBe('CIRCUIT_BREAKER_OPEN');
        expect(response.error?.recoverable).toBe(true);
      }
    });
  });

  describe('Half-Open State', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should transition to half-open after timeout', async () => {
      // Open the circuit
      await breaker.execute(() => Promise.resolve('success'));
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test error');
          });
        } catch {
          // Expected
        }
      }
      
      expect(breaker.getState().status).toBe('open');
      
      // Advance time past timeout
      jest.advanceTimersByTime(2001);
      
      // Next request should be allowed (half-open)
      const result = await breaker.execute(() => Promise.resolve('success'));
      expect(result).toBe('success');
      expect(breaker.getState().status).toBe('half-open');
    });

    it('should close after success threshold in half-open', async () => {
      // Open the circuit
      await breaker.execute(() => Promise.resolve('success'));
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test error');
          });
        } catch {
          // Expected
        }
      }
      
      // Move to half-open
      jest.advanceTimersByTime(2001);
      
      // Need 2 successes to close
      await breaker.execute(() => Promise.resolve('success'));
      expect(breaker.getState().status).toBe('half-open');
      
      await breaker.execute(() => Promise.resolve('success'));
      expect(breaker.getState().status).toBe('closed');
    });

    it('should reopen on failure in half-open', async () => {
      // Open the circuit
      await breaker.execute(() => Promise.resolve('success'));
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test error');
          });
        } catch {
          // Expected
        }
      }
      
      // Move to half-open
      jest.advanceTimersByTime(2001);
      await breaker.execute(() => Promise.resolve('success'));
      expect(breaker.getState().status).toBe('half-open');
      
      // Failure should reopen
      try {
        await breaker.execute(async () => {
          throw new Error('test error');
        });
      } catch {
        // Expected
      }
      
      expect(breaker.getState().status).toBe('open');
    });
  });

  describe('Metrics', () => {
    it('should track metrics correctly', async () => {
      await breaker.execute(() => Promise.resolve('success'));
      await breaker.execute(() => Promise.resolve('success'));
      
      try {
        await breaker.execute(async () => {
          throw new Error('test error');
        });
      } catch {
        // Expected
      }
      
      const metrics = breaker.getMetrics();
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.rejectedRequests).toBe(0);
    });
  });

  describe('Manual Controls', () => {
    it('should allow manual open', async () => {
      breaker.open();
      expect(breaker.getState().status).toBe('open');
      
      try {
        await breaker.execute(() => Promise.resolve('should not execute'));
        fail('Should have thrown');
      } catch (error) {
        const response = error as Response;
        expect(response.error?.code).toBe('CIRCUIT_BREAKER_OPEN');
      }
    });

    it('should allow manual close', async () => {
      // Open the circuit
      breaker.open();
      expect(breaker.getState().status).toBe('open');
      
      // Manual close
      breaker.close();
      expect(breaker.getState().status).toBe('closed');
      
      // Should allow execution
      const result = await breaker.execute(() => Promise.resolve('success'));
      expect(result).toBe('success');
    });
  });

  describe('Events', () => {
    it('should emit state change events', async () => {
      const stateChanges: string[] = [];
      breaker.on('stateChange', (event) => {
        stateChanges.push(`${event.from}->${event.to}`);
      });
      
      // Open the circuit
      await breaker.execute(() => Promise.resolve('success'));
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test error');
          });
        } catch {
          // Expected
        }
      }
      
      expect(stateChanges).toContain('closed->open');
    });

    it('should emit rejection events', async () => {
      let rejectionCount = 0;
      breaker.on('rejected', () => {
        rejectionCount++;
      });
      
      // Open the circuit
      breaker.open();
      
      // Try to execute
      try {
        await breaker.execute(() => Promise.resolve('should not execute'));
      } catch {
        // Expected
      }
      
      expect(rejectionCount).toBe(1);
    });
  });
});