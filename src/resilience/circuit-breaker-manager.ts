/**
 * Circuit Breaker Manager
 * Manages circuit breakers for all librarians in the system
 */

import { CircuitBreaker, CircuitBreakerConfig } from './circuit-breaker';
import { EventEmitter } from 'events';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export interface CircuitBreakerManagerConfig {
  /** Default configuration for all circuit breakers */
  defaults?: Partial<CircuitBreakerConfig>;

  /** Enable circuit breakers globally */
  enabled?: boolean;
}

export class CircuitBreakerManager extends EventEmitter {
  private breakers = new Map<string, CircuitBreaker>();
  private config: CircuitBreakerManagerConfig;

  constructor(config: CircuitBreakerManagerConfig = {}) {
    super();
    this.config = {
      enabled: config.enabled ?? true,
      defaults: config.defaults ?? {},
    };
  }

  /**
   * Get or create a circuit breaker for a librarian
   */
  getBreaker(librarianId: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.config.enabled) {
      // Return a no-op circuit breaker when disabled
      return this.createNoOpBreaker(librarianId);
    }

    let breaker = this.breakers.get(librarianId);

    if (!breaker) {
      breaker = new CircuitBreaker({
        name: librarianId,
        ...this.config.defaults,
        ...config,
      });

      // Forward events from individual breakers
      breaker.on('stateChange', (event) => {
        logger.info(
          {
            circuitBreaker: librarianId,
            ...event,
          },
          'Circuit breaker state changed',
        );

        this.emit('stateChange', event);
      });

      breaker.on('rejected', (event) => {
        logger.warn(
          {
            circuitBreaker: librarianId,
            ...event,
          },
          'Request rejected by circuit breaker',
        );

        this.emit('rejected', event);
      });

      breaker.on('failure', (event: { duration?: number; state?: string }) => {
        logger.debug(
          {
            circuitBreaker: librarianId,
            duration: event.duration,
            state: event.state,
          },
          'Request failed',
        );

        this.emit('failure', event);
      });

      breaker.on('success', (event: { duration?: number; state?: string }) => {
        logger.debug(
          {
            circuitBreaker: librarianId,
            duration: event.duration,
            state: event.state,
          },
          'Request succeeded',
        );

        this.emit('success', event);
      });

      this.breakers.set(librarianId, breaker);
    }

    return breaker;
  }

  /**
   * Create a no-op circuit breaker for when feature is disabled
   */
  private createNoOpBreaker(name: string): CircuitBreaker {
    // Return a circuit breaker that never opens
    return new CircuitBreaker({
      name,
      failureThreshold: 1.1, // Never opens (impossible threshold)
      volumeThreshold: Number.MAX_SAFE_INTEGER,
    });
  }

  /**
   * Get metrics for all circuit breakers
   */
  getAllMetrics(): Record<string, ReturnType<CircuitBreaker['getMetrics']>> {
    const metrics: Record<string, ReturnType<CircuitBreaker['getMetrics']>> = {};

    for (const [id, breaker] of this.breakers) {
      metrics[id] = breaker.getMetrics();
    }

    return metrics;
  }

  /**
   * Get state of all circuit breakers
   */
  getAllStates(): Record<string, ReturnType<CircuitBreaker['getState']>> {
    const states: Record<string, ReturnType<CircuitBreaker['getState']>> = {};

    for (const [id, breaker] of this.breakers) {
      states[id] = breaker.getState();
    }

    return states;
  }

  /**
   * Force close a specific circuit breaker
   */
  closeBreaker(librarianId: string): void {
    const breaker = this.breakers.get(librarianId);
    if (breaker) {
      breaker.close();
      logger.info({ librarianId }, 'Circuit breaker manually closed');
    }
  }

  /**
   * Force open a specific circuit breaker
   */
  openBreaker(librarianId: string): void {
    const breaker = this.breakers.get(librarianId);
    if (breaker) {
      breaker.open();
      logger.warn({ librarianId }, 'Circuit breaker manually opened');
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const [, breaker] of this.breakers) {
      breaker.close();
    }
    logger.info('All circuit breakers reset');
  }

  /**
   * Clear all circuit breakers (for testing)
   */
  clear(): void {
    this.breakers.clear();
  }
}

// Global instance
let globalManager: CircuitBreakerManager | null = null;

/**
 * Get the global circuit breaker manager
 */
export function getCircuitBreakerManager(): CircuitBreakerManager {
  if (!globalManager) {
    globalManager = new CircuitBreakerManager({
      enabled: process.env.CIRCUIT_BREAKER_ENABLED !== 'false',
      defaults: {
        failureThreshold: parseFloat(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD ?? '0.5'),
        volumeThreshold: parseInt(process.env.CIRCUIT_BREAKER_VOLUME_THRESHOLD ?? '20', 10),
        windowSize: parseInt(process.env.CIRCUIT_BREAKER_WINDOW_SIZE ?? '60000', 10),
        timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT ?? '60000', 10),
        successThreshold: parseInt(process.env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD ?? '5', 10),
      },
    });
  }

  return globalManager;
}

/**
 * Reset the global manager (for testing)
 */
export function resetGlobalManager(): void {
  if (globalManager) {
    globalManager.clear();
  }
  globalManager = null;
}
