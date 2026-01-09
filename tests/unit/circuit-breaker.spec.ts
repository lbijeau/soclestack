import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  _EmailCircuitBreaker as EmailCircuitBreaker,
  _resetCircuitBreaker,
} from '@/lib/email/circuit-breaker';

describe('EmailCircuitBreaker', () => {
  let breaker: EmailCircuitBreaker;

  beforeEach(() => {
    _resetCircuitBreaker();
    breaker = new EmailCircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      successThreshold: 2,
    });
  });

  describe('initial state', () => {
    it('starts in CLOSED state', () => {
      const state = breaker.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failures).toBe(0);
      expect(state.successes).toBe(0);
    });

    it('allows requests when closed', () => {
      expect(breaker.canExecute()).toBe(true);
    });
  });

  describe('CLOSED -> OPEN transition', () => {
    it('opens circuit after failure threshold', () => {
      // Record failures up to threshold
      breaker.recordFailure();
      expect(breaker.getState().state).toBe('CLOSED');
      breaker.recordFailure();
      expect(breaker.getState().state).toBe('CLOSED');
      breaker.recordFailure(); // 3rd failure = threshold

      expect(breaker.getState().state).toBe('OPEN');
      expect(breaker.canExecute()).toBe(false);
    });

    it('resets failure count on success in closed state', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState().failures).toBe(2);

      breaker.recordSuccess();
      expect(breaker.getState().failures).toBe(0);

      // Now it takes 3 more failures to open
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState().state).toBe('CLOSED');
    });
  });

  describe('OPEN state', () => {
    beforeEach(() => {
      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
    });

    it('rejects requests when open', () => {
      expect(breaker.canExecute()).toBe(false);
    });

    it('transitions to HALF_OPEN after reset timeout', async () => {
      // Wait for reset timeout
      await new Promise((r) => setTimeout(r, 1100));

      // Check state - should transition to HALF_OPEN on canExecute
      expect(breaker.canExecute()).toBe(true);
      expect(breaker.getState().state).toBe('HALF_OPEN');
    });
  });

  describe('HALF_OPEN state', () => {
    beforeEach(async () => {
      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      // Wait for reset timeout to go to half-open
      await new Promise((r) => setTimeout(r, 1100));
      breaker.canExecute(); // Trigger transition
    });

    it('allows requests in half-open state', () => {
      expect(breaker.getState().state).toBe('HALF_OPEN');
      expect(breaker.canExecute()).toBe(true);
    });

    it('closes circuit after success threshold', () => {
      breaker.recordSuccess();
      expect(breaker.getState().state).toBe('HALF_OPEN');

      breaker.recordSuccess(); // 2nd success = threshold
      expect(breaker.getState().state).toBe('CLOSED');
    });

    it('re-opens circuit on failure', () => {
      breaker.recordFailure();
      expect(breaker.getState().state).toBe('OPEN');
    });
  });

  describe('reset', () => {
    it('resets circuit to initial state', () => {
      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState().state).toBe('OPEN');

      breaker.reset();

      const state = breaker.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failures).toBe(0);
      expect(state.successes).toBe(0);
      expect(breaker.canExecute()).toBe(true);
    });
  });

  describe('state tracking', () => {
    it('tracks lastFailureTime', () => {
      const before = Date.now();
      breaker.recordFailure();
      const after = Date.now();

      const state = breaker.getState();
      expect(state.lastFailureTime).toBeGreaterThanOrEqual(before);
      expect(state.lastFailureTime).toBeLessThanOrEqual(after);
    });

    it('tracks lastStateChange', async () => {
      const initialChange = breaker.getState().lastStateChange;

      // Open circuit
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      const openChange = breaker.getState().lastStateChange;
      expect(openChange).toBeGreaterThanOrEqual(initialChange);
    });
  });
});
