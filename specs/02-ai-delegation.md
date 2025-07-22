# Specification: AI-Driven Delegation

## Overview

This specification defines how AI-driven delegation works in Constellation. The AI engine analyzes queries and makes intelligent routing decisions without hardcoded logic.

## Core Principles

1. **Intelligence over Configuration**: AI understands queries and capabilities
2. **Dynamic Adaptation**: Works with new librarians without code changes
3. **Multi-Expert Coordination**: Can split queries across domains
4. **Confidence-Based Decisions**: Routes based on expected improvement

## AI Delegation Flow

```
1. Query Analysis
   └─→ Extract intent, domains, complexity
   
2. Capability Matching
   └─→ Match requirements to available librarians
   
3. Routing Decision
   └─→ Single, multiple, or no delegation
   
4. Query Refinement
   └─→ Optimize query for each delegate
   
5. Response Aggregation
   └─→ Merge multiple responses intelligently
```

## Query Analysis

### Input
- Query string from user
- Available librarians with capabilities
- Current context

### Analysis Output

```typescript
interface QueryAnalysis {
  intent: string;                    // What user wants
  domains: string[];                 // Areas involved
  complexity: 'simple' | 'moderate' | 'complex';
  isMultiDomain: boolean;
  urgency: 'normal' | 'high' | 'critical';
  suggestedLibrarians: SuggestedLibrarian[];
  keywords: string[];
  analysisConfidence: number;
}
```

### Example Analysis

Query: "How do I secure my Node.js API deployment on OpenShift?"

```json
{
  "intent": "Learn security best practices for Node.js API on OpenShift",
  "domains": ["security", "nodejs", "openshift", "deployment"],
  "complexity": "complex",
  "isMultiDomain": true,
  "urgency": "normal",
  "suggestedLibrarians": [
    {
      "id": "security-team",
      "relevanceScore": 0.9,
      "reason": "Security expertise needed"
    },
    {
      "id": "platform-team",
      "relevanceScore": 0.8,
      "reason": "OpenShift deployment knowledge"
    },
    {
      "id": "nodejs-team",
      "relevanceScore": 0.85,
      "reason": "Node.js specific practices"
    }
  ],
  "keywords": ["secure", "nodejs", "api", "deployment", "openshift"],
  "analysisConfidence": 0.92
}
```

## Delegation Decision Making

### Decision Factors

1. **Current Confidence**: How well can current librarian answer?
2. **Available Expertise**: What specialists are available?
3. **Query Complexity**: Does it need multiple perspectives?
4. **Performance**: Response time vs. quality trade-off

### Decision Output

```typescript
interface DelegationDecision {
  shouldDelegate: boolean;
  reasoning: string;
  strategy: 'none' | 'single' | 'multiple' | 'broadcast';
  suggestedDelegates: string[];
  refinedQueries?: Record<string, string>;
  expectedImprovement?: number;
}
```

### Decision Strategies

#### 1. No Delegation
```typescript
{
  shouldDelegate: false,
  reasoning: "Current librarian has high confidence (0.9) and all necessary data",
  strategy: 'none'
}
```

#### 2. Single Delegation
```typescript
{
  shouldDelegate: true,
  reasoning: "Kubernetes expert can provide deeper insights",
  strategy: 'single',
  suggestedDelegates: ['k8s-expert'],
  expectedImprovement: 0.3
}
```

#### 3. Multiple Delegation
```typescript
{
  shouldDelegate: true,
  reasoning: "Query spans security, platform, and application domains",
  strategy: 'multiple',
  suggestedDelegates: ['security-team', 'platform-team', 'nodejs-team'],
  refinedQueries: {
    'security-team': "API security best practices for Node.js",
    'platform-team': "OpenShift deployment security configuration",
    'nodejs-team': "Node.js API security patterns and libraries"
  },
  expectedImprovement: 0.5
}
```

#### 4. Broadcast Delegation
```typescript
{
  shouldDelegate: true,
  reasoning: "Critical incident requires all hands",
  strategy: 'broadcast',
  suggestedDelegates: ['platform-oncall', 'security-oncall', 'sre-team']
}
```

## Query Refinement

### Purpose
Optimize queries for specific delegates to get better answers

### Refinement Strategies

1. **Domain Focus**: Extract domain-specific parts
2. **Context Addition**: Add relevant context
3. **Simplification**: Remove irrelevant parts
4. **Expertise Targeting**: Use domain terminology

### Examples

Original: "How do I secure my Node.js API deployment on OpenShift?"

Refined for security-team:
"What are the security best practices for authenticating and authorizing API requests in Node.js?"

Refined for platform-team:
"How do I configure OpenShift security policies and network policies for a Node.js API?"

Refined for nodejs-team:
"Which Node.js security libraries and patterns should I use for API authentication and input validation?"

## Response Aggregation

### Aggregation Strategies

1. **Sequential**: Combine in order of importance
2. **Sectioned**: Organize by topic/domain
3. **Merged**: Intelligently blend overlapping content
4. **Voted**: Use consensus for conflicting info

### Example Aggregation

Multiple responses about Node.js security:

```typescript
const aggregatedResponse = {
  answer: `
# Securing Node.js APIs on OpenShift

## Authentication & Authorization (Security Team)
- Use OAuth2 with JWT tokens
- Implement rate limiting
- Enable MFA for sensitive operations

## OpenShift Configuration (Platform Team)  
- Configure network policies
- Use OpenShift secrets for credentials
- Enable pod security policies

## Node.js Best Practices (Node.js Team)
- Use helmet.js for security headers
- Implement input validation with joi
- Use bcrypt for password hashing

