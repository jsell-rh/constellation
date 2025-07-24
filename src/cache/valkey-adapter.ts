/**
 * Valkey Cache Adapter
 * Implements the Cache interface using Valkey (Redis fork)
 */

import ValkeyClient, { Redis, Cluster } from 'iovalkey';
import { createLogger } from '../observability/logger';
import type { Cache, CacheConfig, CacheOptions, CacheMetrics } from './interface';

const logger = createLogger('valkey-adapter');

type ValkeyClientType = Redis | Cluster;

export class ValkeyAdapter implements Cache {
  private client: ValkeyClientType;
  private config: CacheConfig;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    avgResponseTime: 0,
  };
  private responseTimes: number[] = [];

  constructor(config: CacheConfig) {
    this.config = config;
    this.client = this.createClient();
  }

  /**
   * Initialize the Valkey connection
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Connected to Valkey', {
        url: this.config.url,
        adapter: 'valkey',
      });
    } catch (error) {
      logger.error('Failed to connect to Valkey', {
        err: error,
        url: this.config.url,
        errorCode: 'VALKEY_CONNECTION_FAILED',
        errorType: 'infrastructure',
        recoverable: true,
      });
      throw error;
    }
  }

  /**
   * Get a value from cache
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      const value = await this.client.get(this.prefixKey(key));
      const responseTime = Date.now() - startTime;
      this.updateResponseTime(responseTime);

      if (value === null) {
        this.metrics.misses++;
        return null;
      }

      this.metrics.hits++;
      return this.deserialize<T>(value);
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache get error', {
        err: error,
        key,
        operation: 'get',
        errorCode: 'CACHE_GET_ERROR',
        errorType: 'cache',
        recoverable: true,
      });
      return null; // Fail gracefully
    }
  }

  /**
   * Set a value in cache
   */
  async set<T = unknown>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const startTime = Date.now();

    try {
      const serializedValue = this.serialize(value);
      const prefixedKey = this.prefixKey(key);
      const ttl = options.ttl ?? this.config.defaultTtl ?? 3600; // Default 1 hour

      if (ttl > 0) {
        await this.client.setex(prefixedKey, ttl, serializedValue);
      } else {
        await this.client.set(prefixedKey, serializedValue);
      }

      // Handle tags for invalidation
      if (options.tags && options.tags.length > 0) {
        await this.setTags(key, options.tags);
      }

      const responseTime = Date.now() - startTime;
      this.updateResponseTime(responseTime);
      this.metrics.sets++;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache set error', {
        err: error,
        key,
        operation: 'set',
        errorCode: 'CACHE_SET_ERROR',
        errorType: 'cache',
        recoverable: false,
      });
      throw error; // Don't fail silently for sets
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(this.prefixKey(key));
      this.metrics.deletes++;
      return result > 0;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache delete error', {
        err: error,
        key,
        operation: 'delete',
        errorCode: 'CACHE_DELETE_ERROR',
        errorType: 'cache',
        recoverable: true,
      });
      return false;
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(this.prefixKey(key));
      return result === 1;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache exists error', {
        err: error,
        key,
        operation: 'exists',
        errorCode: 'CACHE_EXISTS_ERROR',
        errorType: 'cache',
        recoverable: true,
      });
      return false;
    }
  }

  /**
   * Clear all cache entries (use with caution)
   */
  async clear(): Promise<void> {
    try {
      const pattern = this.prefixKey('*');
      const keys = await this.client.keys(pattern);

      if (keys.length > 0) {
        await this.client.del(...keys);
      }

      logger.info('Cache cleared', {
        keysDeleted: keys.length,
        operation: 'clear',
      });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache clear error', {
        err: error,
        operation: 'clear',
        errorCode: 'CACHE_CLEAR_ERROR',
        errorType: 'cache',
        recoverable: false,
      });
      throw error;
    }
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let totalInvalidated = 0;

    try {
      for (const tag of tags) {
        const tagKey = this.prefixKey(`tag:${tag}`);
        const keys = await this.client.smembers(tagKey);

        if (keys.length > 0) {
          // Delete the actual cache entries
          await this.client.del(...keys.map((key: string) => this.prefixKey(key)));
          // Delete the tag set
          await this.client.del(tagKey);
          totalInvalidated += keys.length;
        }
      }

      if (totalInvalidated > 0) {
        logger.info('Cache invalidated by tags', {
          tags,
          keysInvalidated: totalInvalidated,
          operation: 'invalidate_by_tags',
        });
      }

      return totalInvalidated;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache tag invalidation error', {
        err: error,
        tags,
        operation: 'invalidate_by_tags',
        errorCode: 'CACHE_TAG_INVALIDATION_ERROR',
        errorType: 'cache',
        recoverable: true,
      });
      return 0;
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Close the cache connection
   */
  async close(): Promise<void> {
    try {
      await this.client.quit();
      logger.info('Valkey connection closed', {
        adapter: 'valkey',
      });
    } catch (error) {
      logger.error('Error closing Valkey connection', {
        err: error,
        errorCode: 'VALKEY_CLOSE_ERROR',
        errorType: 'infrastructure',
        recoverable: true,
      });
    }
  }

  /**
   * Create Valkey client based on configuration
   */
  private createClient(): ValkeyClientType {
    const url = this.config.url || process.env.VALKEY_URL || 'redis://localhost:6379';

    return new ValkeyClient(url, {
      connectTimeout: 5000,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
  }

  /**
   * Add key prefix
   */
  private prefixKey(key: string): string {
    const prefix = this.config.keyPrefix || 'constellation';
    return `${prefix}:${key}`;
  }

  /**
   * Serialize value for storage
   */
  private serialize<T>(value: T): string {
    try {
      if (typeof value === 'string') {
        return value;
      }
      return JSON.stringify(value);
    } catch (error) {
      logger.error('Serialization error', {
        err: error,
        valueType: typeof value,
        errorCode: 'CACHE_SERIALIZATION_ERROR',
        errorType: 'data',
        recoverable: false,
      });
      throw new Error('Failed to serialize cache value');
    }
  }

  /**
   * Deserialize value from storage
   */
  private deserialize<T>(value: string): T {
    try {
      // Try to parse as JSON first
      return JSON.parse(value) as T;
    } catch {
      // If parsing fails, return as string
      return value as unknown as T;
    }
  }

  /**
   * Set tags for a cache key (for invalidation)
   */
  private async setTags(key: string, tags: string[]): Promise<void> {
    const pipeline = this.client.multi();

    for (const tag of tags) {
      const tagKey = this.prefixKey(`tag:${tag}`);
      pipeline.sadd(tagKey, key);
      // Set TTL for tag sets to prevent memory leaks
      pipeline.expire(tagKey, 86400); // 24 hours
    }

    await pipeline.exec();
  }

  /**
   * Update response time metrics
   */
  private updateResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);

    // Keep only the last 100 response times for rolling average
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }

    this.metrics.avgResponseTime =
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
  }
}
