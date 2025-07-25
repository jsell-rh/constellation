// Quick test to check Gemini response structure
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiUsage() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set');
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-1.5-flash',
  });

  try {
    const result = await model.generateContent('Tell me a short joke');
    const response = await result.response;
    
    console.log('Full response structure:');
    console.log(JSON.stringify(response, null, 2));
    
    console.log('\nUsage info:');
    console.log('usageMetadata:', response.usageMetadata);
    
    // Check if OpenAI adapter returns usage
    console.log('\nChecking OpenAI-style adapter...');
    const baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
    
    const openaiResponse = await fetch(baseURL + 'chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'gemini-1.5-flash',
        messages: [{ role: 'user', content: 'Tell me a short joke' }],
        max_tokens: 100
      })
    });
    
    const openaiData = await openaiResponse.json();
    console.log('\nOpenAI adapter response:');
    console.log(JSON.stringify(openaiData, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testGeminiUsage();