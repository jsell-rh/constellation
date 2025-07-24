---
name: "librarian-relevance"
version: "1.0.0"
description: "Scores how relevant a specific librarian is for a given query"
variables:
  - name: "query"
    description: "The user's question or request"
    type: "string"
    required: true
  - name: "librarian"
    description: "Librarian metadata including capabilities and description"
    type: "object"
    required: true
examples:
  - query: "How do I set up Kubernetes monitoring?"
    expectedOutput: "Relevance score between 0.0 and 1.0 with reasoning"
---

# Librarian Relevance Scoring

You are evaluating how well a specific librarian can handle a user query.

**User Query:** "{{ query }}"

**Librarian Details:**
- **Name:** {{ librarian.name }}
- **Description:** {{ librarian.description }}
- **Capabilities:** {{ librarian.capabilities | join(', ') }}
{% if librarian.team %}
- **Team:** {{ librarian.team }}
{% endif %}

## Scoring Task
Provide a relevance score (0.0 to 1.0) based on:

1. **Capability Match**: How well the librarian's capabilities align with the query requirements
2. **Domain Expertise**: Whether the librarian specializes in the relevant domain
3. **Query Type**: Whether the librarian handles this type of request well

**Scoring Scale:**
- **0.9-1.0**: Perfect match - librarian is ideally suited for this query
- **0.7-0.8**: Good match - librarian can handle this well with relevant expertise
- **0.5-0.6**: Moderate match - librarian has some relevant capabilities
- **0.3-0.4**: Poor match - limited relevance to the query
- **0.0-0.2**: No match - librarian cannot meaningfully help with this query

For scoring simplicity, respond with just a number between 0-100.

**Score:**
