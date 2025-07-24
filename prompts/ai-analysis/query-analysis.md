---
name: "query-analysis"
version: "1.0.0"
description: "Analyzes user queries to determine intent and required capabilities"
variables:
  - name: "query"
    description: "The user's question or request"
    type: "string"
    required: true
examples:
  - query: "help me deploy to kubernetes"
    expectedOutput: '{"intent": "Deploy application to Kubernetes", "capabilities": ["kubernetes.deployment", "devops.operations"]}'
---

# Query Intent and Capability Analysis

Analyze this query and determine:
1. The user's intent (what they want to accomplish)
2. Required capabilities to answer this query (as dot-separated paths like "kubernetes.operations" or "ai.analysis")

**Query:** "{{ query }}"

Respond with ONLY valid JSON, no other text:
```json
{
  "intent": "brief description of what user wants",
  "capabilities": ["capability1", "capability2", ...]
}
```

**Examples:**
- For "help me deploy to kubernetes": `{"intent": "Deploy application to Kubernetes", "capabilities": ["kubernetes.deployment", "devops.operations"]}`
- For "review this code": `{"intent": "Code review", "capabilities": ["code.analysis", "security.review"]}`
- For "what is the capital of France": `{"intent": "General knowledge question", "capabilities": []}`

**Analysis:**
