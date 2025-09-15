import { Page, Request, Response } from '@playwright/test';
import { TestDataFactory } from './test-data-factory';

export class SecurityHelpers {
  /**
   * Test CSRF protection by attempting requests without proper tokens
   */
  static async testCSRFProtection(
    page: Page,
    endpoint: string,
    method: 'POST' | 'PUT' | 'DELETE' = 'POST',
    data: any = {}
  ): Promise<{ protected: boolean; response?: Response }> {
    try {
      const response = await page.request[method.toLowerCase()](endpoint, {
        data,
        // Intentionally omit CSRF token
      });

      return {
        protected: response.status() === 403 || response.status() === 422,
        response,
      };
    } catch (error) {
      return { protected: true };
    }
  }

  /**
   * Test rate limiting by making multiple rapid requests
   */
  static async testRateLimiting(
    page: Page,
    endpoint: string,
    maxRequests: number = 10,
    timeWindow: number = 60000
  ): Promise<{
    isRateLimited: boolean;
    requestsBeforeLimit: number;
    rateLimitResponse?: Response;
  }> {
    const startTime = Date.now();
    let requestCount = 0;
    let rateLimitResponse: Response | undefined;

    while (Date.now() - startTime < timeWindow && requestCount < maxRequests) {
      try {
        const response = await page.request.post(endpoint, {
          data: {
            email: `test${requestCount}@example.com`,
            password: 'wrongpassword',
          },
        });

        requestCount++;

        if (response.status() === 429) {
          return {
            isRateLimited: true,
            requestsBeforeLimit: requestCount - 1,
            rateLimitResponse: response,
          };
        }

        // Small delay between requests
        await page.waitForTimeout(100);
      } catch (error) {
        break;
      }
    }

    return {
      isRateLimited: false,
      requestsBeforeLimit: requestCount,
    };
  }

  /**
   * Test SQL injection vulnerabilities
   */
  static async testSQLInjection(
    page: Page,
    formSelectors: { [field: string]: string },
    submitSelector: string
  ): Promise<{
    vulnerable: boolean;
    testedPayloads: string[];
    vulnerableFields: string[];
  }> {
    const sqlPayloads = TestDataFactory.createSecurityTestData().sqlInjectionAttempts;
    const vulnerableFields: string[] = [];
    const testedPayloads: string[] = [];

    for (const payload of sqlPayloads) {
      testedPayloads.push(payload);

      for (const [fieldName, selector] of Object.entries(formSelectors)) {
        try {
          await page.fill(selector, payload);
          await page.click(submitSelector);

          // Wait for response
          await page.waitForTimeout(1000);

          // Check for database errors in response
          const content = await page.content();
          const errorPatterns = [
            /sql.*error/i,
            /mysql.*error/i,
            /postgresql.*error/i,
            /ora-\d+/i,
            /sqlstate/i,
            /syntax.*error/i,
          ];

          const hasDbError = errorPatterns.some(pattern => pattern.test(content));

          if (hasDbError) {
            vulnerableFields.push(fieldName);
          }

          // Clear the field
          await page.fill(selector, '');
        } catch (error) {
          // Ignore errors during injection testing
        }
      }
    }

    return {
      vulnerable: vulnerableFields.length > 0,
      testedPayloads,
      vulnerableFields,
    };
  }

  /**
   * Test XSS vulnerabilities
   */
  static async testXSSVulnerability(
    page: Page,
    inputSelectors: string[],
    submitSelector?: string
  ): Promise<{
    vulnerable: boolean;
    testedPayloads: string[];
    vulnerableInputs: string[];
  }> {
    const xssPayloads = TestDataFactory.createSecurityTestData().xssAttempts;
    const vulnerableInputs: string[] = [];
    const testedPayloads: string[] = [];

    // Listen for any dialogs (alerts) that might be triggered by XSS
    let alertTriggered = false;
    page.on('dialog', async dialog => {
      alertTriggered = true;
      await dialog.dismiss();
    });

    for (const payload of xssPayloads) {
      testedPayloads.push(payload);
      alertTriggered = false;

      for (const selector of inputSelectors) {
        try {
          await page.fill(selector, payload);

          if (submitSelector) {
            await page.click(submitSelector);
            await page.waitForTimeout(1000);
          }

          // Check if alert was triggered
          if (alertTriggered) {
            vulnerableInputs.push(selector);
          }

          // Check if payload appears unescaped in the page
          const content = await page.content();
          if (content.includes(payload) && !content.includes('&lt;script&gt;')) {
            vulnerableInputs.push(selector);
          }

          // Clear the input
          await page.fill(selector, '');
          alertTriggered = false;
        } catch (error) {
          // Ignore errors during XSS testing
        }
      }
    }

    return {
      vulnerable: vulnerableInputs.length > 0,
      testedPayloads,
      vulnerableInputs,
    };
  }

