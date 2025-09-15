# Test Configuration

## Purpose
Global test configuration and setup utilities for the testing environment. Provides centralized configuration for database setup, test environment initialization, and cleanup procedures.

## Contents

### `global-setup.ts`
**Purpose**: Global test environment setup executed before test suite runs
- **Features**:
  - Test database initialization
  - Environment variable validation
  - Test data seeding
  - External service setup (if needed)
  - Global state preparation
  - Performance optimization setup

### `global-teardown.ts`
**Purpose**: Global cleanup executed after test suite completes
- **Features**:
  - Test database cleanup
  - Temporary file removal
  - Resource cleanup
  - Performance metrics collection
  - Final state validation
  - Report generation

## Global Setup Features

### Database Initialization
```typescript
// Database setup for testing
export async function setupTestDatabase(): Promise<void> {
  // Ensure test database exists
  await ensureTestDatabaseExists()

  // Run migrations
  await runDatabaseMigrations()

  // Seed initial test data
  await seedTestData()

  // Verify database state
  await verifyDatabaseSetup()
}
```

### Environment Validation
```typescript
// Validate test environment
export function validateTestEnvironment(): void {
  const requiredEnvVars = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'JWT_SECRET',
    'NODE_ENV'
  ]

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`)
    }
  }

  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Tests must run in test environment')
  }
}
```

### Test Data Seeding
```typescript
// Seed essential test data
export async function seedTestData(): Promise<void> {
  // Create test admin user
  await createTestAdmin()

  // Create test moderator user
  await createTestModerator()

  // Create standard test users
  await createTestUsers(5)

  // Setup test roles and permissions
  await setupTestRoles()
}
```

## Global Teardown Features

### Database Cleanup
```typescript
// Clean up test database
export async function cleanupTestDatabase(): Promise<void> {
  // Remove all test data
  await clearAllTestData()

  // Reset auto-increment counters
  await resetDatabaseCounters()

  // Verify cleanup completion
  await verifyDatabaseCleanup()
}
```

### Resource Cleanup
```typescript
// Clean up test resources
export async function cleanupTestResources(): Promise<void> {
  // Remove temporary files
  await removeTemporaryFiles()

  // Close database connections
  await closeDatabaseConnections()

  // Clean up any external service connections
  await cleanupExternalServices()
}
```

### Performance Metrics
```typescript
// Collect and report test performance
export async function collectPerformanceMetrics(): Promise<void> {
  const metrics = {
    totalTestTime: Date.now() - global.testStartTime,
    databaseQueries: global.queryCount,
    apiCalls: global.apiCallCount,
    memoryUsage: process.memoryUsage()
  }

  await saveMetricsReport(metrics)
}
```

## Configuration Management

### Test Environment Setup
```typescript
// Configure test environment
export function configureTestEnvironment(): void {
  // Set test-specific timeouts
  jest.setTimeout(30000)

  // Configure global test variables
  global.testStartTime = Date.now()
  global.queryCount = 0
  global.apiCallCount = 0

  // Setup global error handling
  process.on('unhandledRejection', handleTestError)
}
```

### Database Configuration
```typescript
// Test database configuration
export const testDatabaseConfig = {
  url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  maxConnections: 10,
  transactionTimeout: 5000,
  logQueries: process.env.LOG_TEST_QUERIES === 'true'
}
```

## Dependencies

### Database
- **@prisma/client**: Database operations and migrations
- **Database Driver**: Specific database client (PostgreSQL, MySQL, etc.)

### Testing Framework
- **Playwright**: Browser automation setup
- **Jest**: Test runner configuration (if used)
- **Test Utilities**: Custom testing utilities

### Environment
- **dotenv**: Environment variable management
- **Node.js**: File system and process management

## Integration with Test Suites

### Playwright Integration
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  globalSetup: require.resolve('./tests/config/global-setup'),
  globalTeardown: require.resolve('./tests/config/global-teardown'),
  // ... other configuration
})
```

### Jest Integration
```typescript
// jest.config.js
module.exports = {
  globalSetup: './tests/config/global-setup.ts',
  globalTeardown: './tests/config/global-teardown.ts',
  // ... other configuration
}
```

## Error Handling

### Setup Error Handling
```typescript
export async function handleSetupError(error: Error): Promise<void> {
  console.error('Test setup failed:', error.message)

  // Attempt cleanup
  try {
    await cleanupAfterFailedSetup()
  } catch (cleanupError) {
    console.error('Cleanup after failed setup also failed:', cleanupError)
  }

  // Exit with error code
  process.exit(1)
}
```

### Graceful Failure Recovery
```typescript
export async function attemptRecovery(): Promise<boolean> {
  try {
    // Reset database state
    await resetDatabaseState()

    // Reinitialize test environment
    await reinitializeTestEnvironment()

    return true
  } catch (error) {
    console.error('Recovery failed:', error)
    return false
  }
}
```

## Performance Optimization

### Connection Pooling
```typescript
// Optimize database connections for testing
export function optimizeTestConnections(): void {
  // Configure connection pool for tests
  const poolConfig = {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 5000,
    idleTimeoutMillis: 10000
  }

  configureConnectionPool(poolConfig)
}
```

### Parallel Test Support
```typescript
// Support for parallel test execution
export function setupParallelTesting(): void {
  const workerId = process.env.JEST_WORKER_ID || process.env.PLAYWRIGHT_WORKER_ID

  if (workerId) {
    // Create worker-specific database
    process.env.DATABASE_URL = `${process.env.DATABASE_URL}_worker_${workerId}`
  }
}
```

## Monitoring and Debugging

### Test Execution Monitoring
```typescript
// Monitor test execution
export function setupTestMonitoring(): void {
  // Track database query counts
  prisma.$use(async (params, next) => {
    global.queryCount++
    return next(params)
  })

  // Track API calls
  setupApiCallTracking()

  // Monitor memory usage
  setInterval(logMemoryUsage, 10000)
}
```

### Debug Information
```typescript
// Collect debug information
export function collectDebugInfo(): DebugInfo {
  return {
    environment: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL?.replace(/password=[^&]*/, 'password=***'),
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage(),
    testStartTime: global.testStartTime,
    queryCount: global.queryCount
  }
}
```

## Usage in CI/CD

### CI Configuration
- **Database Setup**: Automated test database provisioning
- **Environment Variables**: Secure secret management
- **Parallel Execution**: Worker-specific database isolation
- **Cleanup**: Guaranteed cleanup even on failures

### Performance Tracking
- **Metrics Collection**: Test execution performance tracking
- **Trend Analysis**: Performance regression detection
- **Resource Usage**: Memory and CPU usage monitoring
- **Report Generation**: Automated performance reports

## Best Practices
- **Isolation**: Each test worker gets isolated resources
- **Cleanup**: Guaranteed cleanup even on test failures
- **Monitoring**: Comprehensive test execution monitoring
- **Error Handling**: Graceful failure recovery mechanisms
- **Performance**: Optimized for fast test execution