/**
 * Tests for Memory Cache Adapter
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MemoryAdapter } from '../../../src/cache/memory-adapter';
import type { CacheOptions } from '../../../src/cache/interface';

describe('MemoryAdapter', () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = new MemoryAdapter({
      type: 'memory',
      keyPrefix: 'test',
      defaultTtl: 3600,
    });
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', async () => {
      const testValue = { data: 'test' };

      await adapter.set('test-key', testValue);
      const result = await adapter.get<typeof testValue>('test-key');

      expect(result).toEqual(testValue);
    });

    it('should return null for non-existent keys', async () => {
      const result = await adapter.get('non-existent');
      expect(result).toBeNull();
    });

    it('should delete keys successfully', async () => {
      await adapter.set('test-key', 'value');

      const result = await adapter.delete('test-key');
      expect(result).toBe(true);

      const value = await adapter.get('test-key');
      expect(value).toBeNull();
    });

    it('should return false when deleting non-existent keys', async () => {
      const result = await adapter.delete('non-existent');
      expect(result).toBe(false);
    });

    it('should check if keys exist', async () => {
      await adapter.set('test-key', 'value');

      expect(await adapter.exists('test-key')).toBe(true);
      expect(await adapter.exists('non-existent')).toBe(false);
    });
  });

  describe('TTL and Expiration', () => {
    it('should respect TTL when setting values', async () => {
      const options: CacheOptions = { ttl: 1 }; // 1 second

      await adapter.set('ttl-key', 'value', options);

      // Should exist immediately
      let result = await adapter.get('ttl-key');
      expect(result).toBe('value');

      // Wait for expiration
      await new Promise<void>((resolve) => setTimeout(resolve, 1100));

      // Should be expired
      result = await adapter.get('ttl-key');
      expect(result).toBeNull();
    });

    it('should handle values without TTL', async () => {
      await adapter.set('no-ttl-key', 'value');

      // Should persist
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      const result = await adapter.get('no-ttl-key');
      expect(result).toBe('value');
    });

    it('should update TTL when setting existing key', async () => {
      // Set with short TTL
      await adapter.set('update-key', 'value1', { ttl: 1 });

      // Update with longer TTL
      await adapter.set('update-key', 'value2', { ttl: 10 });

      // Wait past original TTL
      await new Promise<void>((resolve) => setTimeout(resolve, 1100));

      // Should still exist with new value
      const result = await adapter.get('update-key');
      expect(result).toBe('value2');
    });
  });

  describe('Tag-based Operations', () => {
    it('should associate keys with tags', async () => {
      const options: CacheOptions = { tags: ['tag1', 'tag2'] };

      await adapter.set('tagged-key', 'value', options);

      const result = await adapter.get('tagged-key');
      expect(result).toBe('value');
    });

    it('should invalidate keys by single tag', async () => {
      await adapter.set('key1', 'value1', { tags: ['tag1'] });
      await adapter.set('key2', 'value2', { tags: ['tag1', 'tag2'] });
      await adapter.set('key3', 'value3', { tags: ['tag2'] });

      const invalidated = await adapter.invalidateByTags(['tag1']);

      expect(invalidated).toBe(2); // key1 and key2
      expect(await adapter.get('key1')).toBeNull();
      expect(await adapter.get('key2')).toBeNull();
      expect(await adapter.get('key3')).toBe('value3'); // Should still exist
    });

    it('should invalidate keys by multiple tags', async () => {
      await adapter.set('key1', 'value1', { tags: ['tag1'] });
      await adapter.set('key2', 'value2', { tags: ['tag2'] });
      await adapter.set('key3', 'value3', { tags: ['tag1', 'tag2'] });
      await adapter.set('key4', 'value4', { tags: ['tag3'] });

      const invalidated = await adapter.invalidateByTags(['tag1', 'tag2']);

      expect(invalidated).toBe(3); // key1, key2, key3
      expect(await adapter.get('key1')).toBeNull();
      expect(await adapter.get('key2')).toBeNull();
      expect(await adapter.get('key3')).toBeNull();
      expect(await adapter.get('key4')).toBe('value4'); // Should still exist
    });

    it('should handle empty tag invalidation', async () => {
      await adapter.set('test-key', 'value');

      const invalidated = await adapter.invalidateByTags(['non-existent-tag']);

      expect(invalidated).toBe(0);
      expect(await adapter.get('test-key')).toBe('value');
    });
  });

  describe('Memory Management', () => {
    it('should track metrics', () => {
      const metrics = adapter.getMetrics();
      expect(metrics).toHaveProperty('hits');
      expect(metrics).toHaveProperty('misses');
      expect(metrics).toHaveProperty('sets');
      expect(metrics).toHaveProperty('deletes');
      expect(metrics).toHaveProperty('errors');
      expect(metrics).toHaveProperty('avgResponseTime');
    });

    it('should update metrics when performing operations', async () => {
      await adapter.set('key1', 'value1');
      await adapter.get('key1'); // hit
      await adapter.get('non-existent'); // miss
      await adapter.delete('key1');

      const metrics = adapter.getMetrics();
      expect(metrics.sets).toBeGreaterThan(0);
      expect(metrics.hits).toBeGreaterThan(0);
      expect(metrics.misses).toBeGreaterThan(0);
      expect(metrics.deletes).toBeGreaterThan(0);
    });

    it('should clear all entries', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');

      await adapter.clear();

      expect(await adapter.get('key1')).toBeNull();
      expect(await adapter.get('key2')).toBeNull();
    });
  });

  describe('Data Types', () => {
    it('should handle various data types', async () => {
      const testCases: Array<[string, unknown]> = [
        ['string', 'test-string'],
        ['number', 42],
        ['boolean', true],
        ['null', null],
        ['object', { nested: { data: 'test' } }],
        ['array', [1, 2, 3]],
      ];

      for (const [name, value] of testCases) {
        await adapter.set(name, value);
        const result = await adapter.get(name);
        expect(result).toEqual(value);
      }
    });

    it('should return stored objects', async () => {
      const original = { data: 'test' };
      await adapter.set('object-key', original);

      const retrieved = await adapter.get('object-key');
      expect(retrieved).toEqual(original);
      // Note: In-memory adapter returns the same reference for performance
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined values', async () => {
      await adapter.set('undefined-key', undefined);
      const result = await adapter.get('undefined-key');
      expect(result).toBeUndefined();
    });

    it('should handle very large keys', async () => {
      const largeKey = 'x'.repeat(1000);
      await adapter.set(largeKey, 'value');

      const result = await adapter.get(largeKey);
      expect(result).toBe('value');
    });

    it('should handle special characters in keys', async () => {
      const specialKey = 'key:with/special\\chars@#$%';
      await adapter.set(specialKey, 'value');

      const result = await adapter.get(specialKey);
      expect(result).toBe('value');
    });
  });
});
