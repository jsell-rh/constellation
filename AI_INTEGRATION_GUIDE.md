# AI Integration Guide for Constellation

This guide explains how to integrate AI capabilities into your Constellation librarians using the built-in AI client system.

## Overview

Constellation provides a unified AI client interface that supports multiple providers:
- **OpenAI** (GPT-4, GPT-3.5, etc.)
- **Anthropic** (Claude models)
- **Google Vertex AI** (Gemini models)

The AI client is automatically injected into the librarian execution context, allowing librarians to leverage AI capabilities seamlessly.

## Quick Start

### 1. Environment Setup

Configure your AI provider by setting the appropriate environment variables:

```bash
# Choose your default provider
AI_DEFAULT_PROVIDER=openai  # or "anthropic" or "vertex-ai"

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4  # optional, defaults to gpt-4
OPENAI_BASE_URL=https://api.openai.com/v1  # optional

# OpenAI-Compatible Servers (Ollama, TGI, vLLM, etc.)
# Example: Ollama
OPENAI_API_KEY=not-needed  # Required but can be any value for local servers
OPENAI_MODEL=llama2:7b  # Use the model name from your server
OPENAI_BASE_URL=http://localhost:11434/v1  # Your server's OpenAI-compatible endpoint

# Example: Text Generation Inference (TGI)
OPENAI_API_KEY=not-needed
OPENAI_MODEL=microsoft/DialoGPT-medium
OPENAI_BASE_URL=http://localhost:8080/v1

# Example: vLLM
OPENAI_API_KEY=not-needed  
OPENAI_MODEL=meta-llama/Llama-2-7b-chat-hf
OPENAI_BASE_URL=http://localhost:8000/v1

# Anthropic Configuration  
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022  # optional

# Google Vertex AI Configuration
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_LOCATION=us-central1  # optional, defaults to us-central1
GOOGLE_MODEL=gemini-1.5-pro  # optional
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json  # optional

# Global AI Settings
AI_TEMPERATURE=0.7  # optional, 0-1 scale
AI_MAX_TOKENS=2048  # optional
AI_TIMEOUT=30000    # optional, in milliseconds
```

### 2. Basic AI-Powered Librarian

```typescript
import { createLibrarian } from './types/librarian-factory';
import type { Context, Response } from './types/core';

export const myAILibrarian = createLibrarian(async (query: string, context?: Context): Promise<Response> => {
  // Check if AI is available
  if (!context?.ai) {
    return {
      answer: 'AI capabilities are not available.',
      confidence: 0.1,
    };
  }

  try {
    // Simple AI completion
    const answer = await context.ai.ask(query, {
      temperature: 0.7,
      max_tokens: 500,
    });

    return {
      answer,
      confidence: 0.9,
      sources: [{
        name: `AI Assistant (${context.ai.defaultProvider.name})`,
        type: 'api',
        timestamp: Date.now(),
      }],
      metadata: {
        aiGenerated: true,
        provider: context.ai.defaultProvider.name,
      },
    };
  } catch (error) {
    return {
      answer: 'Sorry, I encountered an error while processing your request.',
      error: {
        code: 'AI_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        recoverable: true,
      },
    };
  }
});
```

### 3. Advanced AI Usage

For more sophisticated AI interactions, use the `complete` method with conversation history:

```typescript
export const conversationLibrarian = createLibrarian(async (query: string, context?: Context): Promise<Response> => {
  if (!context?.ai) {
    return { answer: 'AI not available', confidence: 0.1 };
  }

  const systemPrompt = `You are a helpful assistant specialized in technical documentation.
  Provide clear, accurate answers with examples when appropriate.`;

  try {
    const response = await context.ai.complete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ], {
      temperature: 0.3,
      max_tokens: 1000,
    });

    return {
      answer: response.content,
      confidence: 0.95,
      metadata: {
        usage: response.usage,
        model: response.model,
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'AI_COMPLETION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
});
```

## AI Client API Reference

The AI client is available in the librarian context as `context.ai` and provides these methods:

### Basic Methods

#### `ask(prompt: string, options?: AICompletionOptions): Promise<string>`
Simple text completion for straightforward queries.

```typescript
const answer = await context.ai.ask("Explain TypeScript interfaces", {
  temperature: 0.5,
  max_tokens: 300
});
```

#### `complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AIResponse>`
Full conversation completion with message history.

