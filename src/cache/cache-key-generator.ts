/**
 * Cache Key Generator
 * Generates secure, consistent cache keys that include user context
 * to prevent unauthorized access to cached responses
 */

import crypto from 'crypto';
import type { Context } from '../types/core';
import type { LibrarianCacheConfig } from './interface';

export interface CacheKeyComponents {
  librarian?: string;
  query?: string;
  userContext?: string;
  timestamp?: number;
}

export class CacheKeyGenerator {
  private readonly keyPrefix: string;
  private readonly maxKeyLength: number;

  constructor(keyPrefix = 'constellation', maxKeyLength = 250) {
    this.keyPrefix = keyPrefix;
    this.maxKeyLength = maxKeyLength;
  }

  /**
   * Generate a cache key for a librarian query
   */
  generateKey(
    librarianId: string,
    query: string,
    context: Context,
    config: LibrarianCacheConfig,
  ): string {
    const components: CacheKeyComponents = {
      librarian: librarianId,
      query: this.normalizeQuery(query),
      userContext: this.generateUserContext(context, config),
    };

    // Create base key
    const baseKey = `${this.keyPrefix}:${components.librarian}:${components.userContext}`;

    // Hash the query to keep keys manageable
    const queryHash = this.hashQuery(components.query || '');

    const fullKey = `${baseKey}:${queryHash}`;

    // Ensure key doesn't exceed maximum length
    if (fullKey.length > this.maxKeyLength) {
      // Hash the entire key if it's too long
      const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
      return `${this.keyPrefix}:${keyHash}`;
    }

    return fullKey;
  }

  /**
   * Generate invalidation key for tag-based cache invalidation
   */
  generateTagKey(tag: string): string {
    return `${this.keyPrefix}:tag:${tag}`;
  }

  /**
   * Generate team-scoped cache key
   */
  generateTeamKey(librarianId: string, team: string, query: string): string {
    const queryHash = this.hashQuery(this.normalizeQuery(query));
    return `${this.keyPrefix}:team:${team}:${librarianId}:${queryHash}`;
  }

  /**
   * Generate global cache key (no user context)
   */
  generateGlobalKey(librarianId: string, query: string): string {
    const queryHash = this.hashQuery(this.normalizeQuery(query));
    return `${this.keyPrefix}:global:${librarianId}:${queryHash}`;
  }

  /**
   * Extract components from a cache key (for debugging)
   */
  parseKey(key: string): Partial<CacheKeyComponents> | null {
    const parts = key.split(':');

    if (parts.length < 3 || parts[0] !== this.keyPrefix) {
      return null;
    }

    // This is a simplified parser - in practice, we'd need more sophisticated parsing
    const result: Partial<CacheKeyComponents> = {};
    if (parts.length > 1 && parts[1]) {
      result.librarian = parts[1];
    }
    if (parts.length > 2 && parts[2]) {
      result.userContext = parts[2];
    }
    return result;
  }

  /**
   * Normalize query text for consistent caching
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
      .substring(0, 200); // Limit length
  }

  /**
   * Generate user context for cache key
   */
  private generateUserContext(context: Context, config: LibrarianCacheConfig): string {
    const strategy = config.strategy || 'user-aware';

    switch (strategy) {
      case 'global':
        return 'global';

      case 'team-aware':
        if (context.user?.teams && context.user.teams.length > 0) {
          // Sort teams for consistency
          const teams = [...context.user.teams].sort().join(',');
          return `teams:${this.hashString(teams)}`;
        }
        return 'noteam';

      case 'user-aware':
      default:
        if (context.user?.id) {
          return `user:${this.hashString(context.user.id)}`;
        }
        return 'anonymous';
    }
  }

  /**
   * Hash a query string for use in cache keys
   */
  private hashQuery(query: string): string {
    return crypto.createHash('sha256').update(query).digest('hex').substring(0, 16); // Use first 16 chars for brevity
  }

  /**
   * Hash a string for use in cache keys
   */
  private hashString(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex').substring(0, 12); // Use first 12 chars for brevity
  }
}

/**
 * Default cache key generator instance
 */
export const defaultCacheKeyGenerator = new CacheKeyGenerator();
