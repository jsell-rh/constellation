/**
 * Documentation Helper Librarian
 * Answers questions about Constellation documentation
 */

import type { Context } from '../types/core';

// In a real implementation, this would search actual documentation
const DOCS_KNOWLEDGE = {
  'getting started': 'To get started with Constellation: 1) Install dependencies with `npm install`, 2) Copy `.env.example` to `.env`, 3) Run `npm run dev` to start the server, 4) Test with the MCP Inspector or curl commands.',
  'librarian': 'A librarian is a simple async function that answers queries. Teams write librarians to provide domain-specific knowledge. The framework handles routing, security, and observability.',
  'mcp': 'MCP (Model Context Protocol) is the communication protocol Constellation uses. It provides a standard way for AI systems to interact with tools and resources.',
  'authentication': 'Constellation supports JWT authentication. Set AUTH_ENABLED=true and JWT_SECRET in your environment. See JWT_AUTHENTICATION.md for details.',
  'registry': 'The registry (registry/constellation-registry.yaml) defines all available librarians with their security settings, team ownership, and performance hints.',
  'ai providers': 'Constellation supports OpenAI, Anthropic, Google Vertex AI, and any OpenAI-compatible server (Ollama, TGI, vLLM). Configure with environment variables.',
};

export default async function docsLibrarian(query: string, _context?: Context) {
  const lowerQuery = query.toLowerCase();
  
  // Search for relevant documentation
  for (const [topic, answer] of Object.entries(DOCS_KNOWLEDGE)) {
    if (lowerQuery.includes(topic)) {
      return {
        answer,
        confidence: 0.9,
        sources: [{
          name: `Constellation ${topic} documentation`,
          type: 'document' as const,
        }],
      };
    }
  }
  
  // Check for specific file requests
  if (lowerQuery.includes('architecture')) {
    return {
      answer: 'The system architecture is documented in ARCHITECTURE.md. It describes the distributed AI knowledge orchestration system with components like the Query Gateway, AI Delegation Engine, and Service Registry.',
      confidence: 0.85,
      sources: [{
        name: 'ARCHITECTURE.md',
        type: 'document' as const,
      }],
    };
  }
  
  if (lowerQuery.includes('implementation')) {
    return {
      answer: 'See IMPLEMENTATION_GUIDE.md for detailed build instructions. It covers all phases from core foundation to production deployment.',
      confidence: 0.85,
      sources: [{
        name: 'IMPLEMENTATION_GUIDE.md',
        type: 'document' as const,
      }],
    };
  }
  
  // Default documentation pointer
  return {
    answer: 'I can help with Constellation documentation. Ask about: getting started, librarians, MCP protocol, authentication, registry, or AI providers. You can also ask about specific files like ARCHITECTURE.md or IMPLEMENTATION_GUIDE.md.',
    confidence: 0.7,
  };
}