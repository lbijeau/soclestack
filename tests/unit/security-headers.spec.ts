import { describe, it, expect } from 'vitest';
import { buildCSP, securityHeaders } from '@/lib/security-headers';

describe('buildCSP', () => {
  it('should include nonce in script-src', () => {
    const csp = buildCSP('test-nonce-123', false);
    expect(csp).toContain("'nonce-test-nonce-123'");
  });

  it('should include self in script-src', () => {
    const csp = buildCSP('test', false);
    expect(csp).toContain("script-src 'self'");
  });

  it('should NOT include unsafe-eval in production mode', () => {
    const csp = buildCSP('test', false);
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('should include unsafe-eval in development mode', () => {
    const csp = buildCSP('test', true);
    expect(csp).toContain("'unsafe-eval'");
  });

  it('should NOT include unsafe-inline in script-src', () => {
    const cspProd = buildCSP('test', false);
    const cspDev = buildCSP('test', true);

    // Extract script-src portion
    const scriptSrcProd = cspProd.match(/script-src\s+([^;]+)/)?.[1] || '';
    const scriptSrcDev = cspDev.match(/script-src\s+([^;]+)/)?.[1] || '';

    expect(scriptSrcProd).not.toContain("'unsafe-inline'");
    expect(scriptSrcDev).not.toContain("'unsafe-inline'");
  });

  it('should include all required CSP directives', () => {
    const csp = buildCSP('test', false);

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('should use semicolon as directive separator', () => {
    const csp = buildCSP('test', false);
    const directives = csp.split('; ');

    expect(directives.length).toBeGreaterThan(5);
  });

  it('should handle empty nonce gracefully', () => {
    const csp = buildCSP('', false);
    expect(csp).toContain("'nonce-'");
  });

  it('should handle base64 characters in nonce', () => {
    const base64Nonce = 'YWJjZGVm+/123=';
    const csp = buildCSP(base64Nonce, false);
    expect(csp).toContain(`'nonce-${base64Nonce}'`);
  });
});

describe('securityHeaders', () => {
  it('should include X-Frame-Options set to DENY', () => {
    expect(securityHeaders['X-Frame-Options']).toBe('DENY');
  });

  it('should include X-Content-Type-Options set to nosniff', () => {
    expect(securityHeaders['X-Content-Type-Options']).toBe('nosniff');
  });

  it('should include Referrer-Policy', () => {
    expect(securityHeaders['Referrer-Policy']).toBe('origin-when-cross-origin');
  });

  it('should include HSTS header', () => {
    expect(securityHeaders['Strict-Transport-Security']).toContain(
      'max-age=31536000'
    );
  });
});
