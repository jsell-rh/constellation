/**
 * A librarian that can do basic math
 * Shows how to use the optional context parameter
 */

export default async function mathLibrarian(query: string, context?: any) {
  // Look for basic math operations
  const add = query.match(/(\d+)\s*\+\s*(\d+)/);
  const subtract = query.match(/(\d+)\s*-\s*(\d+)/);
  const multiply = query.match(/(\d+)\s*\*\s*(\d+)/);
  const divide = query.match(/(\d+)\s*\/\s*(\d+)/);
  
  if (add) {
    const [_, a, b] = add;
    const result = parseInt(a) + parseInt(b);
    return { answer: `${a} + ${b} = ${result}` };
  }
  
  if (subtract) {
    const [_, a, b] = subtract;
    const result = parseInt(a) - parseInt(b);
    return { answer: `${a} - ${b} = ${result}` };
  }
  
  if (multiply) {
    const [_, a, b] = multiply;
    const result = parseInt(a) * parseInt(b);
    return { answer: `${a} * ${b} = ${result}` };
  }
  
  if (divide) {
    const [_, a, b] = divide;
    if (parseInt(b) === 0) {
      return { answer: "I can't divide by zero!" };
    }
    const result = parseInt(a) / parseInt(b);
    return { answer: `${a} / ${b} = ${result}` };
  }
  
  // Use AI if available
  if (context?.ai) {
    const answer = await context.ai.ask(`Solve this math problem: ${query}`);
    return { answer };
  }
  
  return { 
    answer: "I can handle basic math operations (+, -, *, /). Try asking '5 + 3' or '10 * 4'!" 
  };
}