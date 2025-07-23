/**
 * The simplest possible librarian - just a function!
 * No imports, no complexity, just answer questions about weather.
 */

export default async function weatherLibrarian(query: string) {
  const q = query.toLowerCase();
  
  if (q.includes('weather') || q.includes('temperature') || q.includes('rain')) {
    // In real life, you might call a weather API here
    return {
      answer: "It's a beautiful sunny day with a temperature of 72°F (22°C). Perfect weather for being outside!",
      confidence: 0.9
    };
  }
  
  // Not a weather question - let someone else handle it
  return {
    delegate: { to: 'general' }
  };
}