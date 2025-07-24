/**
 * Health check system for Constellation
 * Provides comprehensive health monitoring for all components
 */

import { createLogger } from './logger';
import type { SimpleRouter } from '../core/router';
import type { AIClient } from '../ai/interface';
import { getCacheManager } from '../cache/cache-manager';
import { getCircuitBreakerManager } from '../resilience/circuit-breaker-manager';
import os from 'os';

const logger = createLogger('health-check');

/**
 * Health status levels
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * Individual component health check result
 */
export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  details?: Record<string, unknown>;
  responseTime?: number;
  lastChecked?: Date;
}

/**
 * Overall system health
 */
export interface SystemHealth {
  status: HealthStatus;
  timestamp: Date;
  version: string;
  uptime: number;
  components: ComponentHealth[];
  system?: {
    cpu: number;
    memory: {
      total: number;
      used: number;
      percentage: number;
    };
    loadAverage: number[];
  };
}

/**
 * Health check function type
 */
export type HealthCheckFn = () => Promise<ComponentHealth>;

/**
 * Health check manager
 */
export class HealthCheckManager {
  private checks = new Map<string, HealthCheckFn>();
  private lastResults = new Map<string, ComponentHealth>();
  private checkInterval: NodeJS.Timeout | undefined = undefined;

  constructor(
    private router?: SimpleRouter,
    private aiClient?: AIClient,
  ) {
    this.registerDefaultChecks();
  }

