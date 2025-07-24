/**
 * Tests for AI-powered response aggregation
 */

import { AIAggregator } from '../../../src/delegation/aggregator';
import type { Response } from '../../../src/types/core';
import type { AIClient } from '../../../src/ai/interface';

// Mock AI client
const mockAIClient: AIClient = {
  ask: jest.fn(),
  stream: jest.fn(),
  defaultProvider: {
    name: 'mock',
    model: 'mock-model',
    isAvailable: () => true,
  },
} as unknown as AIClient;

describe('AIAggregator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('basic aggregation', () => {
    it('should combine responses with attribution', async () => {
      const aggregator = new AIAggregator(mockAIClient);

      const responses: Response[] = [
        {
          answer: 'Kubernetes is a container orchestration platform',
          confidence: 0.9,
          metadata: { librarian: 'kubernetes-expert' },
        },
        {
          answer: 'Why did the pod go to therapy? It had too many containers!',
          confidence: 0.8,
          metadata: { librarian: 'joke-teller' },
        },
      ];

      const mockCombinedAnswer =
        'Kubernetes is a container orchestration platform. As the joke-teller quipped: "Why did the pod go to therapy? It had too many containers!"';
      (mockAIClient.ask as jest.Mock).mockResolvedValue(mockCombinedAnswer);

      const result = await aggregator.aggregate(responses);

      const callArgs = (mockAIClient.ask as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('[kubernetes-expert (confidence: 0.9)]');
      expect(callArgs[0]).toContain('[joke-teller (confidence: 0.8)]');
      expect(callArgs[0]).toContain('Preserve attribution');

      expect(result.answer).toBe(mockCombinedAnswer);
      expect(result.confidence).toBe(0.9); // Max confidence
      expect(result.metadata?.aggregation).toMatchObject({
        strategy: 'ai-powered',
        totalResponses: 2,
        validResponses: 2,
        maxConfidence: 0.9,
        contributingLibrarians: ['kubernetes-expert', 'joke-teller'],
        model: 'mock',
      });
    });

    it('should work without attribution when disabled', async () => {
      const aggregator = new AIAggregator(mockAIClient, {
        preserveAttribution: false,
        includeConfidence: false,
      });

      const responses: Response[] = [
        {
          answer: 'Answer 1',
          confidence: 0.9,
          metadata: { librarian: 'lib1' },
        },
        {
          answer: 'Answer 2',
          confidence: 0.8,
          metadata: { librarian: 'lib2' },
        },
      ];

      (mockAIClient.ask as jest.Mock).mockResolvedValue('Combined answer');

      await aggregator.aggregate(responses);

      const prompt = (mockAIClient.ask as jest.Mock).mock.calls[0][0] as string;
      expect(prompt).not.toContain('Preserve attribution');
      expect(prompt).not.toContain('confidence:');
      expect(prompt).toContain('[lib1]: Answer 1');
      expect(prompt).toContain('[lib2]: Answer 2');
    });

    it('should use custom prompt when provided', async () => {
      const customPrompt = 'Custom aggregation prompt: {{RESPONSES}}';
      const aggregator = new AIAggregator(mockAIClient, {
        customPrompt,
      });

      const responses: Response[] = [
        { answer: 'Answer 1', metadata: { librarian: 'lib1' } },
        { answer: 'Answer 2', metadata: { librarian: 'lib2' } },
      ];

      (mockAIClient.ask as jest.Mock).mockResolvedValue('Result');

      await aggregator.aggregate(responses);

      expect((mockAIClient.ask as jest.Mock).mock.calls).toHaveLength(1);
      const callArgs = (mockAIClient.ask as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('Custom aggregation prompt:');
      expect(callArgs[0]).toContain('[lib1]: Answer 1');
      expect(callArgs[0]).toContain('[lib2]: Answer 2');
    });
  });

  describe('source merging', () => {
    it('should merge and deduplicate sources', async () => {
      const aggregator = new AIAggregator(mockAIClient);

      const responses: Response[] = [
        {
          answer: 'Answer 1',
          sources: [
            { name: 'Doc A', url: 'http://a.com' },
            { name: 'Doc B', url: 'http://b.com' },
          ],
          metadata: { librarian: 'lib1' },
        },
        {
          answer: 'Answer 2',
          sources: [
            { name: 'Doc B', url: 'http://b.com' }, // Duplicate
            { name: 'Doc C', url: 'http://c.com' },
          ],
          metadata: { librarian: 'lib2' },
        },
      ];

      (mockAIClient.ask as jest.Mock).mockResolvedValue('Combined');

      const result = await aggregator.aggregate(responses);

      expect(result.sources).toHaveLength(3);
      expect(result.sources?.map((s) => s.url)).toEqual([
        'http://a.com',
        'http://b.com',
        'http://c.com',
      ]);
    });
  });

  describe('error handling', () => {
    it('should fallback to best confidence when AI fails', async () => {
      const aggregator = new AIAggregator(mockAIClient);

      const responses: Response[] = [
        {
          answer: 'Low confidence',
          confidence: 0.5,
          metadata: { librarian: 'lib1' },
        },
        {
          answer: 'High confidence',
          confidence: 0.9,
          metadata: { librarian: 'lib2' },
        },
      ];

      (mockAIClient.ask as jest.Mock).mockRejectedValue(new Error('AI failed'));

      const result = await aggregator.aggregate(responses);

      // Should fallback to best confidence
      expect(result.answer).toBe('High confidence');
      expect(result.confidence).toBe(0.9);
    });

    it('should handle empty responses', async () => {
      const aggregator = new AIAggregator(mockAIClient);

      const result = await aggregator.aggregate([]);

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('NO_RESPONSES');
      expect((mockAIClient.ask as jest.Mock).mock.calls).toHaveLength(0);
    });

    it('should return single response unchanged', async () => {
      const aggregator = new AIAggregator(mockAIClient);

      const response: Response = {
        answer: 'Single answer',
        confidence: 0.8,
      };

      const result = await aggregator.aggregate([response]);

      expect(result).toEqual(response);
      expect((mockAIClient.ask as jest.Mock).mock.calls).toHaveLength(0);
    });

    it('should handle all error responses', async () => {
      const aggregator = new AIAggregator(mockAIClient);

      const responses: Response[] = [
        { error: { code: 'ERROR_1', message: 'Error 1' } },
        { error: { code: 'ERROR_2', message: 'Error 2' } },
      ];

      const result = await aggregator.aggregate(responses);

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('ERROR_1');
      expect((mockAIClient.ask as jest.Mock).mock.calls).toHaveLength(0);
    });
  });

  describe('confidence calculation', () => {
    it('should calculate average and max confidence', async () => {
      const aggregator = new AIAggregator(mockAIClient);

      const responses: Response[] = [
        { answer: 'A1', confidence: 0.6, metadata: { librarian: 'lib1' } },
        { answer: 'A2', confidence: 0.8, metadata: { librarian: 'lib2' } },
        { answer: 'A3', confidence: 0.7, metadata: { librarian: 'lib3' } },
      ];

      (mockAIClient.ask as jest.Mock).mockResolvedValue('Combined');

      const result = await aggregator.aggregate(responses);

      expect(result.confidence).toBe(0.8); // Max confidence
      expect(result.metadata?.aggregation).toMatchObject({
        averageConfidence: expect.closeTo(0.7, 1),
        maxConfidence: 0.8,
      });
    });
  });
});
