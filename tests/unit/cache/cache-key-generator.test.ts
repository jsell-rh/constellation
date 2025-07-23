/**
 * Tests for Cache Key Generator
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { CacheKeyGenerator } from '../../../src/cache/cache-key-generator';
import type { Context } from '../../../src/types/core';
import type { LibrarianCacheConfig } from '../../../src/cache/interface';

describe('CacheKeyGenerator', () => {
  let generator: CacheKeyGenerator;

  beforeEach(() => {
    generator = new CacheKeyGenerator('test', 100);
  });

  describe('Key Generation', () => {
    it('should generate consistent keys for same inputs', () => {
      const librarianId = 'test-librarian';
      const query = 'what is kubernetes?';
      const context: Context = {
        user: { id: 'user123', teams: ['platform'] },
      };
      const config: LibrarianCacheConfig = { strategy: 'user-aware' };

      const key1 = generator.generateKey(librarianId, query, context, config);
      const key2 = generator.generateKey(librarianId, query, context, config);

      expect(key1).toBe(key2);
      expect(key1).toContain('test:test-librarian');
    });

    it('should generate different keys for different users', () => {
      const librarianId = 'test-librarian';
      const query = 'what is kubernetes?';
      const config: LibrarianCacheConfig = { strategy: 'user-aware' };

      const context1: Context = {
        user: { id: 'user1', teams: ['platform'] },
      };
      const context2: Context = {
        user: { id: 'user2', teams: ['platform'] },
      };

      const key1 = generator.generateKey(librarianId, query, context1, config);
      const key2 = generator.generateKey(librarianId, query, context2, config);

      expect(key1).not.toBe(key2);
    });

    it('should generate same keys for same team with team-aware strategy', () => {
      const librarianId = 'test-librarian';
      const query = 'what is kubernetes?';
      const config: LibrarianCacheConfig = { strategy: 'team-aware' };

      const context1: Context = {
        user: { id: 'user1', teams: ['platform', 'sre'] },
      };
      const context2: Context = {
        user: { id: 'user2', teams: ['sre', 'platform'] }, // Same teams, different order
      };

      const key1 = generator.generateKey(librarianId, query, context1, config);
      const key2 = generator.generateKey(librarianId, query, context2, config);

      expect(key1).toBe(key2);
    });

    it('should generate same keys for all users with global strategy', () => {
      const librarianId = 'test-librarian';
      const query = 'what is kubernetes?';
      const config: LibrarianCacheConfig = { strategy: 'global' };

      const context1: Context = {
        user: { id: 'user1', teams: ['platform'] },
      };
      const context2: Context = {
        user: { id: 'user2', teams: ['sre'] },
      };

      const key1 = generator.generateKey(librarianId, query, context1, config);
      const key2 = generator.generateKey(librarianId, query, context2, config);

      expect(key1).toBe(key2);
      expect(key1).toContain('global');
    });

    it('should handle anonymous users', () => {
      const librarianId = 'test-librarian';
      const query = 'what is kubernetes?';
      const context: Context = {}; // No user
      const config: LibrarianCacheConfig = { strategy: 'user-aware' };

      const key = generator.generateKey(librarianId, query, context, config);

      expect(key).toContain('anonymous');
    });

    it('should normalize queries consistently', () => {
      const librarianId = 'test-librarian';
      const context: Context = {
        user: { id: 'user123' },
      };
      const config: LibrarianCacheConfig = { strategy: 'user-aware' };

      const key1 = generator.generateKey(librarianId, '  What is   Kubernetes?  ', context, config);
      const key2 = generator.generateKey(librarianId, 'what is kubernetes', context, config);

      expect(key1).toBe(key2);
    });

    it('should truncate long keys', () => {
      const longLibrarianId = 'very-long-librarian-id-that-exceeds-normal-length';
      const longQuery = 'a'.repeat(200);
      const context: Context = {
        user: { id: 'user-with-very-long-id-that-might-cause-issues' },
      };
      const config: LibrarianCacheConfig = { strategy: 'user-aware' };

      const key = generator.generateKey(longLibrarianId, longQuery, context, config);

      expect(key.length).toBeLessThanOrEqual(100);
      expect(key.startsWith('test:')).toBe(true);
    });
  });

  describe('Specialized Key Generation', () => {
    it('should generate team keys correctly', () => {
      const key = generator.generateTeamKey('librarian1', 'platform', 'test query');

      expect(key).toContain('test:team:platform:librarian1');
    });

    it('should generate global keys correctly', () => {
      const key = generator.generateGlobalKey('librarian1', 'test query');

      expect(key).toContain('test:global:librarian1');
    });

    it('should generate tag keys correctly', () => {
      const key = generator.generateTagKey('ai');

      expect(key).toBe('test:tag:ai');
    });
  });

  describe('Key Parsing', () => {
    it('should parse valid keys correctly', () => {
      const key = 'test:librarian1:user:hash123:queryhash';
      const components = generator.parseKey(key);

      expect(components).toEqual({
        librarian: 'librarian1',
        userContext: 'user',
      });
    });

    it('should return null for invalid keys', () => {
      const invalidKey = 'invalid:key:format';
      const components = generator.parseKey(invalidKey);

      expect(components).toBeNull();
    });

    it('should return null for keys with wrong prefix', () => {
      const key = 'wrong:librarian1:user:hash123';
      const components = generator.parseKey(key);

      expect(components).toBeNull();
    });
  });
});
