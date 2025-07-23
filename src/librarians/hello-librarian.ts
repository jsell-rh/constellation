/**
 * Hello World Librarian
 * A simple greeting librarian that demonstrates the basic pattern
 */

import type { Context } from '../types/core';

export default async function helloLibrarian(query: string, _context?: Context) {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('hello') || lowerQuery.includes('hi')) {
    return {
      answer: 'Hello! I am Constellation, a distributed AI knowledge orchestration system. How can I help you today?',
      confidence: 1.0,
    };
  }
  
  if (lowerQuery.includes('who are you') || lowerQuery.includes('what are you')) {
    return {
      answer: 'I am Constellation, a framework that enables teams to create AI-powered knowledge agents called "librarians". Each librarian specializes in specific domains and can collaborate to answer complex questions.',
      confidence: 0.95,
    };
  }
  
  if (lowerQuery.includes('help')) {
    return {
      answer: 'I can help you access knowledge from various expert librarians. You can ask about Kubernetes, code reviews, deployments, documentation, and more. What would you like to know?',
      confidence: 0.9,
    };
  }
  
  // Default response
  return {
    answer: 'I\'m a simple greeting librarian. Try saying "hello" or ask me "who are you". For more complex questions, other specialist librarians can help!',
    confidence: 0.7,
  };
}