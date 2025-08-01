/**
 * JWT Authentication Middleware
 * Provides simple but secure authentication for the MCP server
 */

import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { User } from '../types/core';
import { createLogger } from '../observability/logger';

const logger = createLogger('jwt-auth');

export interface JWTConfig {
  secret: string;
  publicEndpoints?: string[]; // Endpoints that don't require auth
  enabled?: boolean;
}

export interface JWTPayload {
  sub: string; // User ID
  email: string;
  teams: string[];
  roles: string[];
  iat?: number;
  exp?: number;
}

/**
 * Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: User;
}

/**
 * Create JWT middleware for Express
 */
export function createJWTMiddleware(
  config: JWTConfig,
): (req: Request, res: Response, next: NextFunction) => void {
  // Allow disabling auth for development
  if (!config.enabled) {
    return (_req: Request, _res: Response, next: NextFunction) => {
      logger.warn('Authentication is disabled - not for production use!', {
        enabled: false,
        errorCode: 'AUTH_DISABLED',
        errorType: 'security',
        recoverable: false,
      });
      next();
    };
  }

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip auth for public endpoints
    if (config.publicEndpoints?.includes(req.path)) {
      return next();
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        error: {
          code: 'MISSING_AUTH',
          message: 'Authorization header required',
        },
      });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    try {
      // Verify and decode token
      const payload = jwt.verify(token, config.secret) as JWTPayload;

      // Create user object
      const user: User = {
        id: payload.sub,
        metadata: {
          email: payload.email,
        },
      };

      // Add teams and roles if present
      if (payload.teams) {
        user.teams = payload.teams;
      }
      if (payload.roles) {
        user.roles = payload.roles;
      }

      // Attach to request
      (req as AuthenticatedRequest).user = user;

      logger.debug('Authenticated request', {
        userId: user.id,
        teamCount: user.teams?.length || 0,
        roleCount: user.roles?.length || 0,
      });

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Authentication token has expired',
          },
        });
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid authentication token',
          },
        });
      }

      logger.error('Authentication error', {
        err: error,
        errorCode: 'AUTH_ERROR',
        errorType: 'security',
        recoverable: false,
      });
      return res.status(500).json({
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication failed',
        },
      });
    }
  };
}

/**
 * Generate a JWT token (for testing or auth service)
 */
export function generateToken(
  user: {
    id: string;
    email: string;
    teams: string[];
    roles: string[];
  },
  secret: string,
  expiresIn: string = '24h',
): string {
  const payload: JWTPayload = {
    sub: user.id,
    email: user.email,
    teams: user.teams,
    roles: user.roles,
  };

  return jwt.sign(payload, secret, { expiresIn: expiresIn } as jwt.SignOptions);
}

/**
 * Extract user from Express request (after middleware)
 */
export function getUserFromRequest(req: Request): User | undefined {
  return (req as AuthenticatedRequest).user;
}

/**
 * Simple auth configuration from environment
 */
export function getAuthConfig(): JWTConfig {
  return {
    secret: process.env.JWT_SECRET || 'change-in-production',
    enabled: process.env.AUTH_ENABLED === 'true',
    publicEndpoints: ['/health', '/mcp/health'], // Health checks don't need auth
  };
}
