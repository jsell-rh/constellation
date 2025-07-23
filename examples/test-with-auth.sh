#!/bin/bash
# Example: How to make requests with authentication context

# Query with user context (will have access based on teams/roles)
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I deploy to Kubernetes?",
    "context": {
      "user": {
        "id": "test-user",
        "teams": ["platform", "engineering", "sre"],
        "roles": ["developer"]
      }
    }
  }' | jq .

# Query without user context (only access to public librarians)
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Hello"
  }' | jq .
