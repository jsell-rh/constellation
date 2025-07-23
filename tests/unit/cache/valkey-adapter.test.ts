/**
 * Tests for Valkey Cache Adapter
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ValkeyAdapter } from '../../../src/cache/valkey-adapter';
import type { CacheOptions } from '../../../src/cache/interface';

// Mock multi object type
interface MockMulti {
  sadd: jest.Mock<() => MockMulti>;
  expire: jest.Mock<() => MockMulti>;
  exec: jest.Mock<() => Promise<unknown[]>>;
}

const mockMulti: MockMulti = {
  sadd: jest.fn<() => MockMulti>().mockReturnThis(),
  expire: jest.fn<() => MockMulti>().mockReturnThis(),
  exec: jest.fn<() => Promise<unknown[]>>(),
};

// Mock iovalkey
const mockValkeyClient = {
  connect: jest.fn<() => Promise<void>>(),
  get: jest.fn<(key: string) => Promise<string | null>>(),
  set: jest.fn<(key: string, value: string) => Promise<string>>(),
  setex: jest.fn<(key: string, ttl: number, value: string) => Promise<string>>(),
  del: jest.fn<(...keys: string[]) => Promise<number>>(),
  exists: jest.fn<(key: string) => Promise<number>>(),
  keys: jest.fn<(pattern: string) => Promise<string[]>>(),
  sadd: jest.fn<(key: string, ...members: string[]) => Promise<number>>(),
  smembers: jest.fn<(key: string) => Promise<string[]>>(),
  expire: jest.fn<(key: string, ttl: number) => Promise<number>>(),
  multi: jest.fn<() => MockMulti>().mockReturnValue(mockMulti),
  quit: jest.fn<() => Promise<string>>(),
};

jest.mock('iovalkey', () => {
  return {
    __esModule: true,
    default: jest.fn(() => mockValkeyClient),
  };
});

describe('ValkeyAdapter', () => {
  let adapter: ValkeyAdapter;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock behaviors
    mockValkeyClient.connect.mockResolvedValue(undefined);
    mockValkeyClient.multi.mockReturnValue(mockMulti);
    mockMulti.exec.mockResolvedValue([]);

    adapter = new ValkeyAdapter({
      type: 'valkey',
      url: 'redis://localhost:6379',
      keyPrefix: 'test',
      defaultTtl: 3600,
    });
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      await adapter.connect();
      expect(mockValkeyClient.connect).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      mockValkeyClient.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(adapter.connect()).rejects.toThrow('Connection failed');
    });

    it('should close connection cleanly', async () => {
      mockValkeyClient.quit.mockResolvedValue('OK');

      await adapter.close();
      expect(mockValkeyClient.quit).toHaveBeenCalled();
    });
  });

  describe('Basic Operations', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('should get a value from cache', async () => {
      const testValue = { data: 'test' };
      mockValkeyClient.get.mockResolvedValue(JSON.stringify(testValue));

      const result = await adapter.get<typeof testValue>('test-key');

      expect(result).toEqual(testValue);
      expect(mockValkeyClient.get).toHaveBeenCalledWith('test:test-key');
    });

    it('should return null for non-existent keys', async () => {
      mockValkeyClient.get.mockResolvedValue(null);

      const result = await adapter.get('non-existent');

      expect(result).toBeNull();
      expect(mockValkeyClient.get).toHaveBeenCalledWith('test:non-existent');
    });

    it('should set a value in cache without TTL', async () => {
      const testValue = { data: 'test' };
      mockValkeyClient.set.mockResolvedValue('OK');

      await adapter.set('test-key', testValue);

      expect(mockValkeyClient.setex).toHaveBeenCalledWith(
        'test:test-key',
        3600, // default TTL
        JSON.stringify(testValue),
      );
    });

    it('should set a value in cache with TTL', async () => {
      const testValue = { data: 'test' };
      const options: CacheOptions = { ttl: 300 };
      mockValkeyClient.setex.mockResolvedValue('OK');

      await adapter.set('test-key', testValue, options);

      expect(mockValkeyClient.setex).toHaveBeenCalledWith(
        'test:test-key',
        300,
        JSON.stringify(testValue),
      );
    });

    it('should delete a key from cache', async () => {
      mockValkeyClient.del.mockResolvedValue(1);

      const result = await adapter.delete('test-key');

      expect(result).toBe(true);
      expect(mockValkeyClient.del).toHaveBeenCalledWith('test:test-key');
    });

    it('should return false when deleting non-existent key', async () => {
      mockValkeyClient.del.mockResolvedValue(0);

      const result = await adapter.delete('non-existent');

      expect(result).toBe(false);
    });

    it('should check if key exists', async () => {
      mockValkeyClient.exists.mockResolvedValue(1);

      const result = await adapter.exists('test-key');

      expect(result).toBe(true);
      expect(mockValkeyClient.exists).toHaveBeenCalledWith('test:test-key');
    });

    it('should return false for non-existent key', async () => {
      mockValkeyClient.exists.mockResolvedValue(0);

      const result = await adapter.exists('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('Tag-based Operations', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('should set value with tags', async () => {
      const testValue = { data: 'test' };
      const options: CacheOptions = { tags: ['tag1', 'tag2'] };
      mockValkeyClient.setex.mockResolvedValue('OK');

      await adapter.set('test-key', testValue, options);

      expect(mockValkeyClient.setex).toHaveBeenCalledWith(
        'test:test-key',
        3600,
        JSON.stringify(testValue),
      );
      expect(mockValkeyClient.multi).toHaveBeenCalled();
      expect(mockMulti.sadd).toHaveBeenCalledWith('test:tag:tag1', 'test-key');
      expect(mockMulti.sadd).toHaveBeenCalledWith('test:tag:tag2', 'test-key');
      expect(mockMulti.expire).toHaveBeenCalledWith('test:tag:tag1', 86400);
      expect(mockMulti.expire).toHaveBeenCalledWith('test:tag:tag2', 86400);
      expect(mockMulti.exec).toHaveBeenCalled();
    });

    it('should invalidate cache by tags', async () => {
      const keys = ['key1', 'key2', 'key3'];
      mockValkeyClient.smembers.mockResolvedValueOnce(keys);
      mockValkeyClient.del.mockImplementation((...args) => Promise.resolve(args.length - 1)); // All keys except tag key

      const result = await adapter.invalidateByTags(['tag1']);

      expect(mockValkeyClient.smembers).toHaveBeenCalledWith('test:tag:tag1');
      expect(mockValkeyClient.del).toHaveBeenCalledWith('test:key1', 'test:key2', 'test:key3');
      expect(mockValkeyClient.del).toHaveBeenCalledWith('test:tag:tag1');
      expect(result).toBe(keys.length);
    });

    it('should handle empty tag invalidation', async () => {
      mockValkeyClient.smembers.mockResolvedValue([]);

      const result = await adapter.invalidateByTags(['empty-tag']);

      expect(result).toBe(0);
    });

    it('should invalidate multiple tags', async () => {
      mockValkeyClient.smembers
        .mockResolvedValueOnce(['key1', 'key2'])
        .mockResolvedValueOnce(['key2', 'key3']);
      mockValkeyClient.del.mockImplementation((...args) => Promise.resolve(args.length - 1));

      const result = await adapter.invalidateByTags(['tag1', 'tag2']);

      expect(mockValkeyClient.smembers).toHaveBeenCalledTimes(2);
      expect(result).toBe(4); // 2 + 2 unique keys (key2 is in both sets)
    });
  });

  describe('Clear Operations', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('should clear all cache entries', async () => {
      const keys = ['test:key1', 'test:key2', 'test:key3'];
      mockValkeyClient.keys.mockResolvedValue(keys);
      mockValkeyClient.del.mockResolvedValue(keys.length);

      await adapter.clear();

      expect(mockValkeyClient.keys).toHaveBeenCalledWith('test:*');
      expect(mockValkeyClient.del).toHaveBeenCalledWith(...keys);
    });

    it('should handle empty cache', async () => {
      mockValkeyClient.keys.mockResolvedValue([]);

      await adapter.clear();

      expect(mockValkeyClient.keys).toHaveBeenCalledWith('test:*');
      expect(mockValkeyClient.del).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('should handle get errors gracefully', async () => {
      mockValkeyClient.get.mockRejectedValue(new Error('Connection lost'));

      const result = await adapter.get('test-key');

      expect(result).toBeNull();
    });

    it('should throw on set errors', async () => {
      mockValkeyClient.setex.mockRejectedValue(new Error('Connection lost'));

      await expect(adapter.set('test-key', 'value')).rejects.toThrow();
    });

    it('should handle JSON parse errors', async () => {
      mockValkeyClient.get.mockResolvedValue('invalid-json');

      const result = await adapter.get('test-key');
      expect(result).toBe('invalid-json'); // Falls back to string
    });
  });

  describe('Metrics', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('should track cache metrics', async () => {
      mockValkeyClient.get.mockResolvedValueOnce(null); // miss
      mockValkeyClient.get.mockResolvedValueOnce('"value"'); // hit
      mockValkeyClient.setex.mockResolvedValue('OK');
      mockValkeyClient.del.mockResolvedValue(1);

      await adapter.get('miss-key');
      await adapter.get('hit-key');
      await adapter.set('new-key', 'value');
      await adapter.delete('old-key');

      const metrics = adapter.getMetrics();
      expect(metrics.misses).toBe(1);
      expect(metrics.hits).toBe(1);
      expect(metrics.sets).toBe(1);
      expect(metrics.deletes).toBe(1);
    });
  });

  describe('Serialization', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('should handle complex objects', async () => {
      const complexObject = {
        nested: { data: 'test' },
        array: [1, 2, 3],
        date: new Date('2023-01-01').toISOString(),
        null: null,
        boolean: true,
      };

      mockValkeyClient.get.mockResolvedValue(JSON.stringify(complexObject));

      const result = await adapter.get('complex');
      expect(result).toEqual(complexObject);
    });

    it('should handle primitive values', async () => {
      mockValkeyClient.get.mockResolvedValue('"string-value"');
      let result = await adapter.get('string');
      expect(result).toBe('string-value');

      mockValkeyClient.get.mockResolvedValue('42');
      result = await adapter.get('number');
      expect(result).toBe(42);

      mockValkeyClient.get.mockResolvedValue('true');
      result = await adapter.get('boolean');
      expect(result).toBe(true);
    });

    it('should handle string values without JSON parsing', async () => {
      mockValkeyClient.get.mockResolvedValue('plain string');
      const result = await adapter.get('string');
      expect(result).toBe('plain string');
    });
  });
});
