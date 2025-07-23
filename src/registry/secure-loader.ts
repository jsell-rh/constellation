/**
 * Secure Registry Loader
 * Loads librarians with team ownership and security validation
 * while keeping the developer experience simple
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { createLibrarian } from '../types/librarian-factory';
import type { LibrarianImplementation } from '../types/librarian-factory';
import type { Librarian, LibrarianInfo, Context, Response } from '../types/core';
import type { SimpleRouter } from '../core/router';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export interface SecureLibrarianEntry {
  // Required fields
  id: string;
  function: string;  // Path to the function file
  team: string;      // Team that owns this librarian
  
  // Optional metadata
  name?: string;
  description?: string;
  
  // Security settings
  permissions?: {
    public?: boolean;              // If true, no auth required
    allowedTeams?: string[];       // Teams that can access
    allowedRoles?: string[];       // Roles that can access
    sensitiveData?: boolean;       // Extra audit logging
  };
  
  // Performance hints
  performance?: {
    cache?: boolean | number;      // Enable caching (TTL in seconds)
    timeout?: number;              // Custom timeout in ms
    rateLimit?: number;            // Requests per minute
  };
  
  // Resilience configuration
  resilience?: {
    circuit_breaker?: Partial<CircuitBreakerConfig>;
    retry?: {
      max_attempts?: number;
      backoff?: string;
    };
    timeout_ms?: number;
  };
}

export interface RegistryConfig {
  version?: string;
  librarians: SecureLibrarianEntry[];
}

/**
 * Load and validate the registry file
 */
export async function loadRegistry(registryPath: string): Promise<RegistryConfig> {
  try {
    const content = await fs.readFile(registryPath, 'utf-8');
    const config = yaml.load(content) as RegistryConfig;
    
    // Basic validation
    if (!Array.isArray(config.librarians)) {
      throw new Error('Registry must contain a "librarians" array');
    }
    
    // Validate each entry
    for (const entry of config.librarians) {
      validateLibrarianEntry(entry);
    }
    
    logger.info(`Loaded registry with ${config.librarians.length} librarians`);
    return config;
  } catch (error) {
    logger.error({ error, path: registryPath }, 'Failed to load registry');
    throw new Error(`Registry loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate a librarian entry
 */
function validateLibrarianEntry(entry: SecureLibrarianEntry): void {
  if (!entry.id || typeof entry.id !== 'string') {
    throw new Error(`Invalid librarian entry: missing or invalid id`);
  }
  
  if (!entry.function || typeof entry.function !== 'string') {
    throw new Error(`Invalid librarian ${entry.id}: missing or invalid function path`);
  }
  
  if (!entry.team || typeof entry.team !== 'string') {
    throw new Error(`Invalid librarian ${entry.id}: missing team ownership`);
  }
  
  // Validate permissions if provided
  if (entry.permissions) {
    if (entry.permissions.allowedTeams && !Array.isArray(entry.permissions.allowedTeams)) {
      throw new Error(`Invalid librarian ${entry.id}: allowedTeams must be an array`);
    }
    if (entry.permissions.allowedRoles && !Array.isArray(entry.permissions.allowedRoles)) {
      throw new Error(`Invalid librarian ${entry.id}: allowedRoles must be an array`);
    }
  }
}

/**
 * Create a secure wrapper for a librarian that adds auth checks
 */
function createSecureLibrarian(
  librarianFn: Librarian,
  entry: SecureLibrarianEntry
): Librarian {
  return async (query: string, context?: Context): Promise<Response> => {
    // Public librarians bypass auth
    if (entry.permissions?.public) {
      return librarianFn(query, context);
    }
    
    // Check authentication
    if (!context?.user) {
      logger.warn({ librarianId: entry.id }, 'Unauthenticated access attempt');
      return {
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required to access this librarian',
        },
      };
    }
    
    // Check authorization
    const authorized = checkAuthorization(context.user, entry);
    if (!authorized) {
      logger.warn({
        librarianId: entry.id,
        userId: context.user.id,
        userTeams: context.user.teams,
      }, 'Unauthorized access attempt');
      
      return {
        error: {
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to access this librarian',
        },
      };
    }
    
    // Log sensitive data access
    if (entry.permissions?.sensitiveData) {
      logger.info({
        librarianId: entry.id,
        userId: context.user.id,
        query: query.substring(0, 50) + '...',  // Truncate for privacy
      }, 'Sensitive data access');
    }
    
    // Execute the librarian with enriched context
    const enrichedContext: Context = {
      ...context,
      librarian: {
        id: entry.id,
        name: entry.name || entry.id,
        description: entry.description || '',
        capabilities: [],
        team: entry.team,
        circuitBreaker: entry.resilience?.circuit_breaker,
      },
    };
    
    return librarianFn(query, enrichedContext);
  };
}

/**
 * Check if a user is authorized to access a librarian
 */
function checkAuthorization(
  user: { teams?: string[]; roles?: string[] },
  entry: SecureLibrarianEntry
): boolean {
  // Team owners always have access
  if (user.teams?.includes(entry.team)) {
    return true;
  }
  
  // Check allowed teams
  if (entry.permissions?.allowedTeams) {
    const hasTeamAccess = entry.permissions.allowedTeams.some(
      team => user.teams?.includes(team)
    );
    if (hasTeamAccess) return true;
  }
  
  // Check allowed roles
  if (entry.permissions?.allowedRoles) {
    const hasRoleAccess = entry.permissions.allowedRoles.some(
      role => user.roles?.includes(role)
    );
    if (hasRoleAccess) return true;
  }
  
  return false;
}

/**
 * Load a librarian function from a file path
 */
async function loadLibrarianFunction(functionPath: string): Promise<Librarian> {
  try {
    // Resolve relative to project root
    const absolutePath = path.resolve(process.cwd(), functionPath);
    
    // For TypeScript files in development, use the src path
    const importPath = absolutePath.replace(/\.ts$/, '');
    
    // Import the module
    const module = await import(importPath) as { default: unknown };
    
    // Get the default export
    const librarianFn = module.default;
    
    if (typeof librarianFn !== 'function') {
      throw new Error('Default export must be a function');
    }
    
    // Wrap with error handling
    return createLibrarian(librarianFn as LibrarianImplementation);
  } catch (error) {
    throw new Error(
      `Failed to load librarian from ${functionPath}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Load all librarians from a registry file and register them
 */
export async function loadLibrarians(
  registryPath: string,
  router: SimpleRouter
): Promise<void> {
  const registry = await loadRegistry(registryPath);
  
  for (const entry of registry.librarians) {
    try {
      // Load the function
      const librarianFn = await loadLibrarianFunction(entry.function);
      
      // Create secure wrapper
      const secureLibrarian = createSecureLibrarian(librarianFn, entry);
      
      // Create metadata
      const metadata: LibrarianInfo = {
        id: entry.id,
        name: entry.name || entry.id,
        description: entry.description || '',
        capabilities: [],
        team: entry.team,
      };
      
      // Register with router
      router.register(metadata, secureLibrarian);
      
      logger.info({
        id: entry.id,
        team: entry.team,
        public: entry.permissions?.public || false,
      }, 'Registered librarian');
      
    } catch (error) {
      logger.error({
        error,
        librarianId: entry.id,
        functionPath: entry.function,
      }, 'Failed to load librarian');
      
      // Continue loading others
      continue;
    }
  }
  
  logger.info(`Successfully loaded ${router.getAllLibrarians().length} librarians`);
}