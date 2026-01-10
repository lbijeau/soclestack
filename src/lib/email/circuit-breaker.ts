/**
 * Circuit breaker for email provider.
 *
 * States:
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Failures exceeded threshold, requests rejected immediately
 * - HALF_OPEN: Testing recovery, limited requests allowed
 *
 * Transitions:
 * - CLOSED -> OPEN: After failureThreshold consecutive failures
 * - OPEN -> HALF_OPEN: After resetTimeout expires
 * - HALF_OPEN -> CLOSED: On successful request
 * - HALF_OPEN -> OPEN: On failed request
 */

import log from '@/lib/logger';
import { SECURITY_CONFIG } from '@/lib/config/security';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before attempting recovery (OPEN -> HALF_OPEN) */
  resetTimeoutMs: number;
  /** Number of successful requests needed in HALF_OPEN to close */
  successThreshold: number;
  /** Max concurrent requests allowed in HALF_OPEN state */
  halfOpenMaxRequests: number;
}

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  halfOpenRequests: number;
  lastFailureTime: number | null;
  lastStateChange: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60_000, // 60 seconds - give provider time to recover
  successThreshold: 2,
  halfOpenMaxRequests: 1, // Only allow 1 probe request at a time
};

/**
 * In-memory circuit breaker for email provider.
 * For single-instance deployments.
 */
class EmailCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private halfOpenRequests = 0; // Track in-flight requests in HALF_OPEN
  private lastFailureTime: number | null = null;
  private lastStateChange: number = Date.now();
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a request should be allowed through.
   * Returns true if allowed, false if circuit is open.
   * In HALF_OPEN state, limits concurrent requests to prevent flooding.
   */
  canExecute(): boolean {
    this.checkStateTransition();

    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'HALF_OPEN') {
      // Limit concurrent requests in half-open state
      if (this.halfOpenRequests >= this.config.halfOpenMaxRequests) {
        return false;
      }
      this.halfOpenRequests++;
      return true;
    }

    // OPEN state - reject request
    return false;
  }

  /**
   * Record a successful operation.
   */
  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.halfOpenRequests = Math.max(0, this.halfOpenRequests - 1);
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo('CLOSED');
        this.failures = 0;
        this.successes = 0;
        this.halfOpenRequests = 0;
        log.info('[CircuitBreaker] Circuit closed - provider recovered');
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success in closed state
      this.failures = 0;
    }
  }

  /**
   * Record a failed operation.
   */
  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // Any failure in half-open goes back to open
      this.halfOpenRequests = 0;
      this.transitionTo('OPEN');
      this.successes = 0;
      log.warn('[CircuitBreaker] Circuit re-opened - recovery failed');
    } else if (
      this.state === 'CLOSED' &&
      this.failures >= this.config.failureThreshold
    ) {
      this.transitionTo('OPEN');
      log.warn(
        `[CircuitBreaker] Circuit opened after ${this.failures} consecutive failures`
      );
    }
  }

  /**
   * Get current circuit state for monitoring.
   */
  getState(): CircuitBreakerState {
    this.checkStateTransition();
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      halfOpenRequests: this.halfOpenRequests,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
    };
  }

  /**
   * Force reset the circuit breaker (for admin/testing).
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.halfOpenRequests = 0;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
    log.info('[CircuitBreaker] Circuit manually reset');
  }

  /**
   * Check and perform automatic state transitions.
   */
  private checkStateTransition(): void {
    if (this.state === 'OPEN' && this.lastFailureTime) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.config.resetTimeoutMs) {
        this.transitionTo('HALF_OPEN');
        this.successes = 0;
        log.info('[CircuitBreaker] Circuit half-open - testing recovery');
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState;
    this.lastStateChange = Date.now();
  }
}

// Singleton instance with config from security settings
let instance: EmailCircuitBreaker | null = null;

export function getEmailCircuitBreaker(): EmailCircuitBreaker {
  if (!instance) {
    const config = SECURITY_CONFIG.circuitBreaker;
    instance = new EmailCircuitBreaker(config);
  }
  return instance;
}

/**
 * Reset the singleton for testing purposes.
 * @internal
 */
export function _resetCircuitBreaker(): void {
  instance = null;
}

/**
 * Export class for testing.
 * @internal
 */
export { EmailCircuitBreaker as _EmailCircuitBreaker };
