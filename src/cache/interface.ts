/**
 * Cache interface for Constellation
 * Provides a simple abstraction over distributed caching
 */

export interface CacheOptions {
  /** TTL in seconds (0 = no expiry) */
  ttl?: number;
  /** Tags for cache invalidation */
  tags?: string[];
  /** Whether to compress large values */
  compress?: boolean;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  avgResponseTime: number;
}

export interface Cache {
  /**
   * Get a value from cache
   */
  get<T = unknown>(key: string): Promise<T | null>;

  /**
   * Set a value in cache
   */
  set<T = unknown>(key: string, value: T, options?: CacheOptions): Promise<void>;

  /**
   * Delete a value from cache
   */
  delete(key: string): Promise<boolean>;

  /**
   * Check if a key exists in cache
   */
  exists(key: string): Promise<boolean>;

  /**
   * Clear all cache entries (use with caution)
   */
  clear(): Promise<void>;

  /**
   * Invalidate cache entries by tags
   */
  invalidateByTags(tags: string[]): Promise<number>;

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics;

  /**
   * Close the cache connection
   */
  close(): Promise<void>;
}

export interface CacheConfig {
  /** Cache type */
  type: 'valkey' | 'memory' | 'none';

  /** Connection string for distributed caches */
  url?: string;

  /** Default TTL in seconds */
  defaultTtl?: number;

  /** Key prefix */
  keyPrefix?: string;

  /** Enable compression for values larger than this (bytes) */
  compressionThreshold?: number;

  /** Maximum key length */
  maxKeyLength?: number;

  /** Connection pool settings */
  pool?: {
    min?: number;
    max?: number;
    acquireTimeoutMillis?: number;
  };
}

/**
 * Per-librarian cache configuration
 */
export interface LibrarianCacheConfig {
  /** Enable caching for this librarian */
  enabled?: boolean;

  /** TTL in seconds (overrides default) */
  ttl?: number;

  /** Cache strategy */
  strategy?: 'user-aware' | 'global' | 'team-aware';

  /** Tags for invalidation */
  tags?: string[];

  /** Whether to cache errors */
  cacheErrors?: boolean;

  /** Maximum cached responses per user */
  maxEntriesPerUser?: number;

  /** Cache warming configuration */
  warmup?: {
    enabled: boolean;
    queries: string[];
    schedule?: string; // cron expression
  };
}
