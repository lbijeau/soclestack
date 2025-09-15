import { faker } from '@faker-js/faker';
import { Role } from '@prisma/client';

export interface TestUser {
  id?: string;
  email: string;
  password: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  role: Role;
  isActive: boolean;
  emailVerified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date;
}

export interface TestUserSession {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export class TestDataFactory {
  static createUser(overrides: Partial<TestUser> = {}): TestUser {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    return {
      email: overrides.email || faker.internet.email({ firstName, lastName }).toLowerCase(),
      password: overrides.password || this.generateValidPassword(),
      username: overrides.username || faker.internet.userName({ firstName, lastName }).toLowerCase(),
      firstName: overrides.firstName || firstName,
      lastName: overrides.lastName || lastName,
      role: overrides.role || Role.USER,
      isActive: overrides.isActive ?? true,
      emailVerified: overrides.emailVerified ?? true,
      createdAt: overrides.createdAt || faker.date.past(),
      updatedAt: overrides.updatedAt || faker.date.recent(),
      lastLoginAt: overrides.lastLoginAt || (Math.random() > 0.5 ? faker.date.recent() : undefined),
      ...overrides,
    };
  }

  static createAdminUser(overrides: Partial<TestUser> = {}): TestUser {
    return this.createUser({
      role: Role.ADMIN,
      email: overrides.email || `admin.${faker.internet.userName()}@test.com`,
      ...overrides,
    });
  }

  static createModeratorUser(overrides: Partial<TestUser> = {}): TestUser {
    return this.createUser({
      role: Role.MODERATOR,
      email: overrides.email || `mod.${faker.internet.userName()}@test.com`,
      ...overrides,
    });
  }

  static createUnverifiedUser(overrides: Partial<TestUser> = {}): TestUser {
    return this.createUser({
      emailVerified: false,
      email: overrides.email || `unverified.${faker.internet.userName()}@test.com`,
      ...overrides,
    });
  }

  static createInactiveUser(overrides: Partial<TestUser> = {}): TestUser {
    return this.createUser({
      isActive: false,
      email: overrides.email || `inactive.${faker.internet.userName()}@test.com`,
      ...overrides,
    });
  }

  static createBulkUsers(count: number, overrides: Partial<TestUser> = {}): TestUser[] {
    return Array.from({ length: count }, () => this.createUser(overrides));
  }

  static generateValidPassword(): string {
    // Generate a password that meets typical requirements:
    // - At least 8 characters
    // - Contains uppercase, lowercase, number, and special character
    const uppercase = faker.string.alpha({ length: 2, casing: 'upper' });
    const lowercase = faker.string.alpha({ length: 2, casing: 'lower' });
    const numbers = faker.string.numeric(2);
    const special = '!@#$%^&*'[Math.floor(Math.random() * 8)];
    const additional = faker.string.alphanumeric(2);

    return faker.helpers.shuffle([...uppercase, ...lowercase, ...numbers, special, ...additional]).join('');
  }

  static generateWeakPassword(): string {
    return faker.string.alpha({ length: 4, casing: 'lower' });
  }

  static generateInvalidEmails(): string[] {
    return [
      'invalid-email',
      '@example.com',
      'user@',
      'user@.com',
      'user name@example.com',
      'user@exam ple.com',
      '',
      ' ',
      'a'.repeat(255) + '@example.com', // Too long
    ];
  }

  static createUserSession(userId: string, overrides: Partial<TestUserSession> = {}): TestUserSession {
    return {
      userId,
      tokenHash: faker.string.alphanumeric(64),
      expiresAt: faker.date.future(),
      ipAddress: overrides.ipAddress || faker.internet.ip(),
      userAgent: overrides.userAgent || faker.internet.userAgent(),
      ...overrides,
    };
  }

