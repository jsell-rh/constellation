/**
 * Tests for Circuit Breaker Manager
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  CircuitBreakerManager,
  resetGlobalManager,
} from '../../../src/resilience/circuit-breaker-manager';

describe('CircuitBreakerManager', () => {
  let manager: CircuitBreakerManager;

  beforeEach(() => {
    resetGlobalManager();
    manager = new CircuitBreakerManager({
      enabled: true,
      defaults: {
        failureThreshold: 0.5,
        volumeThreshold: 5,
      },
    });
  });

  afterEach(() => {
    manager.clear();
  });

  describe('Breaker Management', () => {
    it('should create breakers on demand', () => {
      const breaker1 = manager.getBreaker('service1');
      const breaker2 = manager.getBreaker('service2');

      expect(breaker1).toBeDefined();
      expect(breaker2).toBeDefined();
      expect(breaker1).not.toBe(breaker2);
    });

    it('should return same breaker for same ID', () => {
      const breaker1 = manager.getBreaker('service1');
      const breaker2 = manager.getBreaker('service1');

      expect(breaker1).toBe(breaker2);
    });

    it('should apply default configuration', () => {
      const breaker = manager.getBreaker('service1');
      const state = breaker.getState();

      // Execute to see if defaults are applied
      void breaker.execute(() => Promise.resolve('success')).catch(() => {});

      // Check that breaker was created with defaults
      expect(state.status).toBe('closed');
    });

    it('should allow per-breaker configuration', () => {
      const breaker = manager.getBreaker('special', {
        failureThreshold: 0.1,
        volumeThreshold: 2,
      });

      // Should use custom config
      expect(breaker).toBeDefined();
    });
  });

  describe('Disabled Mode', () => {
    it('should create no-op breakers when disabled', async () => {
      const disabledManager = new CircuitBreakerManager({
        enabled: false,
      });

      const breaker = disabledManager.getBreaker('service1');

      // Should always allow execution even with failures
      for (let i = 0; i < 10; i++) {
        try {
          await breaker.execute(() => {
            throw new Error('test error');
          });
        } catch {
          // Expected
        }
      }

      // Should still be "closed" (no-op)
      expect(breaker.getState().status).toBe('closed');

      // Should execute successfully
      const result = await breaker.execute(() => Promise.resolve('success'));
      expect(result).toBe('success');
    });
  });

  describe('Metrics and State', () => {
    it('should aggregate metrics from all breakers', async () => {
      const breaker1 = manager.getBreaker('service1');
      const breaker2 = manager.getBreaker('service2');

      await breaker1.execute(() => Promise.resolve('success'));
      await breaker2.execute(() => Promise.resolve('success'));

      const metrics = manager.getAllMetrics();
      expect(Object.keys(metrics)).toHaveLength(2);
      expect(metrics.service1?.successfulRequests).toBe(1);
      expect(metrics.service2?.successfulRequests).toBe(1);
    });

    it('should get state of all breakers', () => {
      manager.getBreaker('service1');
      manager.getBreaker('service2');

      const states = manager.getAllStates();
      expect(Object.keys(states)).toHaveLength(2);
      expect(states.service1?.status).toBe('closed');
      expect(states.service2?.status).toBe('closed');
    });
  });

  describe('Manual Controls', () => {
    it('should allow closing specific breaker', () => {
      const breaker = manager.getBreaker('service1');
      breaker.open();
      expect(breaker.getState().status).toBe('open');

      manager.closeBreaker('service1');
      expect(breaker.getState().status).toBe('closed');
    });

    it('should allow opening specific breaker', () => {
      const breaker = manager.getBreaker('service1');
      expect(breaker.getState().status).toBe('closed');

      manager.openBreaker('service1');
      expect(breaker.getState().status).toBe('open');
    });

    it('should reset all breakers', () => {
      const breaker1 = manager.getBreaker('service1');
      const breaker2 = manager.getBreaker('service2');

      breaker1.open();
      breaker2.open();

      manager.resetAll();

      expect(breaker1.getState().status).toBe('closed');
      expect(breaker2.getState().status).toBe('closed');
    });
  });

  describe('Event Forwarding', () => {
    it('should forward breaker events', () => {
      let stateChangeCount = 0;
      manager.on('stateChange', () => {
        stateChangeCount++;
      });

      const breaker = manager.getBreaker('service1');
      breaker.open();

      expect(stateChangeCount).toBe(1);
    });
  });
});