```typescript
const response = await context.ai.complete([
  { role: 'system', content: 'You are a code reviewer' },
  { role: 'user', content: 'Review this function: ...' }
], { temperature: 0.2 });

console.log(response.content);
console.log(response.usage); // Token usage information
```

#### `stream(messages: AIMessage[], options?: AICompletionOptions): Promise<AIStreamResponse>`
Streaming responses for real-time interaction.

```typescript
const stream = await context.ai.stream([
  { role: 'user', content: 'Write a long explanation...' }
]);

for await (const chunk of stream) {
  console.log(chunk); // Process each chunk as it arrives
}
```

### Provider-Specific Methods

#### `completeWith(provider: string, messages: AIMessage[], options?: AICompletionOptions): Promise<AIResponse>`
Force completion using a specific provider.

```typescript
// Use Anthropic for this specific query
const response = await context.ai.completeWith('anthropic', [
  { role: 'user', content: 'Analyze this code for security issues' }
]);
```

#### `askWith(provider: string, prompt: string, options?: AICompletionOptions): Promise<string>`
Simple completion with a specific provider.

```typescript
const answer = await context.ai.askWith('openai', 'Summarize this document');
```

### Options Interface

```typescript
interface AICompletionOptions {
  max_tokens?: number;     // Maximum tokens to generate
  temperature?: number;    // 0-1, higher = more creative  
  stop?: string[];         // Stop sequences
  stream?: boolean;        // Enable streaming
  system?: string;         // System prompt
  timeout?: number;        // Request timeout in ms
}
```

## Built-in AI Librarians

Constellation includes several pre-built AI-powered librarians:

### AI Assistant (`ai-assistant`)
General-purpose AI assistant for answering various questions.

**Capabilities:** `['general-knowledge', 'question-answering', 'conversation']`

**Example Query:**
```json
{
  "name": "query_librarian",
  "arguments": {
    "librarian_id": "ai-assistant",
    "query": "What are the benefits of microservices architecture?"
  }
}
```

### Kubernetes Expert (`kubernetes-expert`)
Specialized AI assistant with deep Kubernetes knowledge.

**Capabilities:** `['kubernetes', 'k8s', 'containers', 'orchestration', 'devops', 'helm']`

**Example Query:**
```json
{
  "name": "query_librarian", 
  "arguments": {
    "librarian_id": "kubernetes-expert",
    "query": "How do I troubleshoot a failing pod in Kubernetes?"
  }
}
```

### Code Reviewer (`code-reviewer`)
AI-powered code review assistant.

**Capabilities:** `['code-review', 'debugging', 'security', 'performance', 'refactoring']`

**Example Query:**
```json
{
  "name": "query_librarian",
  "arguments": {
    "librarian_id": "code-reviewer", 
    "query": "Review this function: function getUserData(id) { return fetch('/api/users/' + id); }"
  }
}
```

## Best Practices

### 1. Handle AI Availability
Always check if AI is available before using it:

```typescript
if (!context?.ai) {
  return {
    answer: 'This librarian requires AI capabilities to function.',
    confidence: 0.1,
  };
}
```

### 2. Error Handling
Implement robust error handling for AI operations:

```typescript
try {
  const answer = await context.ai.ask(query);
  return { answer, confidence: 0.9 };
} catch (error) {
  return {
    answer: 'I encountered an error processing your request.',
    error: {
      code: 'AI_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      recoverable: true,
    },
  };
}
```

### 3. Optimize for Performance
- Use appropriate temperature settings (lower for factual queries, higher for creative tasks)
- Set reasonable token limits to control costs
- Consider provider strengths (e.g., Claude for analysis, GPT-4 for general tasks)

### 4. Delegation Patterns
Use delegation to route queries to specialized AI librarians:

```typescript
export const smartRouter = createLibrarian(async (query: string, context?: Context): Promise<Response> => {
  const lowerQuery = query.toLowerCase();
  
  // Route based on keywords
  if (lowerQuery.includes('kubernetes') || lowerQuery.includes('k8s')) {
    return {
      delegate: { to: 'kubernetes-expert', query }
    };
  }
  
  if (lowerQuery.includes('code') || lowerQuery.includes('function')) {
    return {
      delegate: { to: 'code-reviewer', query }  
    };
  }
  
  // Default to general AI assistant
  return {
    delegate: { to: 'ai-assistant', query }
  };
});
```

