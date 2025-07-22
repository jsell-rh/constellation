/**
 * Platform Team Librarian Example
 * 
 * This shows a more sophisticated librarian with:
 * - Multiple data sources
 * - Delegation capabilities
 * - Error handling
 * - Confidence scoring
 */

import { 
  Librarian, 
  Context, 
  Response, 
  Source 
} from '../../interfaces/librarian';

// Data source interfaces
interface JenkinsJob {
  name: string;
  lastBuild: {
    number: number;
    status: string;
    timestamp: number;
  };
  url: string;
}

interface ArgoCDApp {
  name: string;
  status: string;
  syncStatus: string;
  namespace: string;
}

interface K8sResource {
  kind: string;
  name: string;
  namespace: string;
  status: any;
}

/**
 * Search Jenkins for build/deployment information
 */
async function searchJenkins(query: string): Promise<{
  results: JenkinsJob[];
  error?: string;
}> {
  try {
    // In production, this would call the Jenkins API
    console.log(`Searching Jenkins for: ${query}`);
    
    // Mock results
    return {
      results: [
        {
          name: 'app-deployment-pipeline',
          lastBuild: {
            number: 42,
            status: 'SUCCESS',
            timestamp: Date.now() - 3600000
          },
          url: 'https://jenkins.redhat.com/job/app-deployment-pipeline'
        }
      ]
    };
  } catch (error) {
    return { results: [], error: error.message };
  }
}

/**
 * Search ArgoCD for GitOps deployments
 */
async function searchArgoCD(query: string): Promise<{
  results: ArgoCDApp[];
  error?: string;
}> {
  try {
    console.log(`Searching ArgoCD for: ${query}`);
    
    return {
      results: [
        {
          name: 'production-app',
          status: 'Healthy',
          syncStatus: 'Synced',
          namespace: 'production'
        }
      ]
    };
  } catch (error) {
    return { results: [], error: error.message };
  }
}

/**
 * Search Kubernetes for resources
 */
async function searchKubernetes(query: string): Promise<{
  results: K8sResource[];
  error?: string;
}> {
  try {
    console.log(`Searching Kubernetes for: ${query}`);
    
    return {
      results: [
        {
          kind: 'Deployment',
          name: 'my-app',
          namespace: 'default',
          status: {
            replicas: 3,
            readyReplicas: 3
          }
        }
      ]
    };
  } catch (error) {
    return { results: [], error: error.message };
  }
}

/**
 * Calculate confidence based on data availability
 */
function calculateConfidence(
  jenkinsData: any,
  argoData: any,
  k8sData: any,
  query: string
): number {
  let confidence = 0.3; // Base confidence
  
  // Add confidence for each data source with results
  if (jenkinsData.results.length > 0) confidence += 0.2;
  if (argoData.results.length > 0) confidence += 0.2;
  if (k8sData.results.length > 0) confidence += 0.2;
  
  // Add confidence for query specificity
  if (query.includes('deploy') || query.includes('kubernetes')) {
    confidence += 0.1;
  }
  
  return Math.min(confidence, 1.0);
}

/**
 * Platform Team Librarian
 */
