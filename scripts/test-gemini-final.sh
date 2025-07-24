#!/bin/bash
# Final comprehensive test of Gemini integration

echo "🧪 Final Gemini Integration Test"
echo "================================"
echo

# Test 1: Simple query
echo "Test 1: Simple Query"
echo "-------------------"
curl -s -X POST http://localhost:3335/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "query",
      "arguments": {
        "query": "Hello, how are you?",
        "user": {
          "id": "test-user",
          "teams": ["platform"],
          "roles": ["developer"]
        }
      }
    },
    "id": "test-simple"
  }' | grep -o '"text":"[^"]*"' | cut -d'"' -f4 | head -c 100
echo
echo

# Test 2: Code review query
echo "Test 2: Code Review Query"
echo "------------------------"
curl -s -X POST http://localhost:3335/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "query",
      "arguments": {
        "query": "Review this code for security: def get_user(id): query = \"SELECT * FROM users WHERE id = \" + id; return db.execute(query)",
        "user": {
          "id": "test-user",
          "teams": ["engineering"],
          "roles": ["developer"]
        }
      }
    },
    "id": "test-code-review"
  }' | grep -o '"text":"[^"]*"' | cut -d'"' -f4 | head -c 200
echo
echo

# Test 3: Direct librarian query
echo "Test 3: Direct Librarian Query"
echo "-----------------------------"
curl -s -X POST http://localhost:3335/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "query_librarian",
      "arguments": {
        "librarian_id": "code-reviewer",
        "query": "def add(a,b): return a+b"
      }
    },
    "id": "test-direct"
  }' | grep -o '"text":"[^"]*"' | cut -d'"' -f4 | head -c 200
echo
echo

echo "✅ All tests completed!"