  static createFormData(): {
    validRegistrationData: any;
    invalidRegistrationData: any[];
    validLoginData: any;
    invalidLoginData: any[];
    validProfileUpdateData: any;
    invalidProfileUpdateData: any[];
    validPasswordChangeData: any;
    invalidPasswordChangeData: any[];
  } {
    const validUser = this.createUser();
    const validPassword = this.generateValidPassword();
    const newValidPassword = this.generateValidPassword();

    return {
      validRegistrationData: {
        email: validUser.email,
        password: validPassword,
        confirmPassword: validPassword,
        firstName: validUser.firstName,
        lastName: validUser.lastName,
        username: validUser.username,
        termsAccepted: true,
      },

      invalidRegistrationData: [
        // Missing required fields
        { email: '', password: validPassword, confirmPassword: validPassword },
        { email: validUser.email, password: '', confirmPassword: '' },

        // Invalid email formats
        { email: 'invalid-email', password: validPassword, confirmPassword: validPassword },

        // Password mismatch
        { email: validUser.email, password: validPassword, confirmPassword: 'different-password' },

        // Weak password
        { email: validUser.email, password: '123', confirmPassword: '123' },

        // Terms not accepted
        { email: validUser.email, password: validPassword, confirmPassword: validPassword, termsAccepted: false },

        // Duplicate email (handled in tests)
        { email: 'admin@test.com', password: validPassword, confirmPassword: validPassword },
      ],

      validLoginData: {
        email: 'user@test.com',
        password: 'UserTest123!',
        rememberMe: false,
      },

      invalidLoginData: [
        // Empty fields
        { email: '', password: '' },
        { email: validUser.email, password: '' },
        { email: '', password: validPassword },

        // Invalid credentials
        { email: 'nonexistent@test.com', password: validPassword },
        { email: 'user@test.com', password: 'WrongPassword123!' },

        // Invalid email format
        { email: 'invalid-email', password: validPassword },

        // Inactive user
        { email: 'inactive@test.com', password: validPassword },
      ],

      validProfileUpdateData: {
        username: faker.internet.userName().toLowerCase(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email().toLowerCase(),
      },

      invalidProfileUpdateData: [
        // Invalid email
        { email: 'invalid-email' },
        { email: '' },

        // Username too short/long
        { username: 'a' },
        { username: 'a'.repeat(51) },

        // Special characters in names
        { firstName: 'John123' },
        { lastName: 'Doe@#$' },

        // Duplicate email/username
        { email: 'admin@test.com' },
        { username: 'admin' },
      ],

      validPasswordChangeData: {
        currentPassword: 'UserTest123!',
        newPassword: newValidPassword,
        confirmPassword: newValidPassword,
      },

      invalidPasswordChangeData: [
        // Wrong current password
        { currentPassword: 'WrongPassword123!', newPassword: newValidPassword, confirmPassword: newValidPassword },

        // Password mismatch
        { currentPassword: 'UserTest123!', newPassword: newValidPassword, confirmPassword: 'DifferentPassword123!' },

        // Weak new password
        { currentPassword: 'UserTest123!', newPassword: '123', confirmPassword: '123' },

        // Same as current password
        { currentPassword: 'UserTest123!', newPassword: 'UserTest123!', confirmPassword: 'UserTest123!' },

        // Empty fields
        { currentPassword: '', newPassword: newValidPassword, confirmPassword: newValidPassword },
      ],
    };
  }

  static createSecurityTestData(): {
    sqlInjectionAttempts: string[];
    xssAttempts: string[];
    csrfTestCases: any[];
    rateLimitTestData: any;
  } {
    return {
      sqlInjectionAttempts: [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "admin@test.com'; UPDATE users SET role='ADMIN' WHERE email='user@test.com'; --",
        "' UNION SELECT * FROM users WHERE '1'='1",
        "'; INSERT INTO users (email, role) VALUES ('hacker@evil.com', 'ADMIN'); --",
      ],

      xssAttempts: [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(\'XSS\')">',
        'javascript:alert("XSS")',
        '<svg onload="alert(\'XSS\')">',
        '"><script>document.location="http://evil.com"</script>',
      ],

      csrfTestCases: [
        { method: 'POST', endpoint: '/api/users/update', withToken: false },
        { method: 'DELETE', endpoint: '/api/users/123', withToken: false },
        { method: 'POST', endpoint: '/api/auth/change-password', withToken: false },
      ],

      rateLimitTestData: {
        loginAttempts: 10,
        registrationAttempts: 5,
        passwordResetAttempts: 3,
        timeWindow: 60000, // 1 minute
      },
    };
  }

  static createPerformanceTestData(): {
    bulkUserCount: number;
    concurrentRequestCount: number;
    loadTestDuration: number;
    expectedResponseTimes: {
      login: number;
      registration: number;
      profileLoad: number;
      userList: number;
    };
  } {
    return {
      bulkUserCount: 100,
      concurrentRequestCount: 50,
      loadTestDuration: 30000, // 30 seconds

      expectedResponseTimes: {
        login: 2000, // 2 seconds
        registration: 3000, // 3 seconds
        profileLoad: 1000, // 1 second
        userList: 5000, // 5 seconds
      },
    };
  }

  static createAccessibilityTestData(): {
    colorContrastTests: any[];
    keyboardNavigationTests: any[];
    screenReaderTests: any[];
    ariaLabelTests: any[];
  } {
    return {
      colorContrastTests: [
        { element: 'button', minRatio: 4.5 },
        { element: 'link', minRatio: 4.5 },
        { element: 'input', minRatio: 3.0 },
        { element: 'text', minRatio: 4.5 },
      ],

      keyboardNavigationTests: [
        { action: 'Tab', expectedFocus: 'first-input' },
        { action: 'Shift+Tab', expectedFocus: 'previous-input' },
        { action: 'Enter', expectedAction: 'submit-form' },
        { action: 'Escape', expectedAction: 'close-modal' },
      ],

      screenReaderTests: [
        { element: 'form', expectedAria: 'form' },
        { element: 'button', expectedAria: 'button' },
        { element: 'input', expectedAria: 'textbox' },
        { element: 'error', expectedAria: 'alert' },
      ],

      ariaLabelTests: [
        { selector: '[data-testid="email-input"]', expectedLabel: 'Email Address' },
        { selector: '[data-testid="password-input"]', expectedLabel: 'Password' },
        { selector: '[data-testid="login-submit"]', expectedLabel: 'Sign In' },
        { selector: '[data-testid="register-link"]', expectedLabel: 'Create Account' },
      ],
    };
  }
}