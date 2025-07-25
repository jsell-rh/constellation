# AI Token Usage Metrics

## Overview

Constellation tracks AI token usage through Prometheus metrics, providing visibility into AI provider costs and usage patterns.

## How Token Tracking Works

1. **AI Response with Usage Data**
   - Gemini (via OpenAI adapter) returns usage data in responses:
   ```json
   {
     "content": "...",
     "usage": {
       "prompt_tokens": 6,
       "completion_tokens": 15,
       "total_tokens": 21
     },
     "model": "gemini-2.5-flash"
   }
   ```

2. **Metrics Wrapper Records Usage**
   - The `MetricsAIProvider` wrapper intercepts responses
   - Records token counts to Prometheus counters
   - Tracks both prompt and completion tokens separately

3. **Metric Format**
   ```
   constellation_ai_tokens_total{provider="gemini",model="gemini-2.5-flash",type="prompt"} 6
   constellation_ai_tokens_total{provider="gemini",model="gemini-2.5-flash",type="completion"} 15
   ```

## Viewing Token Metrics

### In Prometheus/Grafana

Token usage appears in the dashboards under "AI Token Usage":
- Stacked by provider and type (prompt/completion)
- Shows token consumption over time

### Direct Metrics Endpoint

```bash
curl http://localhost:9090/metrics | grep constellation_ai_tokens_total
```

## Important Notes

### Token Metrics Only Appear After AI Usage

The metrics won't show any data until the AI has been used by the server. Test queries through MCP tools or librarians that use AI will populate these metrics.

### Separate Metrics Registries

If you create a standalone test that initializes its own `ConstellationAIClient`, it will have its own metrics registry. Only AI usage through the server's AI client instance will appear in the `/metrics` endpoint.

### Provider Support

Currently, token usage tracking is supported for:
- **Gemini** (via OpenAI adapter) ✅
- **OpenAI** ✅
- **Anthropic** ✅
- **Vertex AI** ✅

All providers that return usage data in their responses will have token metrics tracked automatically.

## Testing Token Metrics

To see token metrics in action:

1. Start the Constellation server
2. Use an AI-powered librarian (e.g., joke-teller)
3. Check the metrics endpoint:
   ```bash
   curl http://localhost:9090/metrics | grep constellation_ai_tokens_total
   ```

## Dashboard Integration

Both Grafana dashboards include AI token usage panels that:
- Show token usage over time
- Break down by provider and token type
- Help track AI costs and usage patterns

The enterprise dashboard additionally provides:
- Token usage rate calculations
- Cost estimation (when configured with pricing)
- Usage alerts and thresholds