  /**
   * Register default health checks
   */
  private registerDefaultChecks(): void {
    // Router health check
    if (this.router) {
      this.register('router', async () => {
        const startTime = Date.now();
        try {
          const librarianCount = this.router!.getAllLibrarians().length;
          return {
            name: 'router',
            status: librarianCount > 0 ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
            message: `${librarianCount} librarians registered`,
            details: {
              librarianCount,
              librarians: this.router!.getAllLibrarians(),
            },
            responseTime: Date.now() - startTime,
          };
        } catch (error) {
          logger.error(
            {
              err: error,
              component: 'router',
              errorCode: 'HEALTH_CHECK_FAILED',
              errorType: 'COMPONENT_ERROR',
            },
            'Router health check failed',
          );

          return {
            name: 'router',
            status: HealthStatus.UNHEALTHY,
            message: error instanceof Error ? error.message : 'Unknown error',
            responseTime: Date.now() - startTime,
          };
        }
      });
    }

    // AI Client health check
    if (this.aiClient) {
      this.register('ai-client', async () => {
        const startTime = Date.now();
        try {
          const isAvailable = this.aiClient!.defaultProvider.isAvailable();
          const providerCount = Object.keys(this.aiClient!.providers).length;

          return {
            name: 'ai-client',
            status: isAvailable ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
            message: `${providerCount} provider(s) configured`,
            details: {
              defaultProvider: this.aiClient!.defaultProvider.name,
              providers: Object.keys(this.aiClient!.providers),
              isAvailable,
            },
            responseTime: Date.now() - startTime,
          };
        } catch (error) {
          logger.error(
            {
              err: error,
              component: 'ai-client',
              errorCode: 'HEALTH_CHECK_FAILED',
              errorType: 'COMPONENT_ERROR',
            },
            'AI client health check failed',
          );

          return {
            name: 'ai-client',
            status: HealthStatus.UNHEALTHY,
            message: error instanceof Error ? error.message : 'Unknown error',
            responseTime: Date.now() - startTime,
          };
        }
      });
    }

    // Cache health check
    this.register('cache', async () => {
      const startTime = Date.now();
      try {
        const cacheManager = getCacheManager();

        // Test cache operations with a simple test
        const testQuery = 'health check';
        const testValue = { answer: 'health check response' };
        const testContext = { requestId: 'health-check' };

        await cacheManager.set('system', testQuery, testContext, testValue);
        const retrieved = await cacheManager.get('system', testQuery, testContext);

        const isHealthy = retrieved?.answer === testValue.answer;

        return {
          name: 'cache',
          status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
          message: 'Cache operations tested',
          details: {
            testPassed: isHealthy,
            cacheEnabled: cacheManager.isEnabled(),
          },
          responseTime: Date.now() - startTime,
        };
      } catch (error) {
        logger.error(
          {
            err: error,
            component: 'cache',
            errorCode: 'HEALTH_CHECK_FAILED',
            errorType: 'COMPONENT_ERROR',
          },
          'Cache health check failed',
        );

        return {
          name: 'cache',
          status: HealthStatus.UNHEALTHY,
          message: error instanceof Error ? error.message : 'Unknown error',
          responseTime: Date.now() - startTime,
        };
      }
    });

    // Circuit breaker health check
    this.register('circuit-breakers', async () => {
      const startTime = Date.now();
      try {
        const manager = getCircuitBreakerManager();
        const breakerInfo = manager.getStatus();

        let openCount = 0;
        let halfOpenCount = 0;
        const breakerStates: Record<string, string> = {};
        let totalBreakers = 0;

        // Count breaker states from status info
        for (const [name, info] of Object.entries(breakerInfo)) {
          if (info && typeof info === 'object' && 'state' in info) {
            totalBreakers++;
            const state = (info as any).state;
            breakerStates[name] = state;

            if (state === 'open') openCount++;
            if (state === 'half-open') halfOpenCount++;
          }
        }

        const status =
          openCount > 0
            ? HealthStatus.UNHEALTHY
            : halfOpenCount > 0
              ? HealthStatus.DEGRADED
              : HealthStatus.HEALTHY;

        return {
          name: 'circuit-breakers',
          status,
          message: `${totalBreakers} breakers monitored`,
          details: {
            totalBreakers,
            openBreakers: openCount,
            halfOpenBreakers: halfOpenCount,
            states: breakerStates,
          },
          responseTime: Date.now() - startTime,
        };
      } catch (error) {
        logger.error(
          {
            err: error,
            component: 'circuit-breakers',
            errorCode: 'HEALTH_CHECK_FAILED',
            errorType: 'COMPONENT_ERROR',
          },
          'Circuit breaker health check failed',
        );

        return {
          name: 'circuit-breakers',
          status: HealthStatus.UNHEALTHY,
          message: error instanceof Error ? error.message : 'Unknown error',
          responseTime: Date.now() - startTime,
        };
      }
    });

    // Memory health check
    this.register('memory', async () => {
      const startTime = Date.now();
      try {
        const memUsage = process.memoryUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memPercentage = (usedMem / totalMem) * 100;

        // Check Node.js heap usage
        const heapPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

        const status =
          heapPercentage > 90 || memPercentage > 90
            ? HealthStatus.UNHEALTHY
            : heapPercentage > 70 || memPercentage > 70
              ? HealthStatus.DEGRADED
              : HealthStatus.HEALTHY;

        return {
          name: 'memory',
          status,
          message: `Heap: ${heapPercentage.toFixed(1)}%, System: ${memPercentage.toFixed(1)}%`,
          details: {
            process: {
              rss: memUsage.rss,
              heapTotal: memUsage.heapTotal,
              heapUsed: memUsage.heapUsed,
              heapPercentage,
              external: memUsage.external,
            },
            system: {
              total: totalMem,
              used: usedMem,
              free: freeMem,
              percentage: memPercentage,
            },
          },
          responseTime: Date.now() - startTime,
        };
      } catch (error) {
        logger.error(
          {
            err: error,
            component: 'memory',
            errorCode: 'HEALTH_CHECK_FAILED',
            errorType: 'COMPONENT_ERROR',
          },
          'Memory health check failed',
        );

        return {
          name: 'memory',
          status: HealthStatus.UNHEALTHY,
          message: error instanceof Error ? error.message : 'Unknown error',
          responseTime: Date.now() - startTime,
        };
      }
    });
  }

  /**
   * Register a health check
   */
  register(name: string, check: HealthCheckFn): void {
    this.checks.set(name, check);
    logger.info(
      {
        checkName: name,
        totalChecks: this.checks.size,
      },
      'Health check registered',
    );
  }

  /**
   * Unregister a health check
   */
  unregister(name: string): void {
    this.checks.delete(name);
    this.lastResults.delete(name);
  }

