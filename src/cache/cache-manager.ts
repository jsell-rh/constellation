/**
 * Cache Manager
 * Manages cache instances per librarian and provides a unified interface
 */

import { EventEmitter } from 'events';
import pino from 'pino';
import type { Cache, CacheConfig, LibrarianCacheConfig, CacheMetrics } from './interface';
import { ValkeyAdapter } from './valkey-adapter';
import { MemoryAdapter } from './memory-adapter';
import { CacheKeyGenerator, defaultCacheKeyGenerator } from './cache-key-generator';
import type { Context, Response } from '../types/core';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export interface CacheManagerConfig {
  /** Global cache configuration */
  cache: CacheConfig;

  /** Default per-librarian cache settings */
  defaults?: Partial<LibrarianCacheConfig>;

  /** Enable caching globally */
  enabled?: boolean;
}

export class CacheManager extends EventEmitter {
  private cacheInstance: Cache | null = null;
  private config: CacheManagerConfig;
  private keyGenerator: CacheKeyGenerator;
  private librarianConfigs = new Map<string, LibrarianCacheConfig>();

  constructor(config: CacheManagerConfig) {
    super();
    this.config = config;
    this.keyGenerator = defaultCacheKeyGenerator;
  }

  /**
   * Initialize the cache manager
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled || this.config.cache.type === 'none') {
      logger.info('Caching disabled');
      return;
    }

    try {
      this.cacheInstance = await this.createCacheInstance();
      logger.info({ type: this.config.cache.type }, 'Cache manager initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize cache manager');
      throw error;
    }
  }

  /**
   * Get a cached response for a librarian query
   */
  async get<T extends Response>(
    librarianId: string,
    query: string,
    context: Context,
  ): Promise<T | null> {
    if (!this.cacheInstance) {
      return null;
    }

    const librarianConfig = this.getLibrarianConfig(librarianId);

    if (!librarianConfig.enabled) {
      return null;
    }

    try {
      const cacheKey = this.keyGenerator.generateKey(librarianId, query, context, librarianConfig);

      const cached = await this.cacheInstance.get<T>(cacheKey);

      if (cached) {
        this.emit('hit', { librarianId, query: query.substring(0, 50) });
        logger.debug({ librarianId, cacheKey }, 'Cache hit');
      } else {
        this.emit('miss', { librarianId, query: query.substring(0, 50) });
        logger.debug({ librarianId, cacheKey }, 'Cache miss');
      }

      return cached;
    } catch (error) {
      logger.error({ error, librarianId }, 'Error getting from cache');
      this.emit('error', { error, operation: 'get', librarianId });
      return null; // Fail gracefully
    }
  }

  /**
   * Cache a response for a librarian query
   */
  async set<T extends Response>(
    librarianId: string,
    query: string,
    context: Context,
    response: T,
  ): Promise<void> {
    if (!this.cacheInstance) {
      return;
    }

    const librarianConfig = this.getLibrarianConfig(librarianId);

    if (!librarianConfig.enabled) {
      return;
    }

    // Don't cache errors unless explicitly configured
    if (response.error && !librarianConfig.cacheErrors) {
      return;
    }

    try {
      const cacheKey = this.keyGenerator.generateKey(librarianId, query, context, librarianConfig);

      const ttl = librarianConfig.ttl ?? this.config.cache.defaultTtl;
      const tags = librarianConfig.tags || [librarianId];

      const cacheOptions: { ttl?: number; tags: string[] } = { tags };
      if (ttl) {
        cacheOptions.ttl = ttl;
      }

      await this.cacheInstance.set(cacheKey, response, cacheOptions);

      this.emit('set', { librarianId, query: query.substring(0, 50), ttl });
      logger.debug({ librarianId, cacheKey, ttl }, 'Response cached');
    } catch (error) {
      logger.error({ error, librarianId }, 'Error setting cache');
      this.emit('error', { error, operation: 'set', librarianId });
      // Don't throw - caching errors shouldn't break the response
    }
  }

  /**
   * Invalidate cache entries for a librarian
   */
  async invalidate(librarianId: string): Promise<number> {
    if (!this.cacheInstance) {
      return 0;
    }

    try {
      const invalidated = await this.cacheInstance.invalidateByTags([librarianId]);
      logger.info({ librarianId, invalidated }, 'Cache invalidated');
      this.emit('invalidate', { librarianId, count: invalidated });
      return invalidated;
    } catch (error) {
      logger.error({ error, librarianId }, 'Error invalidating cache');
      this.emit('error', { error, operation: 'invalidate', librarianId });
      return 0;
    }
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    if (!this.cacheInstance) {
      return 0;
    }

    try {
      const invalidated = await this.cacheInstance.invalidateByTags(tags);
      logger.info({ tags, invalidated }, 'Cache invalidated by tags');
      this.emit('invalidateByTags', { tags, count: invalidated });
      return invalidated;
    } catch (error) {
      logger.error({ error, tags }, 'Error invalidating cache by tags');
      this.emit('error', { error, operation: 'invalidateByTags', tags });
      return 0;
    }
  }

