/**
 * Memory Cache Adapter
 * Simple in-memory cache implementation for development and testing
 */

import pino from 'pino';
import type { Cache, CacheConfig, CacheOptions, CacheMetrics } from './interface';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt?: number;
  tags?: string[];
}

export class MemoryAdapter implements Cache {
  private storage = new Map<string, CacheEntry>();
  private tagIndex = new Map<string, Set<string>>(); // tag -> keys
  private config: CacheConfig;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    avgResponseTime: 0,
  };
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: CacheConfig) {
    this.config = config;

    // Start cleanup interval for expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  /**
   * Get a value from cache
   */
  get<T = unknown>(key: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      const entry = this.storage.get(this.prefixKey(key));

      if (!entry) {
        this.metrics.misses++;
        return Promise.resolve(null);
      }

      // Check if expired
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        this.storage.delete(this.prefixKey(key));
        this.removeFromTagIndex(key, entry.tags);
        this.metrics.misses++;
        return Promise.resolve(null);
      }

      this.metrics.hits++;
      this.updateResponseTime(Date.now() - startTime);
      return Promise.resolve(entry.value as T);
    } catch (error) {
      this.metrics.errors++;
      logger.error({ error, key }, 'Memory cache get error');
      return Promise.resolve(null);
    }
  }

  /**
   * Set a value in cache
   */
  set<T = unknown>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const startTime = Date.now();

    try {
      const ttl = options.ttl ?? this.config.defaultTtl;
      const entry: CacheEntry<T> = {
        value,
      };

      if (options.tags) {
        entry.tags = options.tags;
      }

      if (ttl && ttl > 0) {
        entry.expiresAt = Date.now() + ttl * 1000;
      }

      const prefixedKey = this.prefixKey(key);

      // Remove old entry from tag index if it exists
      const oldEntry = this.storage.get(prefixedKey);
      if (oldEntry?.tags) {
        this.removeFromTagIndex(key, oldEntry.tags);
      }

      this.storage.set(prefixedKey, entry);

      // Update tag index
      if (options.tags && options.tags.length > 0) {
        this.addToTagIndex(key, options.tags);
      }

      this.metrics.sets++;
      this.updateResponseTime(Date.now() - startTime);
      return Promise.resolve();
    } catch (error) {
      this.metrics.errors++;
      logger.error({ error, key }, 'Memory cache set error');
      return Promise.reject(error);
    }
  }

  /**
   * Delete a value from cache
   */
  delete(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.prefixKey(key);
      const entry = this.storage.get(prefixedKey);

      if (entry) {
        this.storage.delete(prefixedKey);
        this.removeFromTagIndex(key, entry.tags);
        this.metrics.deletes++;
        return Promise.resolve(true);
      }

      return Promise.resolve(false);
    } catch (error) {
      this.metrics.errors++;
      logger.error({ error, key }, 'Memory cache delete error');
      return Promise.resolve(false);
    }
  }

  /**
   * Check if a key exists in cache
   */
  exists(key: string): Promise<boolean> {
    try {
      const entry = this.storage.get(this.prefixKey(key));

      if (!entry) {
        return Promise.resolve(false);
      }

      // Check if expired
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        this.storage.delete(this.prefixKey(key));
        this.removeFromTagIndex(key, entry.tags);
        return Promise.resolve(false);
      }

      return Promise.resolve(true);
    } catch (error) {
      this.metrics.errors++;
      logger.error({ error, key }, 'Memory cache exists error');
      return Promise.resolve(false);
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): Promise<void> {
    try {
      const count = this.storage.size;
      this.storage.clear();
      this.tagIndex.clear();
      logger.info({ keysDeleted: count }, 'Memory cache cleared');
      return Promise.resolve();
    } catch (error) {
      this.metrics.errors++;
      logger.error({ error }, 'Memory cache clear error');
      return Promise.reject(error);
    }
  }

  /**
   * Invalidate cache entries by tags
   */
  invalidateByTags(tags: string[]): Promise<number> {
    let totalInvalidated = 0;

    try {
      for (const tag of tags) {
        const keys = this.tagIndex.get(tag);

        if (keys && keys.size > 0) {
          for (const key of keys) {
            const prefixedKey = this.prefixKey(key);
            if (this.storage.delete(prefixedKey)) {
              totalInvalidated++;
            }
          }

          // Clear the tag index
          this.tagIndex.delete(tag);
        }
      }

      if (totalInvalidated > 0) {
        logger.info({ tags, invalidated: totalInvalidated }, 'Memory cache invalidated by tags');
      }

      return Promise.resolve(totalInvalidated);
    } catch (error) {
      this.metrics.errors++;
      logger.error({ error, tags }, 'Memory cache tag invalidation error');
      return Promise.resolve(0);
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Close the cache (cleanup)
   */
  close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.storage.clear();
    this.tagIndex.clear();
    logger.info('Memory cache closed');
    return Promise.resolve();
  }

  /**
   * Get current storage size (for monitoring)
   */
  getSize(): number {
    return this.storage.size;
  }

  /**
   * Add key prefix
   */
  private prefixKey(key: string): string {
    const prefix = this.config.keyPrefix || 'constellation';
    return `${prefix}:${key}`;
  }

  /**
   * Add key to tag index
   */
  private addToTagIndex(key: string, tags: string[]): void {
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  /**
   * Remove key from tag index
   */
  private removeFromTagIndex(key: string, tags?: string[]): void {
    if (!tags) return;

    for (const tag of tags) {
      const tagKeys = this.tagIndex.get(tag);
      if (tagKeys) {
        tagKeys.delete(key);
        if (tagKeys.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.storage.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.storage.delete(key);
        this.removeFromTagIndex(key.replace(`${this.config.keyPrefix}:`, ''), entry.tags);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug({ cleaned }, 'Cleaned up expired cache entries');
    }
  }

  /**
   * Update response time metrics
   */
  private updateResponseTime(responseTime: number): void {
    // Simple moving average for memory cache (much faster than Valkey)
    this.metrics.avgResponseTime = this.metrics.avgResponseTime * 0.9 + responseTime * 0.1;
  }
}
