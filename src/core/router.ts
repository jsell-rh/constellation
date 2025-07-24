/**
 * Simple router for librarian registration and routing
 * Manages librarian registry and routes queries to appropriate handlers
 */

import { LibrarianExecutor } from './executor';
import type { Librarian, Context, Response, LibrarianInfo } from '../types/core';
import { errorResponse } from '../types/librarian-factory';
import { withSpan, SpanAttributes, SpanNames } from '../observability';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export interface RouterOptions {
  /** Executor instance to use for routing */
  executor?: LibrarianExecutor;
}

/**
 * Simple router that manages librarian registration and routing
 */
export class SimpleRouter {
  private readonly librarians = new Map<string, Librarian>();
  private readonly metadata = new Map<string, LibrarianInfo>();
  private readonly executor: LibrarianExecutor;
  private defaultContext: Partial<Context> = {};

  constructor(options: RouterOptions = {}) {
    this.executor = options.executor ?? new LibrarianExecutor();
  }

  /**
   * Register a librarian with metadata
   */
  register(metadata: LibrarianInfo, librarian: Librarian): void {
    // Validate metadata
    this.validateMetadata(metadata);

    // Check for duplicate registration
    if (this.librarians.has(metadata.id)) {
      throw new Error(`Librarian with ID '${metadata.id}' is already registered`);
    }

    // Store librarian and metadata
    this.librarians.set(metadata.id, librarian);
    this.metadata.set(metadata.id, metadata);
  }

  /**
   * Route a query to a specific librarian
   */
  async route(query: string, librarianId: string, context: Context = {}): Promise<Response> {
    return withSpan(SpanNames.QUERY_ROUTING, async (span) => {
      // Add span attributes
      span.setAttributes({
        [SpanAttributes.QUERY_TEXT]: query,
        [SpanAttributes.LIBRARIAN_ID]: librarianId,
        [SpanAttributes.QUERY_USER_ID]: context.user?.id || 'anonymous',
      });

      // Get the librarian
      const librarian = this.librarians.get(librarianId);
      if (!librarian) {
        span.addEvent('librarian_not_found', {
          [SpanAttributes.LIBRARIAN_ID]: librarianId,
          available_librarians: this.getAllLibrarians().join(','),
        });

        return errorResponse('LIBRARIAN_NOT_FOUND', `Librarian '${librarianId}' not found`, {
          librarian: librarianId,
          details: {
            availableLibrarians: this.getAllLibrarians(),
          },
        });
      }

      // Get metadata and enrich context with defaults
      const librarianInfo = this.metadata.get(librarianId);
      const enrichedContext: Context = {
        ...this.defaultContext,
        ...context,
        ...(librarianInfo && { librarian: librarianInfo }),
      };

      // Add librarian metadata to span
      if (librarianInfo) {
        span.setAttributes({
          [SpanAttributes.LIBRARIAN_NAME]: librarianInfo.name,
          [SpanAttributes.LIBRARIAN_VERSION]: 'unknown',
        });
      }

      logger.debug(
        {
          librarianId,
          hasUser: !!enrichedContext.user,
          userId: enrichedContext.user?.id,
          userTeams: enrichedContext.user?.teams,
        },
        'Router passing context to executor',
      );

      span.addEvent('executing_librarian');

      // Execute using the executor
      const response = await this.executor.execute(librarian, query, enrichedContext);

      // Add response attributes
      if (response.confidence !== undefined) {
        span.setAttribute(SpanAttributes.RESPONSE_CONFIDENCE, response.confidence);
      }
      if (response.sources) {
        span.setAttribute(SpanAttributes.RESPONSE_SOURCE_COUNT, response.sources.length);
      }

      return response;
    });
  }

  /**
   * Get a librarian by ID
   */
  getLibrarian(id: string): Librarian | undefined {
    return this.librarians.get(id);
  }

  /**
   * Get librarian metadata by ID
   */
  getMetadata(id: string): LibrarianInfo | undefined {
    return this.metadata.get(id);
  }

  /**
   * Get all registered librarian IDs
   */
  getAllLibrarians(): string[] {
    return Array.from(this.librarians.keys());
  }

  /**
   * Find librarians by capability
   */
  findByCapability(capability: string): LibrarianInfo[] {
    const matches: LibrarianInfo[] = [];

    for (const [_id, info] of this.metadata.entries()) {
      const hasCapability = info.capabilities.some(
        (cap) => cap.includes(capability) || capability.includes(cap),
      );

      if (hasCapability) {
        matches.push(info);
      }
    }

    return matches;
  }

  /**
   * Set default context that will be merged with all requests
   */
  setDefaultContext(context: Partial<Context>): void {
    this.defaultContext = { ...this.defaultContext, ...context };
  }

  /**
   * Validate librarian metadata
   */
  private validateMetadata(metadata: LibrarianInfo): void {
    if (!metadata.id || typeof metadata.id !== 'string') {
      throw new Error('Invalid metadata: id is required and must be a string');
    }

    if (!metadata.name || typeof metadata.name !== 'string') {
      throw new Error('Invalid metadata: name is required and must be a string');
    }

    if (!metadata.description || typeof metadata.description !== 'string') {
      throw new Error('Invalid metadata: description is required and must be a string');
    }

    if (!Array.isArray(metadata.capabilities)) {
      throw new Error('Invalid metadata: capabilities must be an array');
    }

    if (metadata.capabilities.some((cap) => typeof cap !== 'string')) {
      throw new Error('Invalid metadata: all capabilities must be strings');
    }
  }
}
