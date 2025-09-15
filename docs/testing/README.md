# Comprehensive Playwright Testing Documentation

## Overview

This document provides a complete guide to the Playwright end-to-end testing strategy implemented for the SocleStack Next.js user management application. The test suite covers authentication, user management, authorization, form validation, performance, accessibility, and security testing.

## Table of Contents

1. [Test Architecture](#test-architecture)
2. [Getting Started](#getting-started)
3. [Test Suites](#test-suites)
4. [Page Object Model](#page-object-model)
5. [Test Utilities](#test-utilities)
6. [CI/CD Integration](#cicd-integration)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Test Architecture

### Directory Structure

```
tests/
├── e2e/                          # End-to-end test suites
│   ├── auth/                     # Authentication tests
│   │   ├── authentication.spec.ts
│   │   ├── login.spec.ts
│   │   └── registration.spec.ts
│   ├── user-management/          # User management tests
│   │   └── profile-management.spec.ts
│   ├── authorization/            # Role-based access tests
│   │   └── role-based-access.spec.ts
│   ├── validation/               # Form validation tests
│   │   └── form-validation.spec.ts
│   ├── performance/              # Performance tests
│   │   └── performance.spec.ts
│   ├── accessibility/            # Accessibility tests
│   │   └── accessibility.spec.ts
│   └── security/                 # Security tests
│       └── security.spec.ts
├── pages/                        # Page Object Models
│   ├── BasePage.ts
│   ├── LoginPage.ts
│   ├── RegistrationPage.ts
│   ├── ProfilePage.ts
│   └── ExtendedProfilePage.ts
├── utils/                        # Test utilities
│   ├── auth-helpers.ts
│   ├── database-helpers.ts
│   └── test-data-factory.ts
├── config/                       # Test configuration
│   ├── global-setup.ts
│   └── global-teardown.ts
└── fixtures/                     # Test fixtures
    ├── auth/
    └── data/
```

### Configuration

The test suite uses a sophisticated Playwright configuration that supports:

- **Cross-browser testing** (Chromium, Firefox, Safari, Edge)
- **Mobile device testing** (iPhone, Android)
- **Parallel execution** with sharding
- **Automatic retries** on CI
- **Multiple reporters** (HTML, JSON, JUnit)
- **Screenshot and video capture** on failure
- **Trace collection** for debugging

## Getting Started

### Prerequisites

1. Node.js 18+ installed
2. Database (PostgreSQL recommended)
3. Application running on localhost:3000

### Installation

```bash
# Install dependencies
npm ci

# Install Playwright browsers
npx playwright install --with-deps

# Setup test database
npm run db:migrate
npm run db:seed:test
```

### Running Tests

#### Basic Usage

```bash
# Run all tests
npm run test:e2e

# Run specific test suite
npm run test:auth
npm run test:user-management
npm run test:security

# Run tests in headed mode (visible browser)
npm run test:e2e -- --headed

# Run tests in debug mode
npm run test:e2e -- --debug

# Run specific test file
npx playwright test tests/e2e/auth/authentication.spec.ts
```

#### Advanced Usage

```bash
# Run tests on specific browser
npx playwright test --project=firefox

# Run tests with grep pattern
npx playwright test --grep="login"

# Run tests with parallel workers
npx playwright test --workers=4

# Run tests with retries
npx playwright test --retries=2
```

### Using the Test Runner Script

The project includes a comprehensive test runner script with advanced options:

```bash
# Run all tests
node scripts/test-runner.js

# Run specific mode
node scripts/test-runner.js --mode=auth
node scripts/test-runner.js --mode=performance
node scripts/test-runner.js --mode=accessibility

# Run with specific browser
node scripts/test-runner.js --browser=firefox

# Run in headed mode with debug
node scripts/test-runner.js --headed --debug

# Run with custom configuration
node scripts/test-runner.js \
  --mode=all \
  --browser=chromium \
  --parallel=2 \
  --retries=1 \
  --timeout=30000 \
  --env=staging
```

## Test Suites

### 1. Authentication Tests (`tests/e2e/auth/`)

**Coverage:**
- User login/logout flow
- Registration process with email verification
- Password reset functionality
- Session management
- Remember me functionality
- Social login (OAuth)
- Rate limiting protection
- CSRF protection
- Input sanitization

**Key Test Cases:**
- Valid and invalid credential combinations
- Password complexity requirements
- Email verification workflow
- Session persistence across browser restarts
- Multiple concurrent sessions
- Logout from all devices
- Account lockout after failed attempts

### 2. User Management Tests (`tests/e2e/user-management/`)

**Coverage:**
- Profile viewing and editing
- Password change functionality
- Email change with verification
- Profile picture upload/removal
- Account settings management
- Notification preferences
- Privacy settings
- Two-factor authentication
- Account deletion

**Key Test Cases:**
- Profile information updates
- Email change confirmation
- Password strength enforcement
- File upload validation
- Settings persistence
- Account deletion with confirmation

### 3. Authorization Tests (`tests/e2e/authorization/`)

**Coverage:**
- Role-based access control (Admin, Moderator, User)
- Protected route enforcement
- API endpoint protection
- Permission inheritance
- Role escalation prevention
- Session-based access control

**Key Test Cases:**
- Admin access to all features
- Moderator limited access
- User restricted access
- Unauthenticated redirects
- API access control
- Role change effects

### 4. Form Validation Tests (`tests/e2e/validation/`)

**Coverage:**
- Client-side validation
- Server-side validation
- Real-time validation feedback
- Cross-field validation
- Input sanitization
- File upload validation
- Error message display

**Key Test Cases:**
- Required field validation
- Email format validation
- Password confirmation matching
- Username availability checking
- XSS prevention
- File type and size limits

### 5. Performance Tests (`tests/e2e/performance/`)

**Coverage:**
- Page load performance
- Authentication response times
- Database query performance
- Network request optimization
- Memory usage monitoring
- Core Web Vitals measurement

**Key Test Cases:**
- Login page load under 2 seconds
- Authentication within 3 seconds
- Bulk data handling
- Concurrent user simulation
- Bundle size optimization

### 6. Accessibility Tests (`tests/e2e/accessibility/`)

**Coverage:**
- Keyboard navigation
- Screen reader support
- Color contrast compliance
- Focus management
- ARIA attributes
- Mobile accessibility
- WCAG 2.1 AA compliance

**Key Test Cases:**
- Full keyboard navigation
- Screen reader announcements
- Color contrast ratios
- Focus trap in modals
- Alternative input methods
- Mobile touch targets

### 7. Security Tests (`tests/e2e/security/`)

**Coverage:**
- SQL injection prevention
- XSS protection
- CSRF token validation
- Rate limiting enforcement
- Input sanitization
- Session security
- File upload security

**Key Test Cases:**
- Malicious input handling
- Authentication bypass attempts
- Session hijacking prevention
- File upload exploits
- API security headers

## Page Object Model

The test suite uses the Page Object Model pattern for maintainable and reusable test code.

### Base Page Class

```typescript
// tests/pages/BasePage.ts
export abstract class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Common navigation and utility methods
  async navigateTo(path: string): Promise<void>
  async waitForPageLoad(): Promise<void>
  async assertSuccessMessage(message?: string): Promise<void>
  async assertErrorMessage(message?: string): Promise<void>
  // ... more common methods
}
```

### Specialized Page Classes

Each page extends the base class and implements page-specific functionality:

- **LoginPage**: Login form interactions and validations
- **RegistrationPage**: Registration form with complex validation
- **ProfilePage**: Profile management functionality
- **ExtendedProfilePage**: Advanced profile features

### Example Usage

```typescript
test('should login successfully', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.login('user@test.com', 'password123');
  await loginPage.assertSuccessfulLogin();
});
```

## Test Utilities

### AuthHelpers

Provides authentication-related utilities:

```typescript
// Quick authentication methods
await AuthHelpers.loginAsAdmin(page);
await AuthHelpers.loginAsUser(page);
await AuthHelpers.logout(page);

// Test authentication states
const isAuth = await AuthHelpers.isAuthenticated(page);
await AuthHelpers.assertUserRole(page, Role.ADMIN);

// Test access control
const { allowed, denied } = await AuthHelpers.testAccessControl(page, routes);
```

### DatabaseHelpers

Manages test data and database operations:

```typescript
// User management
const user = await DatabaseHelpers.createTestUser(userData);
const users = await DatabaseHelpers.setupTestUsers();
await DatabaseHelpers.cleanupDatabase();

// Bulk operations
await DatabaseHelpers.createBulkTestData(1000);
const stats = await DatabaseHelpers.getDatabaseStats();
```

### TestDataFactory

Generates consistent test data:

```typescript
// Create test users
const user = TestDataFactory.createUser();
const admin = TestDataFactory.createAdminUser();
const bulkUsers = TestDataFactory.createBulkUsers(50);

// Generate form data
const formData = TestDataFactory.createFormData();
const securityData = TestDataFactory.createSecurityTestData();
const performanceData = TestDataFactory.createPerformanceTestData();
```

## CI/CD Integration

### GitHub Actions Workflow

The project includes a comprehensive GitHub Actions workflow that:

1. **Runs tests in parallel** across multiple browsers and shards
2. **Executes specialized test suites** (performance, accessibility, security)
3. **Generates combined reports** with detailed metrics
4. **Comments on pull requests** with test results
5. **Deploys test reports** to GitHub Pages

### Workflow Structure

```yaml
jobs:
  test:                    # Main E2E tests (parallel across browsers/shards)
  performance-tests:       # Performance benchmarks
  accessibility-tests:     # WCAG compliance checks
  security-tests:         # Security vulnerability tests
  generate-report:        # Combined reporting
  deploy-test-reports:    # Report deployment
```

### Local CI Simulation

```bash
# Run the same tests as CI locally
npm run test:ci

# Run specific CI job equivalent
npm run test:performance
npm run test:accessibility
npm run test:security
```

## Best Practices

### Writing Tests

1. **Use descriptive test names** that explain the scenario
2. **Follow the Arrange-Act-Assert pattern**
3. **Use test.step() for complex scenarios**
4. **Keep tests isolated and independent**
5. **Use proper test data cleanup**

### Page Objects

1. **Create reusable locators** with data-testid attributes
2. **Implement helper methods** for common actions
3. **Use assertions within page objects** for validation
4. **Keep page objects focused** on single page functionality

### Test Data

1. **Use factories** for consistent test data generation
2. **Implement proper cleanup** after each test
3. **Use unique identifiers** to avoid conflicts
4. **Mock external dependencies** when appropriate

### Performance

1. **Run tests in parallel** when possible
2. **Use test.beforeEach()** for common setup
3. **Implement proper waiting strategies**
4. **Optimize test execution time**

## Troubleshooting

### Common Issues

#### Tests Failing in CI but Passing Locally

**Possible Causes:**
- Timing issues due to slower CI environment
- Different browser versions
- Missing environment variables
- Database state issues

**Solutions:**
```typescript
// Increase timeouts for CI
test.setTimeout(process.env.CI ? 60000 : 30000);

// Use more robust waiting strategies
await page.waitForLoadState('networkidle');
await expect(element).toBeVisible({ timeout: 10000 });
```

#### Flaky Tests

**Common Patterns:**
- Race conditions
- Unreliable element selectors
- Network timing issues
- Animation interference

**Solutions:**
```typescript
// Use auto-waiting assertions
await expect(page.locator('[data-testid="element"]')).toBeVisible();

// Wait for specific conditions
await page.waitForFunction(() => window.dataLoaded === true);

// Disable animations
await page.addInitScript(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = '*, *::before, *::after { animation-duration: 0s !important; }';
    document.head.appendChild(style);
  });
});
```

#### Database Issues

**Setup Problems:**
```bash
# Reset test database
npm run db:reset:test

# Check database connection
npm run db:status

# Re-run migrations
npm run db:migrate:fresh
```

### Debugging

#### Visual Debugging

```bash
# Run tests in headed mode
npx playwright test --headed

# Run tests in debug mode (pauses execution)
npx playwright test --debug

# Generate trace files
npx playwright test --trace=on
```

#### Screenshots and Videos

```typescript
// Take screenshot during test
await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });

// Record video (configured in playwright.config.ts)
// Videos are automatically saved on failure
```

#### Trace Viewer

```bash
# Generate trace
npx playwright test --trace=on

# View trace
npx playwright show-trace test-results/trace.zip
```

### Getting Help

1. **Check test reports** in `test-results/html-report/`
2. **Review CI logs** for detailed error messages
3. **Use trace viewer** for step-by-step debugging
4. **Check database state** during test execution
5. **Verify environment variables** and configuration

## Contributing

When adding new tests:

1. **Follow existing patterns** and conventions
2. **Add appropriate test data** to factories
3. **Update page objects** as needed
4. **Include both positive and negative test cases**
5. **Add documentation** for complex test scenarios
6. **Ensure tests pass** on all supported browsers

For questions or suggestions, please refer to the project's contribution guidelines.