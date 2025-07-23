/**
 * Global registry for librarian entries
 * Provides centralized access to librarian metadata and permissions
 */

import type { SecureLibrarianEntry } from './secure-loader';

/**
 * Global registry for tracking loaded librarians
 */
export class LibrarianRegistry {
  private entries: Map<string, SecureLibrarianEntry> = new Map();

  /**
   * Register a librarian entry
   */
  register(entry: SecureLibrarianEntry): void {
    this.entries.set(entry.id, entry);
  }

  /**
   * Get a librarian entry by ID
   */
  getEntry(id: string): SecureLibrarianEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Get all registered entries
   */
  getAllEntries(): SecureLibrarianEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Check if a librarian is registered
   */
  hasEntry(id: string): boolean {
    return this.entries.has(id);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Get entries by team
   */
  getEntriesByTeam(team: string): SecureLibrarianEntry[] {
    return Array.from(this.entries.values()).filter((entry) => entry.team === team);
  }

  /**
   * Get public entries
   */
  getPublicEntries(): SecureLibrarianEntry[] {
    return Array.from(this.entries.values()).filter((entry) => entry.permissions?.public === true);
  }
}

// Singleton instance
let registry: LibrarianRegistry | null = null;

/**
 * Get the global librarian registry instance
 */
export function getLibrarianRegistry(): LibrarianRegistry {
  if (!registry) {
    registry = new LibrarianRegistry();
  }
  return registry;
}

/**
 * Reset the registry (mainly for testing)
 */
export function resetLibrarianRegistry(): void {
  if (registry) {
    registry.clear();
  }
  registry = null;
}
