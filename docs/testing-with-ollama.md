# Testing Constellation with Ollama

This guide shows how to test Constellation's AI-powered routing using a local Ollama instance.

## Prerequisites

1. Install [Ollama](https://ollama.ai/)
2. Pull the qwen3:8b model (or any other model you prefer):
   ```bash
   ollama pull qwen3:8b
   ```
3. Ensure Ollama is running:
   ```bash
   ollama serve
   ```

## Configuration

1. Copy the Ollama example environment file:
   ```bash
   cp .env.ollama.example .env
   ```

2. The key configuration settings are:
   ```env
   OPENAI_API_KEY=ollama              # Ollama doesn't need a real key
   OPENAI_MODEL=qwen3:8b              # Your Ollama model
   OPENAI_BASE_URL=http://localhost:11434/v1  # Ollama's OpenAI-compatible endpoint
   ```

## Testing AI Routing

### Option 1: Run the Test Script

We've provided a test script that demonstrates AI-powered routing:

```bash
npm run build
npx tsx scripts/test-ai-routing.ts
```

This script will:
- Create sample librarians (Kubernetes, Wiki, HR)
- Configure AI routing with permission-based filtering
- Test various queries with different user contexts
- Show how the AI routes queries to appropriate librarians

### Option 2: Start the Server

1. Start Constellation:
   ```bash
   npm run dev
   ```

2. Test with curl:
   ```bash
   # Query as a platform team member (access to Kubernetes librarian)
   curl -X POST http://localhost:3000/query \
     -H "Content-Type: application/json" \
     -d '{
       "query": "How do I deploy to Kubernetes?",
       "context": {
         "user": {
           "id": "user123",
           "teams": ["platform"],
           "roles": ["developer"]
         }
       }
     }'

   # Query as a general user (only access to public wiki)
   curl -X POST http://localhost:3000/query \
     -H "Content-Type: application/json" \
     -d '{
       "query": "What is the vacation policy?",
       "context": {
         "user": {
           "id": "user456",
           "teams": ["engineering"],
           "roles": ["employee"]
         }
       }
     }'
   ```

## How AI Routing Works

1. **Query Analysis**: The AI analyzes the incoming query to understand:
   - User intent
   - Required capabilities
   - Domain/topic

2. **Permission Filtering**: The system filters available librarians based on:
   - User's team membership
   - User's roles
   - Public access flags

3. **Relevance Scoring**: The AI scores each authorized librarian based on:
   - How well their capabilities match the query
   - How well their description aligns with the intent
   - Domain expertise

4. **Routing Decision**: The system routes to the highest-scoring librarian(s)

## Example Output

When running the test script, you'll see output like:

```
🔍 Testing query {
  query: 'How do I deploy my app to Kubernetes?',
  user: 'dev123'
}

✅ Success response {
  answer: 'To deploy your app to Kubernetes, you need to...',
  metadata: {
    delegation: {
      engine: 'ai-powered',
      decision: ['kubernetes-ops'],
      reasoning: 'AI routing based on intent: "Deploy application to Kubernetes". User is team owner',
      confidence: 0.95
    }
  }
}
```

## Troubleshooting

### Ollama Connection Issues
- Ensure Ollama is running: `ollama serve`
- Check the endpoint: `curl http://localhost:11434/v1/models`
- Verify the model is downloaded: `ollama list`

### AI Routing Not Working
- Check logs for AI analysis details
- Ensure `AI_PROVIDER` is set in environment
- Verify the AI client is initialized (check startup logs)

### Permission Errors
- Verify user context includes teams/roles
- Check librarian permissions in registry
- Look for "No authorized librarians" messages in logs

## Performance Considerations

- Ollama may be slower than cloud providers for initial responses
- Consider adjusting `AI_TIMEOUT` if needed
- Use smaller models for faster response times
- Enable caching to avoid repeated AI calls

## Next Steps

- Try different Ollama models (llama2, mistral, etc.)
- Customize the AI prompts in `ai-analyzer.ts`
- Add more librarians with different capabilities
- Test delegation between multiple librarians
