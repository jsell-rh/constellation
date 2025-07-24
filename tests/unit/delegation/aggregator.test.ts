/**
 * Tests for response aggregation strategies
 */

import {
  ResponseAggregator,
  BestConfidenceAggregator,
  CombineAnswersAggregator,
} from '../../../src/delegation/aggregator';
import type { Response } from '../../../src/types/core';

describe('ResponseAggregator', () => {
  describe('BestConfidenceAggregator', () => {
    const aggregator = new ResponseAggregator(new BestConfidenceAggregator());

    it('should return single response unchanged', () => {
      const response: Response = {
        answer: 'Single answer',
        confidence: 0.8,
      };

      const result = aggregator.aggregate([response]);
      expect(result).toEqual(response);
    });

    it('should select response with highest confidence', () => {
      const responses: Response[] = [
        {
          answer: 'Low confidence answer',
          confidence: 0.3,
          metadata: { librarian: 'low-conf' },
        },
        {
          answer: 'High confidence answer',
          confidence: 0.9,
          metadata: { librarian: 'high-conf' },
        },
        {
          answer: 'Medium confidence answer',
          confidence: 0.6,
          metadata: { librarian: 'med-conf' },
        },
      ];

      const result = aggregator.aggregate(responses);

      expect(result.answer).toBe('High confidence answer');
      expect(result.confidence).toBe(0.9);
      expect(result.metadata?.aggregation).toBeDefined();
      expect(result.metadata?.selectedLibrarian).toBe('high-conf');
    });

    it('should handle responses without confidence scores', () => {
      const responses: Response[] = [
        {
          answer: 'No confidence',
          metadata: { librarian: 'no-conf' },
        },
        {
          answer: 'Has confidence',
          confidence: 0.5,
          metadata: { librarian: 'has-conf' },
        },
      ];

      const result = aggregator.aggregate(responses);

      expect(result.answer).toBe('Has confidence');
      expect(result.confidence).toBe(0.5);
    });

    it('should merge sources from all responses', () => {
      const responses: Response[] = [
        {
          answer: 'Answer 1',
          confidence: 0.9,
          sources: [
            { name: 'Source 1', url: 'http://source1.com' },
            { name: 'Source 2', url: 'http://source2.com' },
          ],
        },
        {
          answer: 'Answer 2',
          confidence: 0.7,
          sources: [
            { name: 'Source 2', url: 'http://source2.com' }, // Duplicate
            { name: 'Source 3', url: 'http://source3.com' },
          ],
        },
      ];

      const result = aggregator.aggregate(responses);

      expect(result.sources).toHaveLength(3);
      expect(result.sources?.map((s) => s.name)).toContain('Source 1');
      expect(result.sources?.map((s) => s.name)).toContain('Source 2');
      expect(result.sources?.map((s) => s.name)).toContain('Source 3');
    });

    it('should handle all error responses', () => {
      const responses: Response[] = [
        {
          error: {
            code: 'ERROR_1',
            message: 'First error',
          },
        },
        {
          error: {
            code: 'ERROR_2',
            message: 'Second error',
          },
        },
      ];

      const result = aggregator.aggregate(responses);

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('ERROR_1');
    });

    it('should filter out error responses during aggregation', () => {
      const responses: Response[] = [
        {
          answer: 'Good answer',
          confidence: 0.8,
          metadata: { librarian: 'good' },
        },
        {
          error: {
            code: 'FAILED',
            message: 'This librarian failed',
          },
          metadata: { librarian: 'failed' },
        },
      ];

      const result = aggregator.aggregate(responses);

      expect(result.answer).toBe('Good answer');
      expect(result.error).toBeUndefined();
    });

    it('should include aggregation metadata', () => {
      const responses: Response[] = [
        {
          answer: 'Answer 1',
          confidence: 0.7,
          metadata: { librarian: 'lib1' },
        },
        {
          answer: 'Answer 2',
          confidence: 0.9,
          metadata: { librarian: 'lib2' },
        },
      ];

      const result = aggregator.aggregate(responses);

      const aggMeta = result.metadata?.aggregation as any;
      expect(aggMeta).toBeDefined();
      expect(aggMeta.strategy).toBe('best-confidence');
      expect(aggMeta.totalResponses).toBe(2);
      expect(aggMeta.selectedConfidence).toBe(0.9);
      expect(aggMeta.allConfidences).toEqual([
        { librarian: 'lib2', confidence: 0.9 },
        { librarian: 'lib1', confidence: 0.7 },
      ]);
    });
  });

  describe('CombineAnswersAggregator', () => {
    const aggregator = new ResponseAggregator(new CombineAnswersAggregator());

    it('should combine answers from multiple responses', () => {
      const responses: Response[] = [
        {
          answer: 'First perspective on the topic',
          confidence: 0.8,
          metadata: { librarian: 'Expert A' },
        },
        {
          answer: 'Second perspective on the topic',
          confidence: 0.7,
          metadata: { librarian: 'Expert B' },
        },
      ];

      const result = aggregator.aggregate(responses);

      expect(result.answer).toContain('**Expert A**: First perspective on the topic');
      expect(result.answer).toContain('**Expert B**: Second perspective on the topic');
      expect(result.confidence).toBe(0.75); // Average
    });

    it('should combine sources from all responses', () => {
      const responses: Response[] = [
        {
          answer: 'Answer 1',
          sources: [{ name: 'Source A' }],
          metadata: { librarian: 'Lib1' },
        },
        {
          answer: 'Answer 2',
          sources: [{ name: 'Source B' }],
          metadata: { librarian: 'Lib2' },
        },
      ];

      const result = aggregator.aggregate(responses);

      expect(result.sources).toHaveLength(2);
      expect(result.sources?.map((s) => s.name)).toContain('Source A');
      expect(result.sources?.map((s) => s.name)).toContain('Source B');
    });

    it('should handle missing librarian names', () => {
      const responses: Response[] = [
        {
          answer: 'Anonymous answer',
          confidence: 0.5,
        },
        {
          answer: 'Another answer',
          confidence: 0.6,
          metadata: { librarian: 'Named' },
        },
      ];

      const result = aggregator.aggregate(responses);

      expect(result.answer).toContain('**Unknown**: Anonymous answer');
      expect(result.answer).toContain('**Named**: Another answer');
    });
  });

  describe('Edge cases', () => {
    const aggregator = new ResponseAggregator();

    it('should handle empty response array', () => {
      const result = aggregator.aggregate([]);

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('NO_RESPONSES');
    });

    it('should handle responses with only partial fields', () => {
      const responses: Response[] = [
        { partial: true }, // No answer or error
        { answer: 'Complete answer', confidence: 0.8 },
      ];

      const result = aggregator.aggregate(responses);

      expect(result.answer).toBe('Complete answer');
    });
  });
});
