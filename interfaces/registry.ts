/**
 * Registry Interfaces
 * 
 * Defines the structure of the service registry that enables
 * dynamic discovery of librarians.
 */

/**
 * Main registry structure containing all librarians
 */
export interface Registry {
  metadata: RegistryMetadata;
  librarians: RegistryEntry[];
  config?: RegistryConfig;
}

/**
 * Registry metadata
 */
export interface RegistryMetadata {
  version: string;
  lastUpdated: string;
  description: string;
}

/**
 * Individual librarian registration
 */
export interface RegistryEntry {
  // Unique identifier
  id: string;
  
  // Human-readable name
  name: string;
  
  // Description of what this librarian does
  description: string;
  
  // HTTP endpoint for the librarian
  endpoint: string;
  
  // Librarian type
  type?: 'router' | 'specialist' | 'expert' | 'emergency' | 'location';
  
  // Owning team
  team?: string;
  
  // Parent librarian for hierarchy
  parent?: string;
  
  // Capabilities in hierarchical format
  capabilities: string[];
  
  // Data sources this librarian uses
  data_sources?: DataSource[];
  
  // Who this librarian can delegate to
  delegates_to?: string[];
  
  // Resilience configuration
  resilience?: ResilienceConfig;
  
  // Service level agreement
  sla?: SLA;
  
  // Additional context
  context?: Record<string, any>;
  
  // Activation conditions
  activation?: ActivationConfig;
}

/**
 * Data source configuration
 */
export interface DataSource {
  name: string;
  type: 'api' | 'database' | 'filesystem' | 'documentation' | 'cache';
  url?: string;
  config?: Record<string, any>;
  refresh_rate?: string;
}

/**
 * Resilience configuration
 */
export interface ResilienceConfig {
  circuit_breaker?: CircuitBreakerConfig;
  retry?: RetryConfig;
  timeout_ms?: number;
  fallback?: FallbackStrategy[];
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  enabled?: boolean;
  error_threshold_percent: number;
  volume_threshold?: number;
  timeout_ms: number;
  reset_timeout_ms: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  enabled?: boolean;
  max_attempts: number;
  backoff_ms?: number;
  backoff_multiplier?: number;
}

/**
 * Fallback strategy
 */
export interface FallbackStrategy {
  type: 'cache' | 'delegate' | 'static' | 'partial';
  config?: {
    ttl_minutes?: number;
    to?: string;
    response?: string;
  };
}

/**
 * Service Level Agreement
 */
export interface SLA {
  response_time_ms?: number;
  availability?: number;
  throughput_rps?: number;
}

/**
 * Activation configuration for conditional librarians
 */
export interface ActivationConfig {
  keywords?: string[];
  priority?: 'normal' | 'high' | 'critical';
  auto_escalate?: boolean;
}

/**
 * Registry configuration
 */
export interface RegistryConfig {
  refresh_interval_minutes?: number;
  default_timeout_ms?: number;
  max_delegation_depth?: number;
  routing_ai_model?: string;
  fallback_on_error?: string;
  health_check?: HealthCheckConfig;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  enabled: boolean;
  interval_minutes: number;
  timeout_ms: number;
  endpoint?: string;
}