  /**
   * Test authentication bypass attempts
   */
  static async testAuthenticationBypass(
    page: Page,
    protectedUrl: string
  ): Promise<{
    bypassSuccessful: boolean;
    attempts: Array<{ method: string; success: boolean; statusCode?: number }>;
  }> {
    const attempts: Array<{ method: string; success: boolean; statusCode?: number }> = [];

    // Test direct URL access
    try {
      const response = await page.goto(protectedUrl);
      const success = !page.url().includes('/login') && response?.status() !== 403;
      attempts.push({
        method: 'Direct URL access',
        success,
        statusCode: response?.status(),
      });
    } catch (error) {
      attempts.push({ method: 'Direct URL access', success: false });
    }

    // Test with manipulated referrer
    try {
      await page.setExtraHTTPHeaders({ referer: protectedUrl });
      const response = await page.goto(protectedUrl);
      const success = !page.url().includes('/login') && response?.status() !== 403;
      attempts.push({
        method: 'Referrer manipulation',
        success,
        statusCode: response?.status(),
      });
    } catch (error) {
      attempts.push({ method: 'Referrer manipulation', success: false });
    }

    // Test with expired session cookies
    try {
      await page.context().addCookies([
        {
          name: 'session',
          value: 'expired_token_value',
          domain: 'localhost',
          path: '/',
          expires: Date.now() - 86400000, // Yesterday
        },
      ]);

      const response = await page.goto(protectedUrl);
      const success = !page.url().includes('/login') && response?.status() !== 403;
      attempts.push({
        method: 'Expired session',
        success,
        statusCode: response?.status(),
      });
    } catch (error) {
      attempts.push({ method: 'Expired session', success: false });
    }

    const bypassSuccessful = attempts.some(attempt => attempt.success);

    return { bypassSuccessful, attempts };
  }

  /**
   * Test session hijacking protection
   */
  static async testSessionSecurity(
    page: Page,
    loginCredentials: { email: string; password: string }
  ): Promise<{
    sessionSecure: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // First, login to get a session
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', loginCredentials.email);
    await page.fill('[data-testid="password-input"]', loginCredentials.password);
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL(/dashboard/);

    // Get session cookies
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(cookie =>
      ['session', 'token', 'auth'].some(name => cookie.name.toLowerCase().includes(name))
    );

    if (!sessionCookie) {
      issues.push('No session cookie found');
      return { sessionSecure: false, issues };
    }

    // Test cookie security attributes
    if (!sessionCookie.httpOnly) {
      issues.push('Session cookie is not HTTP-only');
    }

    if (!sessionCookie.secure && process.env.NODE_ENV === 'production') {
      issues.push('Session cookie is not marked as secure');
    }

    if (sessionCookie.sameSite !== 'Strict' && sessionCookie.sameSite !== 'Lax') {
      issues.push('Session cookie does not have proper SameSite attribute');
    }

    // Test session fixation
    const originalSessionId = sessionCookie.value;

    // Logout and login again
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', loginCredentials.email);
    await page.fill('[data-testid="password-input"]', loginCredentials.password);
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL(/dashboard/);

    const newCookies = await page.context().cookies();
    const newSessionCookie = newCookies.find(cookie => cookie.name === sessionCookie.name);

    if (newSessionCookie && newSessionCookie.value === originalSessionId) {
      issues.push('Session ID not regenerated after login (session fixation vulnerability)');
    }

    return {
      sessionSecure: issues.length === 0,
      issues,
    };
  }

  /**
   * Test file upload security
   */
  static async testFileUploadSecurity(
    page: Page,
    uploadSelector: string
  ): Promise<{
    secure: boolean;
    vulnerabilities: string[];
    testedFiles: string[];
  }> {
    const vulnerabilities: string[] = [];
    const testedFiles: string[] = [];

    const maliciousFiles = [
      { name: 'script.php', content: '<?php system($_GET["cmd"]); ?>' },
      { name: 'script.jsp', content: '<% Runtime.getRuntime().exec(request.getParameter("cmd")); %>' },
      { name: 'malware.exe', content: 'fake exe content' },
      { name: 'huge-file.txt', content: 'x'.repeat(10 * 1024 * 1024) }, // 10MB
      { name: '../../../etc/passwd', content: 'path traversal attempt' },
      { name: 'script.js', content: 'alert("XSS in filename")' },
    ];

    for (const file of maliciousFiles) {
      testedFiles.push(file.name);

      try {
        // Create a temporary file
        const buffer = Buffer.from(file.content);

        await page.setInputFiles(uploadSelector, {
          name: file.name,
          mimeType: 'text/plain',
          buffer,
        });

        // Check if upload was accepted
        await page.waitForTimeout(1000);

        // Look for success indicators
        const successIndicators = [
          '[data-testid="upload-success"]',
          '.upload-success',
          '.success-message',
        ];

        let uploadAccepted = false;
        for (const indicator of successIndicators) {
          if (await page.locator(indicator).isVisible({ timeout: 1000 })) {
            uploadAccepted = true;
            break;
          }
        }

        if (uploadAccepted) {
          if (file.name.includes('..')) {
            vulnerabilities.push('Path traversal in filename accepted');
          } else if (file.name.endsWith('.php') || file.name.endsWith('.jsp')) {
            vulnerabilities.push('Executable file upload accepted');
          } else if (file.name.endsWith('.exe')) {
            vulnerabilities.push('Binary executable upload accepted');
          } else if (file.content.length > 5 * 1024 * 1024) {
            vulnerabilities.push('Large file upload not restricted');
          }
        }
      } catch (error) {
        // Expected for security-protected uploads
      }
    }

    return {
      secure: vulnerabilities.length === 0,
      vulnerabilities,
      testedFiles,
    };
  }