### 5. System Prompts
Use system prompts to provide context and constraints:

```typescript
const systemPrompt = `You are a senior DevOps engineer with expertise in:
- Kubernetes and container orchestration
- CI/CD pipelines and automation  
- Infrastructure as Code (Terraform, CloudFormation)
- Monitoring and observability

Always provide practical, actionable advice with command examples where relevant.
If you're not certain about something, clearly state your uncertainty.`;

const response = await context.ai.complete([
  { role: 'system', content: systemPrompt },
  { role: 'user', content: query }
]);
```

## Provider-Specific Notes

### OpenAI
- Best for: General-purpose tasks, creative writing, code generation
- Models: `gpt-4`, `gpt-4-turbo`, `gpt-4o`, `gpt-3.5-turbo`
- Rate limits apply based on your OpenAI plan

### OpenAI-Compatible Servers
The OpenAI provider also supports any server with OpenAI-compatible endpoints:

#### Ollama
```bash
# Start Ollama with a model
ollama serve
ollama pull llama2:7b

# Configure Constellation
OPENAI_API_KEY=ollama  # Any non-empty value
OPENAI_MODEL=llama2:7b
OPENAI_BASE_URL=http://localhost:11434/v1
```

#### Text Generation Inference (TGI)
```bash
# Start TGI server
docker run --gpus all -p 8080:80 \
  ghcr.io/huggingface/text-generation-inference:latest \
  --model-id microsoft/DialoGPT-medium

# Configure Constellation
OPENAI_API_KEY=tgi
OPENAI_MODEL=microsoft/DialoGPT-medium
OPENAI_BASE_URL=http://localhost:8080/v1
```

#### vLLM
```bash
# Start vLLM server
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-2-7b-chat-hf

# Configure Constellation
OPENAI_API_KEY=vllm
OPENAI_MODEL=meta-llama/Llama-2-7b-chat-hf
OPENAI_BASE_URL=http://localhost:8000/v1
```

### Anthropic (Claude)
- Best for: Analysis, research, complex reasoning tasks
- Models: `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`
- Generally more verbose and thorough in responses

### Google Vertex AI
- Best for: Google Cloud integration, multilingual tasks
- Models: `gemini-1.5-pro`, `gemini-1.5-flash`
- Requires Google Cloud project setup

## Testing AI Integration

### Unit Testing
Mock the AI client for predictable testing:

```typescript
const mockAI = {
  ask: jest.fn().mockResolvedValue('Mock response'),
  complete: jest.fn().mockResolvedValue({ content: 'Mock response' }),
} as any;

const context = { ai: mockAI };
const response = await myLibrarian('test query', context);
expect(response.answer).toBe('Mock response');
```

### Integration Testing
Test with actual AI providers using test API keys:

```bash
# Set test environment variables
export OPENAI_API_KEY=sk-test-key
export AI_DEFAULT_PROVIDER=openai
npm test
```

## Monitoring and Observability

AI operations are automatically traced when observability is enabled:

```typescript
// Usage information is included in responses
const response = await context.ai.complete(messages);
console.log(response.usage); // { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 }
```

## Troubleshooting

### Common Issues

1. **"AI not available" errors**
   - Check environment variables are set correctly
   - Verify API keys are valid and have sufficient credits
   - Ensure the default provider is properly configured

2. **Rate limit errors**
   - Implement exponential backoff
   - Consider switching providers for burst traffic
   - Monitor token usage and optimize prompts

3. **High latency**
   - Use streaming for long responses
   - Optimize prompts to reduce token usage
   - Consider provider-specific performance characteristics

4. **Cost optimization**
   - Set appropriate `max_tokens` limits
   - Use cheaper models (e.g., GPT-3.5) for simple tasks
   - Cache common responses when possible

### Debug Mode
Enable debug logging to troubleshoot AI operations:

```bash
LOG_LEVEL=debug npm start
```

This will show detailed logs of AI provider initialization, request/response cycles, and error details.

## Next Steps

With AI integration complete, you can:
1. Create domain-specific AI librarians for your use cases
2. Implement intelligent routing based on query analysis  
3. Add streaming responses for real-time interactions
4. Set up monitoring and cost tracking for AI usage
5. Explore advanced prompting techniques and RAG patterns

For more examples, see the `/src/examples/ai-assistant-librarian.ts` file in the codebase.