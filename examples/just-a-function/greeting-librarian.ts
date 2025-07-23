/**
 * Even simpler - just say hello!
 * This shows the absolute minimum librarian.
 */

export default async function greetingLibrarian(query: string) {
  return {
    answer: `Hello! You said: "${query}". How can I help you today?`
  };
}