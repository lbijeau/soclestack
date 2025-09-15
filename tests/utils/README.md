# Test Utilities

## Purpose
Comprehensive testing utilities that provide reusable helper functions for authentication, database management, security testing, and test data generation. These utilities ensure consistent testing patterns across the test suite.

## Contents

### `auth-helpers.ts`
**Purpose**: Authentication-specific testing utilities
- **Features**:
  - User session creation and management
  - Authentication token generation
  - Login/logout test helpers
  - Session validation utilities
  - Multi-user authentication scenarios
  - Role-based testing support

### `database-helpers.ts`
**Purpose**: Database state management for tests
- **Features**:
  - Test database setup and teardown
  - User data seeding and cleanup
  - Transaction management
  - Database state reset between tests
  - Test data isolation
  - Schema migration utilities

### `security-helpers.ts`
**Purpose**: Security testing utilities and helpers
- **Features**:
  - CSRF token generation and validation
  - Rate limiting simulation
  - Security header verification
  - Input sanitization testing
  - Session security validation
  - Token manipulation utilities

### `test-data-factory.ts`
**Purpose**: Test data generation and factory patterns
- **Features**:
  - User data factories with realistic data
  - Role-based user generation
  - Consistent test data patterns
  - Faker.js integration for realistic data
  - Custom data builders
  - Relationship data management

## Testing Patterns

### Authentication Helpers

#### User Session Management
```typescript
// Create authenticated user session
export async function createAuthenticatedUser(userData?: Partial<User>): Promise<User> {
  const user = await createTestUser(userData)
  const session = await createUserSession(user)
  return { ...user, session }
}

// Login user in browser context
export async function loginUser(page: Page, credentials: LoginCredentials): Promise<void> {
  await page.goto('/login')
  await page.fill('[data-testid="email"]', credentials.email)
  await page.fill('[data-testid="password"]', credentials.password)
  await page.click('[data-testid="login-button"]')
  await page.waitForURL('/dashboard')
}

// Logout user and clear session
export async function logoutUser(page: Page): Promise<void> {
  await page.click('[data-testid="logout-button"]')
  await page.waitForURL('/login')
}
```

#### Token Management
```typescript
// Generate test JWT tokens
export function generateTestAccessToken(userData: Partial<User>): string {
  return jwt.sign(
    {
      sub: userData.id,
      email: userData.email,
      role: userData.role,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  )
}

// Validate token structure
export function validateTokenStructure(token: string): boolean {
  try {
    const decoded = jwt.decode(token)
    return decoded && typeof decoded === 'object'
  } catch {
    return false
  }
}
```

### Database Helpers

#### Test Data Management
```typescript
// Setup clean database state
export async function setupTestDatabase(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.userSession.deleteMany()
    await tx.user.deleteMany()
  })
}

// Create test user with optional data
export async function createTestUser(userData?: Partial<User>): Promise<User> {
  return prisma.user.create({
    data: {
      email: userData?.email || faker.internet.email(),
      username: userData?.username || faker.internet.userName(),
      password: await hashPassword(userData?.password || 'TestPassword123!'),
      firstName: userData?.firstName || faker.person.firstName(),
      lastName: userData?.lastName || faker.person.lastName(),
      role: userData?.role || 'USER',
      isActive: userData?.isActive ?? true,
      emailVerified: userData?.emailVerified ?? true,
    }
  })
}

// Cleanup test data
export async function cleanupTestData(): Promise<void> {
  await setupTestDatabase()
}
```

#### Transaction Management
```typescript
// Run test in isolated transaction
export async function runInTransaction<T>(
  callback: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    return callback(tx)
  })
}
```

### Security Helpers

#### CSRF Testing
```typescript
// Generate CSRF token for testing
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// Validate CSRF protection
export async function testCSRFProtection(
  page: Page,
  endpoint: string,
  method: string = 'POST'
): Promise<boolean> {
  const response = await page.request.fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    data: JSON.stringify({ test: 'data' })
  })

  return response.status() === 403
}
```

