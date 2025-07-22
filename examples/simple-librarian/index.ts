/**
 * Simple Librarian Example
 * 
 * This shows the most basic librarian implementation.
 * It searches documentation and uses AI to answer queries.
 */

import { Librarian, Context, Response } from '../../interfaces/librarian';

/**
 * Mock function to search documentation
 * In production, this would search real data sources
 */
async function searchDocumentation(query: string): Promise<any[]> {
  // Simulate searching documentation
  console.log(`Searching for: ${query}`);
  
  return [
    {
      title: 'Getting Started Guide',
      content: 'This guide helps you get started with our platform...',
      url: 'https://docs.example.com/getting-started',
      relevance: 0.9
    },
    {
      title: 'API Reference',
      content: 'Complete API documentation for all endpoints...',
      url: 'https://docs.example.com/api',
      relevance: 0.7
    }
  ];
}

/**
 * Simple librarian that searches docs and answers queries
 */
export const simpleLibrarian: Librarian = async (
  query: string,
  context?: Context
): Promise<Response> => {
  try {
    // Step 1: Search relevant documentation
    const docs = await searchDocumentation(query);
    
    // Step 2: Use AI if available
    if (context?.ai) {
      const prompt = `
You are a helpful documentation assistant.

User Query: ${query}

Available Documentation:
${docs.map(doc => `- ${doc.title}: ${doc.content}`).join('\n')}

Please provide a helpful answer to the user's query based on the documentation.
      `.trim();
      
      const answer = await context.ai.complete(prompt);
      
      return {
        answer,
        sources: docs.map(doc => ({
          name: doc.title,
          url: doc.url,
          relevance: doc.relevance
        })),
        confidence: 0.85
      };
    }
    
    // Step 3: Fallback without AI
    return {
      answer: `I found ${docs.length} relevant documents. Please check the sources below.`,
      sources: docs.map(doc => ({
        name: doc.title,
        url: doc.url,
        relevance: doc.relevance
      })),
      confidence: 0.5
    };
    
  } catch (error) {
    // Step 4: Handle errors gracefully
    return {
      error: {
        code: 'SEARCH_ERROR',
        message: `Failed to search documentation: ${error.message}`,
        recoverable: true,
        suggestion: 'Try rephrasing your query or check back later'
      }
    };
  }
};

/**
 * Example of running the librarian
 */
if (require.main === module) {
  // Test without AI
  simpleLibrarian('How do I get started?')
    .then(response => {
      console.log('Response without AI:');
      console.log(JSON.stringify(response, null, 2));
    });
  
  // Test with mock AI
  const mockContext: Context = {
    ai: {
      complete: async (prompt: string) => {
        return 'To get started, follow these steps: 1) Install the CLI, 2) Run the setup command, 3) Deploy your first application.';
      },
      analyze: async (text: string, schema: any) => {
        return { analyzed: true };
      }
    }
  };
  
  simpleLibrarian('How do I get started?', mockContext)
    .then(response => {
      console.log('\nResponse with AI:');
      console.log(JSON.stringify(response, null, 2));
    });
}