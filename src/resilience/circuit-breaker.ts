/**
 * Circuit Breaker Implementation
 * Provides automatic failure detection and recovery for librarians
 */

import { EventEmitter } from 'events';
import type { Response } from '../types/core';
import {
  circuitBreakerState,
  circuitBreakerTrips,
  circuitBreakerRejections,
} from '../observability/metrics';

export interface CircuitBreakerConfig {
  /** Name of the circuit breaker (usually librarian ID) */
  name: string;

  /** Failure threshold percentage (0-1) before opening circuit */
  failureThreshold?: number;

  /** Minimum number of requests before calculating failure rate */
  volumeThreshold?: number;

  /** Time window in ms for calculating failure rate */
  windowSize?: number;

  /** Time in ms before attempting to close circuit */
  timeout?: number;

  /** Number of successful requests needed to close circuit from half-open */
  successThreshold?: number;
}

export interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open';
  failures: number;
  successes: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
}

export interface CircuitBreakerMetrics {
  totalRequests: number;
  failedRequests: number;
  successfulRequests: number;
  rejectedRequests: number;
  status: 'closed' | 'open' | 'half-open';
  lastStateChange: number;
}

export class CircuitBreaker extends EventEmitter {
  private config: Required<CircuitBreakerConfig>;
  private state: CircuitBreakerState;
  private requestCounts: Array<{ timestamp: number; success: boolean }> = [];
  private halfOpenSuccesses = 0;
  private metrics: CircuitBreakerMetrics;

  constructor(config: CircuitBreakerConfig) {
    super();

    // Set defaults
    this.config = {
      name: config.name,
      failureThreshold: config.failureThreshold ?? 0.5, // 50% failure rate
      volumeThreshold: config.volumeThreshold ?? 20, // Min 20 requests
      windowSize: config.windowSize ?? 60000, // 1 minute window
      timeout: config.timeout ?? 60000, // 1 minute timeout
      successThreshold: config.successThreshold ?? 5, // 5 successes to close
    };

    this.state = {
      status: 'closed',
      failures: 0,
      successes: 0,
    };

    this.metrics = {
      totalRequests: 0,
      failedRequests: 0,
      successfulRequests: 0,
      rejectedRequests: 0,
      status: 'closed',
      lastStateChange: Date.now(),
    };

    // Initialize circuit breaker state metric
    circuitBreakerState.set({ librarian: this.config.name }, 0); // 0 = closed
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we should attempt the request
    if (!this.canExecute()) {
      this.metrics.rejectedRequests++;
      circuitBreakerRejections.inc({
        librarian: this.config.name,
        state: this.state.status,
      });
      this.emit('rejected', {
        name: this.config.name,
        state: this.state.status,
      });
      throw this.createCircuitOpenError();
    }

    this.metrics.totalRequests++;
    const startTime = Date.now();

    try {
      const result = await fn();
      this.recordSuccess();

      this.emit('success', {
        name: this.config.name,
        duration: Date.now() - startTime,
        state: this.state.status,
      });

      return result;
    } catch (error) {
      this.recordFailure();

      this.emit('failure', {
        name: this.config.name,
        duration: Date.now() - startTime,
        error,
        state: this.state.status,
      });

      throw error;
    }
  }

  /**
   * Check if the circuit breaker allows execution
   */
  private canExecute(): boolean {
    this.cleanupOldRequests();

    switch (this.state.status) {
      case 'closed':
        return true;

      case 'open':
        // Check if timeout has passed
        if (this.state.nextAttemptTime && Date.now() >= this.state.nextAttemptTime) {
          this.transitionTo('half-open');
          return true;
        }
        return false;

      case 'half-open':
        // Allow limited requests in half-open state
        return true;

      default:
        return false;
    }
  }

  /**
   * Record a successful request
   */
  private recordSuccess(): void {
    this.requestCounts.push({ timestamp: Date.now(), success: true });
    this.metrics.successfulRequests++;

    switch (this.state.status) {
      case 'closed':
        // Nothing special to do
        break;

      case 'half-open':
        this.halfOpenSuccesses++;
        if (this.halfOpenSuccesses >= this.config.successThreshold) {
          this.transitionTo('closed');
        }
        break;

      case 'open':
        // Shouldn't happen, but handle gracefully
        this.transitionTo('half-open');
        break;
    }
  }

  /**
   * Record a failed request
   */
  private recordFailure(): void {
    this.requestCounts.push({ timestamp: Date.now(), success: false });
    this.metrics.failedRequests++;
    this.state.lastFailureTime = Date.now();

    switch (this.state.status) {
      case 'closed':
        // Check if we should open the circuit
        if (this.shouldOpen()) {
          this.transitionTo('open');
        }
        break;

      case 'half-open':
        // Any failure in half-open state reopens the circuit
        this.transitionTo('open');
        break;

      case 'open':
        // Already open, update next attempt time
        this.state.nextAttemptTime = Date.now() + this.config.timeout;
        break;
    }
  }

  /**
   * Check if the circuit should open based on failure rate
   */
  private shouldOpen(): boolean {
    const recentRequests = this.requestCounts.filter(
      (req) => req.timestamp > Date.now() - this.config.windowSize,
    );

    // Not enough requests to make a decision
    if (recentRequests.length < this.config.volumeThreshold) {
      return false;
    }

    const failures = recentRequests.filter((req) => !req.success).length;
    const failureRate = failures / recentRequests.length;

    return failureRate >= this.config.failureThreshold;
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: 'closed' | 'open' | 'half-open'): void {
    const oldState = this.state.status;
    this.state.status = newState;
    this.metrics.status = newState;
    this.metrics.lastStateChange = Date.now();

    // Record circuit breaker state metrics
    const stateValue = newState === 'closed' ? 0 : newState === 'open' ? 1 : 2;
    circuitBreakerState.set({ librarian: this.config.name }, stateValue);

    // Record trips when opening
    if (newState === 'open' && oldState !== 'open') {
      circuitBreakerTrips.inc({
        librarian: this.config.name,
        reason: oldState === 'half-open' ? 'half_open_failure' : 'threshold_exceeded',
      });
    }

    switch (newState) {
      case 'open':
        this.state.nextAttemptTime = Date.now() + this.config.timeout;
        break;

      case 'half-open':
        this.halfOpenSuccesses = 0;
        break;

      case 'closed':
        this.state.failures = 0;
        this.state.successes = 0;
        this.halfOpenSuccesses = 0;
        break;
    }

    this.emit('stateChange', {
      name: this.config.name,
      from: oldState,
      to: newState,
      timestamp: Date.now(),
    });
  }

  /**
   * Clean up old request counts outside the window
   */
  private cleanupOldRequests(): void {
    const cutoff = Date.now() - this.config.windowSize;
    this.requestCounts = this.requestCounts.filter((req) => req.timestamp > cutoff);
  }

  /**
   * Create an error for when the circuit is open
   */
  private createCircuitOpenError(): Response {
    return {
      error: {
        code: 'CIRCUIT_BREAKER_OPEN',
        message: `Circuit breaker is open for ${this.config.name}. Service is temporarily unavailable.`,
        recoverable: true,
        details: {
          retryAfter: this.state.nextAttemptTime,
        },
      },
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * Force close the circuit (for testing or manual recovery)
   */
  close(): void {
    this.transitionTo('closed');
  }

  /**
   * Force open the circuit (for testing or manual intervention)
   */
  open(): void {
    this.transitionTo('open');
  }
}

/**
 * Factory function to create circuit breakers with default configs
 */
export function createCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>,
): CircuitBreaker {
  return new CircuitBreaker({
    name,
    ...config,
  });
}