export const platformTeamLibrarian: Librarian = async (
  query: string,
  context?: Context
): Promise<Response> => {
  console.log(`Platform team received query: ${query}`);
  
  try {
    // Step 1: Search all data sources in parallel
    const [jenkinsData, argoData, k8sData] = await Promise.all([
      searchJenkins(query),
      searchArgoCD(query),
      searchKubernetes(query)
    ]);
    
    // Step 2: Compile sources
    const sources: Source[] = [];
    
    if (jenkinsData.results.length > 0) {
      sources.push({
        name: 'Jenkins CI/CD',
        type: 'api',
        url: 'https://jenkins.redhat.com'
      });
    }
    
    if (argoData.results.length > 0) {
      sources.push({
        name: 'ArgoCD GitOps',
        type: 'api',
        url: 'https://argo.redhat.com'
      });
    }
    
    if (k8sData.results.length > 0) {
      sources.push({
        name: 'Kubernetes',
        type: 'api',
        url: 'https://k8s.redhat.com'
      });
    }
    
    // Step 3: Calculate confidence
    const confidence = calculateConfidence(
      jenkinsData,
      argoData,
      k8sData,
      query
    );
    
    // Step 4: Check if we should delegate
    if (confidence < 0.6 && context?.availableDelegates) {
      // Look for more specific experts
      const k8sExpert = context.availableDelegates.find(
        d => d.id === 'k8s-expert'
      );
      
      if (k8sExpert && query.toLowerCase().includes('kubernetes')) {
        return {
          delegate: {
            to: 'k8s-expert',
            query: query,
            context: {
              reason: 'Low confidence, delegating to Kubernetes expert'
            }
          }
        };
      }
    }
    
    // Step 5: Generate answer with AI
    if (context?.ai) {
      const dataContext = {
        jenkins: jenkinsData.results,
        argocd: argoData.results,
        kubernetes: k8sData.results
      };
      
      const prompt = `
You are the Platform Engineering team expert. You help with Kubernetes, OpenShift, CI/CD, and infrastructure.

User Query: ${query}

Available Data:
- Jenkins Jobs: ${JSON.stringify(dataContext.jenkins, null, 2)}
- ArgoCD Applications: ${JSON.stringify(dataContext.argocd, null, 2)}
- Kubernetes Resources: ${JSON.stringify(dataContext.kubernetes, null, 2)}

Platform Context:
- We use GitOps with ArgoCD for all deployments
- Jenkins handles CI/CD pipelines
- Production runs on OpenShift 4.13
- We follow trunk-based development

Please provide a helpful, specific answer incorporating the available data and our platform practices.
      `.trim();
      
      const answer = await context.ai.complete(prompt);
      
      return {
        answer,
        sources,
        confidence,
        metadata: {
          dataSourcesQueried: ['jenkins', 'argocd', 'kubernetes'],
          platformVersion: 'openshift-4.13'
        }
      };
    }
    
    // Step 6: Fallback response without AI
    const hasData = sources.length > 0;
    
    return {
      answer: hasData
        ? `Found relevant information in ${sources.length} platform systems. Based on the data:\n` +
          `- Jenkins: ${jenkinsData.results.length} relevant jobs\n` +
          `- ArgoCD: ${argoData.results.length} applications\n` +
          `- Kubernetes: ${k8sData.results.length} resources\n` +
          `Please check the sources for details.`
        : 'No specific platform data found for your query. Try being more specific or contact the platform team.',
      sources,
      confidence,
      partial: !context?.ai // Partial answer without AI
    };
    
  } catch (error) {
    console.error('Platform librarian error:', error);
    
    // Check if error is recoverable
    const isTimeout = error.message.includes('timeout');
    const isConnectionError = error.message.includes('ECONNREFUSED');
    
    return {
      error: {
        code: isTimeout ? 'TIMEOUT' : 'PLATFORM_ERROR',
        message: error.message,
        librarian: 'platform-team',
        query,
        recoverable: isTimeout || isConnectionError,
        suggestion: isTimeout
          ? 'The platform systems are slow. Try again in a moment.'
          : 'Check platform status at https://status.redhat.com'
      }
    };
  }
};

/**
 * Example usage
 */
if (require.main === module) {
  const mockContext: Context = {
    librarian: {
      id: 'platform-team',
      name: 'Platform Engineering',
      description: 'Kubernetes, CI/CD, Infrastructure',
      capabilities: [
        'kubernetes.operations',
        'cicd.jenkins',
        'gitops.argocd'
      ]
    },
    ai: {
      complete: async (prompt: string) => {
        // Mock AI response
        return `To deploy your application on Kubernetes:

1. **Ensure your Jenkins pipeline is configured**: The 'app-deployment-pipeline' job shows successful builds.

2. **Verify ArgoCD sync**: Your 'production-app' is currently Healthy and Synced in the production namespace.

3. **Check Kubernetes deployment**: The deployment 'my-app' has 3/3 replicas ready.

Everything looks good for deployment. Use 'kubectl apply' or trigger the Jenkins job to deploy changes.`;
      },
      analyze: async (text: string, schema: any) => ({ analyzed: true })
    },
    availableDelegates: [
      {
        id: 'k8s-expert',
        name: 'Kubernetes Expert',
        description: 'Deep Kubernetes knowledge',
        capabilities: ['kubernetes.internals'],
        endpoint: 'https://k8s-expert.redhat.com'
      }
    ]
  };
  
  // Test the librarian
  platformTeamLibrarian('How do I deploy my app to Kubernetes?', mockContext)
    .then(response => {
      console.log('\nPlatform Team Response:');
      console.log(JSON.stringify(response, null, 2));
    });
}