#### Rate Limiting Testing
```typescript
// Test rate limiting implementation
export async function testRateLimit(
  page: Page,
  endpoint: string,
  limit: number
): Promise<boolean> {
  const requests = Array.from({ length: limit + 1 }, (_, i) =>
    page.request.post(endpoint, {
      data: JSON.stringify({ attempt: i })
    })
  )

  const responses = await Promise.all(requests)
  const lastResponse = responses[responses.length - 1]

  return lastResponse.status() === 429
}
```

#### Security Header Validation
```typescript
// Validate security headers
export async function validateSecurityHeaders(page: Page): Promise<boolean> {
  const response = await page.goto('/')
  const headers = response!.headers()

  return [
    'x-frame-options',
    'x-content-type-options',
    'x-xss-protection',
    'content-security-policy'
  ].every(header => headers[header])
}
```

### Test Data Factory

#### User Factory
```typescript
// User factory with realistic data
export class UserFactory {
  static build(overrides: Partial<User> = {}): User {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      username: faker.internet.userName(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      password: 'HashedPassword123!',
      role: 'USER',
      isActive: true,
      emailVerified: true,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      lastLoginAt: faker.date.recent(),
      ...overrides
    }
  }

  static buildMany(count: number, overrides: Partial<User> = {}): User[] {
    return Array.from({ length: count }, () => this.build(overrides))
  }

  static admin(overrides: Partial<User> = {}): User {
    return this.build({ role: 'ADMIN', ...overrides })
  }

  static moderator(overrides: Partial<User> = {}): User {
    return this.build({ role: 'MODERATOR', ...overrides })
  }
}
```

#### Login Credentials Factory
```typescript
// Login credentials factory
export class CredentialsFactory {
  static build(overrides: Partial<LoginCredentials> = {}): LoginCredentials {
    return {
      email: faker.internet.email(),
      password: 'TestPassword123!',
      ...overrides
    }
  }

  static invalid(): LoginCredentials {
    return {
      email: 'invalid-email',
      password: 'weak'
    }
  }
}
```

## Dependencies

### Core Testing
- **@playwright/test**: Browser automation and testing
- **@faker-js/faker**: Realistic test data generation
- **@prisma/client**: Database operations

### Authentication
- **jsonwebtoken**: JWT token manipulation
- **bcrypt**: Password hashing for test users
- **crypto**: Security token generation

### Database
- **Prisma**: Database client and transactions
- **Database Connection**: Test database configuration

## Integration Points

### Test Suite Integration
- **E2E Tests**: Used by Playwright end-to-end tests
- **API Tests**: Supports API route testing
- **Component Tests**: Provides data for component testing
- **Performance Tests**: Supports load testing scenarios

### CI/CD Integration
- **Test Setup**: Database initialization in CI
- **Parallel Testing**: Thread-safe test utilities
- **Cleanup**: Automated cleanup between test runs
- **Reporting**: Test data for reports and analytics

## Usage Patterns

### Authentication Testing
```typescript
import { createAuthenticatedUser, loginUser } from '../utils/auth-helpers'

test('authenticated user can access dashboard', async ({ page }) => {
  const user = await createAuthenticatedUser({ role: 'USER' })
  await loginUser(page, { email: user.email, password: 'TestPassword123!' })

  await expect(page).toHaveURL('/dashboard')
})
```

### Database Testing
```typescript
import { setupTestDatabase, createTestUser } from '../utils/database-helpers'

test.beforeEach(async () => {
  await setupTestDatabase()
})

test('user registration creates database record', async () => {
  const userData = UserFactory.build()
  const user = await createTestUser(userData)

  expect(user.email).toBe(userData.email)
})
```

### Security Testing
```typescript
import { testRateLimit, validateSecurityHeaders } from '../utils/security-helpers'

test('API endpoint implements rate limiting', async ({ page }) => {
  const isRateLimited = await testRateLimit(page, '/api/auth/login', 5)
  expect(isRateLimited).toBe(true)
})
```

## Best Practices
- **Isolation**: Each test gets clean data state
- **Reusability**: Common patterns extracted to utilities
- **Type Safety**: Full TypeScript integration
- **Performance**: Efficient database operations
- **Security**: Secure test data handling