  /**
   * Run all health checks
   */
  async checkAll(): Promise<SystemHealth> {
    const startTime = Date.now();
    const results: ComponentHealth[] = [];

    // Run all checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, check]) => {
      try {
        const result = await check();
        result.lastChecked = new Date();
        this.lastResults.set(name, result);
        return result;
      } catch (error) {
        logger.error(
          {
            err: error,
            checkName: name,
            errorCode: 'HEALTH_CHECK_ERROR',
            errorType: 'EXECUTION_ERROR',
          },
          'Health check execution failed',
        );

        const errorResult: ComponentHealth = {
          name,
          status: HealthStatus.UNHEALTHY,
          message: 'Health check failed',
          lastChecked: new Date(),
        };
        this.lastResults.set(name, errorResult);
        return errorResult;
      }
    });

    results.push(...(await Promise.all(checkPromises)));

    // Determine overall status
    const hasUnhealthy = results.some((r) => r.status === HealthStatus.UNHEALTHY);
    const hasDegraded = results.some((r) => r.status === HealthStatus.DEGRADED);

    const overallStatus = hasUnhealthy
      ? HealthStatus.UNHEALTHY
      : hasDegraded
        ? HealthStatus.DEGRADED
        : HealthStatus.HEALTHY;

    // Get system metrics
    const cpuUsage = os.loadavg()[0]; // 1-minute load average
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const health: SystemHealth = {
      status: overallStatus,
      timestamp: new Date(),
      version: process.env.npm_package_version || '0.1.0',
      uptime: process.uptime(),
      components: results,
      ...(cpuUsage !== undefined && {
        system: {
          cpu: cpuUsage,
          memory: {
            total: totalMem,
            used: usedMem,
            percentage: (usedMem / totalMem) * 100,
          },
          loadAverage: os.loadavg(),
        },
      }),
    };

    logger.info(
      {
        status: overallStatus,
        componentCount: results.length,
        unhealthyCount: results.filter((r) => r.status === HealthStatus.UNHEALTHY).length,
        degradedCount: results.filter((r) => r.status === HealthStatus.DEGRADED).length,
        checkDuration: Date.now() - startTime,
      },
      'Health check completed',
    );

    return health;
  }

  /**
   * Get cached results without running checks
   */
  getCachedResults(): SystemHealth {
    const results = Array.from(this.lastResults.values());

    const hasUnhealthy = results.some((r) => r.status === HealthStatus.UNHEALTHY);
    const hasDegraded = results.some((r) => r.status === HealthStatus.DEGRADED);

    const overallStatus = hasUnhealthy
      ? HealthStatus.UNHEALTHY
      : hasDegraded
        ? HealthStatus.DEGRADED
        : HealthStatus.HEALTHY;

    return {
      status: overallStatus,
      timestamp: new Date(),
      version: process.env.npm_package_version || '0.1.0',
      uptime: process.uptime(),
      components: results,
    };
  }

  /**
   * Start periodic health checks
   */
  startPeriodicChecks(intervalMs: number = 30000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Run initial check
    void this.checkAll();

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      void this.checkAll();
    }, intervalMs);

    logger.info(
      {
        intervalMs,
        intervalSeconds: intervalMs / 1000,
      },
      'Started periodic health checks',
    );
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks(): void {
    if (this.checkInterval !== undefined) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      logger.info('Stopped periodic health checks');
    }
  }
}

// Global health check manager instance
let globalHealthManager: HealthCheckManager | null = null;

/**
 * Initialize the global health check manager
 */
export function initializeHealthChecks(
  router?: SimpleRouter,
  aiClient?: AIClient,
): HealthCheckManager {
  if (!globalHealthManager) {
    globalHealthManager = new HealthCheckManager(router, aiClient);
  }
  return globalHealthManager;
}

/**
 * Get the global health check manager
 */
export function getHealthCheckManager(): HealthCheckManager {
  if (!globalHealthManager) {
    throw new Error('Health check manager not initialized');
  }
  return globalHealthManager;
}

/**
 * Express middleware for health endpoints
 */
export function createHealthEndpoints(app: any): void {
  const manager = getHealthCheckManager();

  // Comprehensive health check endpoint
  app.get('/health', async (_req: any, res: any) => {
    try {
      const health = await manager.checkAll();
      const statusCode = health.status === HealthStatus.HEALTHY ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      logger.error(
        {
          err: error,
          errorCode: 'HEALTH_ENDPOINT_ERROR',
          errorType: 'API_ERROR',
        },
        'Health endpoint error',
      );

      res.status(503).json({
        status: HealthStatus.UNHEALTHY,
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Kubernetes liveness probe (basic check)
  app.get('/health/live', (_req: any, res: any) => {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date(),
    });
  });

  // Kubernetes readiness probe (checks if ready to serve traffic)
  app.get('/health/ready', async (_req: any, res: any) => {
    try {
      const health = manager.getCachedResults();

      // Only ready if healthy or degraded (not unhealthy)
      const isReady = health.status !== HealthStatus.UNHEALTHY;
      const statusCode = isReady ? 200 : 503;

      res.status(statusCode).json({
        ready: isReady,
        status: health.status,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error(
        {
          err: error,
          errorCode: 'READINESS_ENDPOINT_ERROR',
          errorType: 'API_ERROR',
        },
        'Readiness endpoint error',
      );

      res.status(503).json({
        ready: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