## Summary
Combine OpenShift platform security with Node.js application security for defense in depth.
  `,
  sources: [
    ...securitySources,
    ...platformSources,
    ...nodejsSources
  ],
  confidence: 0.95, // High due to multiple expert inputs
  metadata: {
    aggregationStrategy: 'sectioned',
    contributingLibrarians: ['security-team', 'platform-team', 'nodejs-team']
  }
};
```

## AI Implementation Requirements

### Required Capabilities

1. **Natural Language Understanding**
   - Intent extraction
   - Domain classification
   - Named entity recognition

2. **Semantic Matching**
   - Capability to query matching
   - Similarity scoring
   - Contextual understanding

3. **Structured Output**
   - JSON response generation
   - Schema compliance
   - Consistent formatting

### AI Prompts

#### Query Analysis Prompt
```typescript
const analysisPrompt = `
Analyze this query and identify the intent, domains, and complexity.

Query: "${query}"

Consider:
- What is the user trying to accomplish?
- Which technical domains are involved?
- How complex is this query?
- Would multiple experts provide better insight?

Respond with JSON matching the QueryAnalysis schema.
`;
```

#### Delegation Decision Prompt
```typescript
const decisionPrompt = `
Should this query be delegated to specialists?

Query: "${query}"
Current librarian: ${currentLibrarian.name}
Current capabilities: ${currentLibrarian.capabilities.join(', ')}
Current confidence: ${currentConfidence}

Available specialists:
${availableLibrarians.map(lib => 
  `- ${lib.name}: ${lib.capabilities.join(', ')}`
).join('\n')}

Consider:
- Can the current librarian answer adequately?
- Would specialists provide significantly better answers?
- Is this a multi-domain query?
- What's the performance vs quality trade-off?

Respond with JSON matching the DelegationDecision schema.
`;
```

## Performance Considerations

### Caching

1. **Query Analysis Cache**: Cache analysis for similar queries
2. **Routing Decision Cache**: Cache routing patterns
3. **Capability Cache**: Cache librarian capability matches

### Optimization

1. **Parallel Analysis**: Analyze while fetching data
2. **Early Termination**: Stop if confidence is high
3. **Batching**: Batch similar queries

### Timeouts

```typescript
const AI_TIMEOUTS = {
  queryAnalysis: 2000,      // 2 seconds
  delegationDecision: 1000, // 1 second  
  responseAggregation: 3000 // 3 seconds
};
```

## Monitoring and Learning

### Metrics to Track

1. **Delegation Success Rate**: How often delegation improves answers
2. **Routing Accuracy**: How often AI picks the right librarian
3. **Response Quality**: User satisfaction with aggregated answers
4. **Performance Impact**: Latency added by AI decisions

### Learning Feedback

```typescript
interface DelegationFeedback {
  query: string;
  delegatedTo: string[];
  improvementScore: number; // -1 to 1
  userSatisfaction?: number;
  metadata?: Record<string, any>;
}

// Store feedback for model improvement
async function recordDelegationFeedback(feedback: DelegationFeedback) {
  // Use for:
  // 1. Routing model fine-tuning
  // 2. Capability matching improvement
  // 3. Query refinement optimization
}
```

## Error Handling

### AI Failure Modes

1. **Analysis Failure**: Fall back to keyword matching
2. **Timeout**: Use cached routing decisions
3. **Invalid Output**: Use simple routing rules
4. **Model Unavailable**: Delegate to default librarian

### Graceful Degradation

```typescript
async function analyzeQueryWithFallback(
  query: string,
  librarians: LibrarianInfo[]
): Promise<QueryAnalysis> {
  try {
    // Try AI analysis
    return await ai.analyzeQuery(query, librarians);
  } catch (error) {
    // Fall back to keyword matching
    return keywordBasedAnalysis(query, librarians);
  }
}

function keywordBasedAnalysis(
  query: string,
  librarians: LibrarianInfo[]
): QueryAnalysis {
  const keywords = extractKeywords(query);
  const domains = matchKeywordsToDomains(keywords);
  
  return {
    intent: 'Extracted from keywords',
    domains,
    complexity: 'simple',
    isMultiDomain: domains.length > 1,
    urgency: detectUrgency(keywords),
    suggestedLibrarians: matchLibrariansByKeywords(keywords, librarians),
    keywords,
    analysisConfidence: 0.5
  };
}
```

## Security Considerations

1. **Prompt Injection**: Sanitize queries before AI analysis
2. **Information Leakage**: Don't expose sensitive data in prompts
3. **Resource Limits**: Prevent AI resource exhaustion
4. **Access Control**: Respect user permissions in routing

## Testing Requirements

### Unit Tests

1. Query analysis with various query types
2. Delegation decisions for different scenarios
3. Query refinement accuracy
4. Response aggregation quality

### Integration Tests

1. End-to-end delegation flow
2. Multi-librarian coordination
3. Error recovery scenarios
4. Performance under load

### Example Test

```typescript
describe('AI Delegation', () => {
  it('routes multi-domain queries correctly', async () => {
    const query = "How do I secure my Node.js API on OpenShift?";
    const analysis = await aiEngine.analyzeQuery(query, librarians);
    
    expect(analysis.isMultiDomain).toBe(true);
    expect(analysis.domains).toContain('security');
    expect(analysis.domains).toContain('nodejs');
    expect(analysis.domains).toContain('openshift');
  });
  
  it('refines queries for specific domains', async () => {
    const refinements = await aiEngine.refineQuery(
      query,
      ['security-team', 'platform-team']
    );
    
    expect(refinements['security-team']).toContain('security');
    expect(refinements['platform-team']).toContain('OpenShift');
  });
});
```