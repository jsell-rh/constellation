/**
 * Centralized logging configuration for Constellation
 * Provides structured logging with correlation IDs, context propagation, and security
 */

import pino from 'pino';
import { trace } from '@opentelemetry/api';
import type { Context } from '../types/core';

/**
 * Standard log fields for consistency across the application
 */
export interface LogContext {
  // Request/operation identifiers
  requestId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  librarianId?: string;

  // Performance metrics
  duration?: number;
  latency?: number;

  // Business context
  team?: string;
  capability?: string;
  delegationChain?: string[];

  // Error context
  errorCode?: string;
  errorType?: string;
  recoverable?: boolean;

  // Additional metadata
  [key: string]: unknown;
}

/**
 * Security-sensitive fields that should be redacted
 */
const REDACTED_FIELDS = new Set([
  'password',
  'token',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'secret',
  'private',
  'ssn',
  'creditCard',
  'credit_card',
]);

/**
 * Custom serializers for common objects
 */
const serializers = {
  // Redact sensitive fields from errors
  err: pino.stdSerializers.err,
  error: (error: any) => {
    if (!error) return error;

    const serialized: any = {
      type: error.constructor?.name || 'Error',
      message: error.message,
      stack: error.stack,
      code: error.code,
    };

    // Copy additional properties but redact sensitive ones
    for (const key in error) {
      if (!serialized[key] && !REDACTED_FIELDS.has(key.toLowerCase())) {
        serialized[key] = error[key];
      }
    }

    return serialized;
  },

  // Serialize HTTP requests with redaction
  req: (req: any) => {
    if (!req) return req;

    return {
      method: req.method,
      url: req.url,
      path: req.path,
      query: redactObject(req.query),
      headers: redactObject(req.headers, ['authorization', 'cookie']),
      remoteAddress: req.connection?.remoteAddress,
      remotePort: req.connection?.remotePort,
    };
  },

  // Serialize HTTP responses
  res: (res: any) => {
    if (!res) return res;

    return {
      statusCode: res.statusCode,
      headers: redactObject(res.getHeaders?.()),
    };
  },
};

/**
 * Redact sensitive fields from objects
 */
function redactObject(obj: any, additionalFields: string[] = []): any {
  if (!obj || typeof obj !== 'object') return obj;

  const result: any = {};
  const fieldsToRedact = new Set([
    ...REDACTED_FIELDS,
    ...additionalFields.map((f) => f.toLowerCase()),
  ]);

  for (const key in obj) {
    if (fieldsToRedact.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      result[key] = redactObject(obj[key], additionalFields);
    } else {
      result[key] = obj[key];
    }
  }

  return result;
}

/**
 * Extract trace context from OpenTelemetry
 */
function getTraceContext(): { traceId?: string; spanId?: string } {
  const span = trace.getActiveSpan();
  if (!span) return {};

  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}

/**
 * Create child logger with context
 */
export function createLogger(name: string, baseContext?: LogContext): pino.Logger {
  const logger = pino({
    name,
    level: process.env.LOG_LEVEL || 'info',
    serializers,
    base: {
      pid: process.pid,
      hostname: process.env.HOSTNAME,
      service: 'constellation',
      version: process.env.npm_package_version,
      environment: process.env.NODE_ENV || 'development',
    },
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({ ...bindings, component: name }),
    },
    hooks: {
      logMethod(inputArgs: any[], method: any) {
        // Add trace context to every log
        const traceContext = getTraceContext();

        if (inputArgs.length > 0 && typeof inputArgs[0] === 'object' && inputArgs[0] !== null) {
          // Ensure we're spreading a proper object
          const firstArg = inputArgs[0] as Record<string, unknown>;
          inputArgs[0] = { ...traceContext, ...firstArg };
        } else {
          inputArgs.unshift(traceContext);
        }

        return method.apply(this, inputArgs);
      },
    },
    // Use pretty printing in development (but not in test)
    ...(process.env.NODE_ENV !== 'production' &&
      process.env.NODE_ENV !== 'test' && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }),
  });

  // Return child logger with base context
  return baseContext ? logger.child(baseContext) : logger;
}

/**
 * Create logger from Constellation context
 */
export function createContextLogger(name: string, context: Context): pino.Logger {
  const logContext: LogContext = {};

  // Only add defined values to avoid exactOptionalPropertyTypes issues
  if (context.user?.id !== undefined) {
    logContext.userId = context.user.id;
  }
  if (context.requestId !== undefined) {
    logContext.requestId = context.requestId;
  }
  if (context.librarian?.id !== undefined) {
    logContext.librarianId = context.librarian.id;
  }
  if (context.librarian?.team !== undefined) {
    logContext.team = context.librarian.team;
  }
  if (context.delegationChain !== undefined) {
    logContext.delegationChain = context.delegationChain;
  }

  // Add any trace context from the Context object
  if (context.trace) {
    if (context.trace.traceId !== undefined) {
      logContext.traceId = context.trace.traceId;
    }
    if (context.trace.spanId !== undefined) {
      logContext.spanId = context.trace.spanId;
    }
  }

  return createLogger(name, logContext);
}

/**
 * Performance timer for logging operation durations
 */
export class PerformanceTimer {
  private startTime: number;
  private marks: Map<string, number> = new Map();

  constructor() {
    this.startTime = Date.now();
  }

  mark(name: string): void {
    this.marks.set(name, Date.now());
  }

  getDuration(from?: string): number {
    const start = from ? this.marks.get(from) : this.startTime;
    if (!start) return 0;
    return Date.now() - start;
  }

  getDurationBetween(from: string, to: string): number {
    const start = this.marks.get(from);
    const end = this.marks.get(to);
    if (!start || !end) return 0;
    return end - start;
  }

  getMarks(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [name, time] of this.marks) {
      result[name] = time - this.startTime;
    }
    return result;
  }
}

/**
 * Log performance metrics
 */
export function logPerformance(
  logger: pino.Logger,
  operation: string,
  timer: PerformanceTimer,
  additionalContext?: LogContext,
): void {
  const duration = timer.getDuration();
  const marks = timer.getMarks();

  logger.info(
    {
      operation,
      duration,
      marks,
      ...additionalContext,
    },
    `${operation} completed in ${duration}ms`,
  );
}

/**
 * Create a wrapped logger that adds context to all logs
 */
export function wrapLogger(logger: pino.Logger, context: LogContext): pino.Logger {
  return logger.child(context);
}

// Export pino types for convenience
export type { Logger } from 'pino';

// Default logger instance
export const defaultLogger = createLogger('constellation');
