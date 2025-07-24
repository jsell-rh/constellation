/**
 * File-based prompt loader with caching and template rendering
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import nunjucks from 'nunjucks';
import type { PromptLoader, PromptTemplate, PromptVariables, PromptMetadata } from './interface';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export class FileSystemPromptLoader implements PromptLoader {
  private cache = new Map<string, PromptTemplate>();
  private promptsDir: string;
  private nunjucksEnv: nunjucks.Environment;

  constructor(promptsDir?: string) {
    this.promptsDir = promptsDir || path.join(process.cwd(), 'prompts');

    // Configure Nunjucks environment
    this.nunjucksEnv = new nunjucks.Environment(null, {
      autoescape: false, // Don't escape HTML since we're generating text
      throwOnUndefined: false, // Return empty string for undefined variables
      trimBlocks: true, // Remove newlines after block tags
      lstripBlocks: true, // Remove leading whitespace before block tags
    });

    // Add custom filters for common use cases
    this.nunjucksEnv.addFilter('round', (value: number) => Math.round(value));
  }

  async load(category: string, name: string): Promise<PromptTemplate> {
    const cacheKey = `${category}/${name}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const filePath = path.join(this.promptsDir, category, `${name}.md`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const template = this.parsePromptFile(content);

      // Cache the template
      this.cache.set(cacheKey, template);

      logger.debug(
        { category, name, version: template.metadata.version },
        'Prompt template loaded',
      );

      return template;
    } catch (error) {
      logger.error({ error, category, name }, 'Failed to load prompt template');
      throw new Error(`Failed to load prompt ${category}/${name}: ${(error as Error).message}`);
    }
  }

  render(template: PromptTemplate, variables: PromptVariables): string {
    // Validate required variables
    const validationErrors = this.validate(template, variables);
    if (validationErrors.length > 0) {
      throw new Error(`Missing required variables: ${validationErrors.join(', ')}`);
    }

    // Log prompt metadata when used
    logger.info(
      {
        promptName: template.metadata.name,
        promptVersion: template.metadata.version,
        promptDescription: template.metadata.description,
        variableCount: Object.keys(variables).length,
        templateLength: template.template.length,
      },
      'Rendering prompt template',
    );

    try {
      // Use Nunjucks to render the template
      const rendered = this.nunjucksEnv.renderString(template.template, variables);

      logger.debug(
        {
          promptName: template.metadata.name,
          promptVersion: template.metadata.version,
          renderedLength: rendered.length,
        },
        'Successfully rendered prompt template',
      );

      return rendered.trim();
    } catch (error) {
      logger.error(
        {
          error,
          promptName: template.metadata.name,
          promptVersion: template.metadata.version,
          variables: Object.keys(variables),
        },
        'Failed to render prompt template',
      );
      throw new Error(
        `Failed to render prompt ${template.metadata.name}: ${(error as Error).message}`,
      );
    }
  }

  async list(): Promise<Array<{ category: string; name: string; metadata: PromptMetadata }>> {
    const result: Array<{ category: string; name: string; metadata: PromptMetadata }> = [];

    try {
      const categories = await fs.readdir(this.promptsDir, { withFileTypes: true });

      for (const categoryDir of categories) {
        if (!categoryDir.isDirectory() || categoryDir.name === 'schemas') {
          continue;
        }

        const categoryPath = path.join(this.promptsDir, categoryDir.name);
        const files = await fs.readdir(categoryPath);

        for (const file of files) {
          if (file.endsWith('.md')) {
            const name = path.basename(file, '.md');
            try {
              const template = await this.load(categoryDir.name, name);
              result.push({
                category: categoryDir.name,
                name,
                metadata: template.metadata,
              });
            } catch (error) {
              logger.warn(
                { error, category: categoryDir.name, name },
                'Failed to load prompt for listing',
              );
            }
          }
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed to list prompts');
    }

    return result;
  }

  validate(template: PromptTemplate, variables: PromptVariables): string[] {
    const errors: string[] = [];

    for (const variable of template.metadata.variables) {
      if (variable.required !== false && !(variable.name in variables)) {
        errors.push(variable.name);
      }
    }

    return errors;
  }

  /**
   * Clear the cache (useful for development/testing)
   */
  clearCache(): void {
    this.cache.clear();
  }

  private parsePromptFile(content: string): PromptTemplate {
    const lines = content.split('\n');
    let frontmatterEnd = -1;

    // Find frontmatter boundaries
    if (lines[0] === '---') {
      for (let i = 1; i < lines.length; i++) {
        if (lines[i] === '---') {
          frontmatterEnd = i;
          break;
        }
      }
    }

    if (frontmatterEnd === -1) {
      throw new Error('Invalid prompt file: missing YAML frontmatter');
    }

    // Parse YAML frontmatter
    const frontmatter = lines.slice(1, frontmatterEnd).join('\n');
    const metadata = yaml.load(frontmatter) as PromptMetadata;

    // Validate metadata
    if (!metadata.name || !metadata.version || !metadata.variables) {
      throw new Error('Invalid prompt metadata: missing required fields');
    }

    // Extract template content
    const template = lines
      .slice(frontmatterEnd + 1)
      .join('\n')
      .trim();

    return {
      metadata,
      template,
    };
  }
}

/**
 * Global prompt loader instance
 */
let globalPromptLoader: PromptLoader | null = null;

/**
 * Get the global prompt loader instance
 */
export function getPromptLoader(): PromptLoader {
  if (!globalPromptLoader) {
    globalPromptLoader = new FileSystemPromptLoader();
  }
  return globalPromptLoader;
}

/**
 * Set a custom prompt loader (useful for testing)
 */
export function setPromptLoader(loader: PromptLoader): void {
  globalPromptLoader = loader;
}