  /**
   * Configure caching for a specific librarian
   */
  configureLibrarian(librarianId: string, config: LibrarianCacheConfig): void {
    this.librarianConfigs.set(librarianId, {
      ...this.config.defaults,
      ...config,
    });

    logger.debug({ librarianId, config }, 'Librarian cache configured');
  }

  /**
   * Get cache metrics for all librarians
   */
  getMetrics(): CacheMetrics | null {
    if (!this.cacheInstance) {
      return null;
    }

    return this.cacheInstance.getMetrics();
  }

  /**
   * Get cache metrics by librarian (simplified - could be enhanced)
   */
  getLibrarianMetrics(): Record<string, { configured: boolean; enabled: boolean }> {
    const metrics: Record<string, { configured: boolean; enabled: boolean }> = {};

    for (const [librarianId, config] of this.librarianConfigs) {
      metrics[librarianId] = {
        configured: true,
        enabled: config.enabled ?? true,
      };
    }

    return metrics;
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    if (!this.cacheInstance) {
      return;
    }

    try {
      await this.cacheInstance.clear();
      logger.info('All caches cleared');
      this.emit('clear');
    } catch (error) {
      logger.error({ error }, 'Error clearing cache');
      this.emit('error', { error, operation: 'clear' });
      throw error;
    }
  }

  /**
   * Close the cache manager
   */
  async close(): Promise<void> {
    if (this.cacheInstance) {
      await this.cacheInstance.close();
      this.cacheInstance = null;
    }

    this.librarianConfigs.clear();
    logger.info('Cache manager closed');
  }

  /**
   * Create appropriate cache instance based on configuration
   */
  private async createCacheInstance(): Promise<Cache> {
    switch (this.config.cache.type) {
      case 'valkey': {
        const adapter = new ValkeyAdapter(this.config.cache);
        await adapter.connect();
        return adapter;
      }

      case 'memory':
        return new MemoryAdapter(this.config.cache);

      case 'none':
      default:
        throw new Error(`Unsupported cache type: ${this.config.cache.type}`);
    }
  }

  /**
   * Get cache configuration for a librarian
   */
  private getLibrarianConfig(librarianId: string): LibrarianCacheConfig {
    const existingConfig = this.librarianConfigs.get(librarianId);
    if (existingConfig) {
      return existingConfig;
    }

    const defaultConfig: LibrarianCacheConfig = {
      enabled: this.config.defaults?.enabled ?? false,
      strategy: this.config.defaults?.strategy ?? 'user-aware',
      cacheErrors: this.config.defaults?.cacheErrors ?? false,
    };

    if (this.config.defaults?.ttl) {
      defaultConfig.ttl = this.config.defaults.ttl;
    }

    return defaultConfig;
  }
}

/**
 * Global cache manager instance
 */
let globalCacheManager: CacheManager | null = null;

/**
 * Get the global cache manager instance
 */
export function getCacheManager(): CacheManager {
  if (!globalCacheManager) {
    // Default configuration - will be overridden during app initialization
    const cacheConfig: CacheConfig = {
      type: (process.env.CACHE_TYPE as 'valkey' | 'memory' | 'none') || 'memory',
      defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL ?? '3600', 10),
      keyPrefix: process.env.CACHE_KEY_PREFIX || 'constellation',
    };

    const valkeyUrl = process.env.VALKEY_URL || process.env.REDIS_URL;
    if (valkeyUrl) {
      cacheConfig.url = valkeyUrl;
    }

    globalCacheManager = new CacheManager({
      enabled: process.env.CACHE_ENABLED !== 'false',
      cache: cacheConfig,
      defaults: {
        enabled: true,
        strategy: 'user-aware',
        cacheErrors: false,
      },
    });
  }

  return globalCacheManager;
}

/**
 * Set the global cache manager instance
 */
export function setCacheManager(manager: CacheManager): void {
  globalCacheManager = manager;
}

/**
 * Reset the global cache manager (for testing)
 */
export function resetCacheManager(): void {
  if (globalCacheManager) {
    void globalCacheManager.close();
  }
  globalCacheManager = null;
}