  /**
   * Test HTTP security headers
   */
  static async testSecurityHeaders(page: Page, url: string): Promise<{
    secure: boolean;
    missingHeaders: string[];
    presentHeaders: string[];
    recommendations: string[];
  }> {
    const response = await page.goto(url);
    if (!response) {
      throw new Error('Failed to load page');
    }

    const headers = response.headers();
    const presentHeaders: string[] = [];
    const missingHeaders: string[] = [];
    const recommendations: string[] = [];

    const securityHeaders = {
      'content-security-policy': {
        required: true,
        description: 'Prevents XSS and other injection attacks',
      },
      'x-frame-options': {
        required: true,
        description: 'Prevents clickjacking attacks',
      },
      'x-content-type-options': {
        required: true,
        description: 'Prevents MIME type sniffing',
      },
      'strict-transport-security': {
        required: process.env.NODE_ENV === 'production',
        description: 'Enforces HTTPS connections',
      },
      'referrer-policy': {
        required: false,
        description: 'Controls referrer information',
      },
      'permissions-policy': {
        required: false,
        description: 'Controls browser feature access',
      },
    };

    for (const [headerName, config] of Object.entries(securityHeaders)) {
      if (headers[headerName]) {
        presentHeaders.push(headerName);
      } else if (config.required) {
        missingHeaders.push(headerName);
        recommendations.push(`Add ${headerName}: ${config.description}`);
      }
    }

    // Check for insecure headers
    if (headers['server']) {
      recommendations.push('Consider removing or obfuscating Server header');
    }

    if (headers['x-powered-by']) {
      recommendations.push('Remove X-Powered-By header to avoid revealing technology stack');
    }

    return {
      secure: missingHeaders.length === 0,
      missingHeaders,
      presentHeaders,
      recommendations,
    };
  }

  /**
   * Test password policy enforcement
   */
  static async testPasswordPolicy(
    page: Page,
    passwordInputSelector: string,
    submitSelector: string
  ): Promise<{
    policyEnforced: boolean;
    weakPasswordsAccepted: string[];
    strongPasswordsRejected: string[];
  }> {
    const weakPasswords = [
      '123456',
      'password',
      'qwerty',
      'abc123',
      '12345678',
      'password123',
      'admin',
      'letmein',
    ];

    const strongPasswords = [
      'ComplexPassword123!',
      'MyStr0ng@Password',
      '9$SecureP@ssw0rd',
      'Ungu3ssabl3P@ss!',
    ];

    const weakPasswordsAccepted: string[] = [];
    const strongPasswordsRejected: string[] = [];

    // Test weak passwords
    for (const password of weakPasswords) {
      try {
        await page.fill(passwordInputSelector, password);
        await page.click(submitSelector);
        await page.waitForTimeout(1000);

        // Check if password was accepted (no validation error)
        const validationError = page.locator('[data-testid*="password-validation-error"]');
        if (!(await validationError.isVisible({ timeout: 1000 }))) {
          weakPasswordsAccepted.push(password);
        }

        // Clear field
        await page.fill(passwordInputSelector, '');
      } catch (error) {
        // Ignore errors during testing
      }
    }

    // Test strong passwords
    for (const password of strongPasswords) {
      try {
        await page.fill(passwordInputSelector, password);
        await page.click(submitSelector);
        await page.waitForTimeout(1000);

        // Check if strong password was rejected
        const validationError = page.locator('[data-testid*="password-validation-error"]');
        if (await validationError.isVisible({ timeout: 1000 })) {
          strongPasswordsRejected.push(password);
        }

        // Clear field
        await page.fill(passwordInputSelector, '');
      } catch (error) {
        // Ignore errors during testing
      }
    }

    return {
      policyEnforced: weakPasswordsAccepted.length === 0 && strongPasswordsRejected.length === 0,
      weakPasswordsAccepted,
      strongPasswordsRejected,
    };
  }
}