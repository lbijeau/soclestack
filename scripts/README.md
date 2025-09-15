# Scripts Directory

## Purpose
Utility scripts for development, testing, database management, and deployment tasks. These scripts automate common development workflows and provide consistent tooling across the project.

## Contents

### `seed-demo.js`
**Purpose**: Database seeding script for demo data and development environment
- **Features**:
  - Creates realistic demo users with various roles
  - Seeds test data for development and staging
  - Configurable data generation options
  - Database reset and cleanup capabilities
  - Idempotent execution (safe to run multiple times)

### `test-runner.js`
**Purpose**: Custom test execution orchestrator with advanced features
- **Features**:
  - Parallel test execution management
  - Test environment setup and teardown
  - Custom test reporting and metrics
  - Database state management for tests
  - CI/CD integration capabilities
  - Performance benchmarking

## Database Seeding Features

### Demo Data Generation
```javascript
// User creation with realistic data
async function createDemoUsers() {
  const users = [
    {
      email: 'admin@soclestack.com',
      role: 'ADMIN',
      firstName: 'System',
      lastName: 'Administrator'
    },
    {
      email: 'moderator@soclestack.com',
      role: 'MODERATOR',
      firstName: 'Content',
      lastName: 'Moderator'
    },
    {
      email: 'user@soclestack.com',
      role: 'USER',
      firstName: 'Demo',
      lastName: 'User'
    }
  ]

  for (const userData of users) {
    await createUserWithHashedPassword(userData)
  }
}
```

### Data Relationships
- **User Accounts**: Creates users with proper password hashing
- **User Sessions**: Generates realistic session data
- **Role Assignments**: Proper role hierarchy setup
- **Profile Data**: Complete user profile information

### Environment-Specific Seeding
```javascript
// Environment-aware seeding
function getSeedConfig() {
  const environment = process.env.NODE_ENV

  return {
    development: {
      userCount: 50,
      includeDemoData: true,
      resetDatabase: true
    },
    staging: {
      userCount: 20,
      includeDemoData: true,
      resetDatabase: false
    },
    production: {
      userCount: 0,
      includeDemoData: false,
      resetDatabase: false
    }
  }[environment]
}
```

## Test Runner Features

### Test Orchestration
```javascript
// Parallel test execution with proper isolation
async function runTestSuite(options = {}) {
  const {
    parallel = true,
    browsers = ['chromium', 'firefox'],
    testTypes = ['unit', 'integration', 'e2e']
  } = options

  // Setup test environment
  await setupTestEnvironment()

  // Run tests in parallel workers
  const results = await executeTestsInParallel({
    browsers,
    testTypes,
    workerCount: parallel ? os.cpus().length : 1
  })

  // Cleanup and report
  await cleanupTestEnvironment()
  await generateTestReport(results)

  return results
}
```

### Database Management for Tests
```javascript
// Test database lifecycle management
class TestDatabaseManager {
  async setup() {
    // Create isolated test database
    await this.createTestDatabase()

    // Run migrations
    await this.runMigrations()

    // Seed test data
    await this.seedTestData()
  }

  async cleanup() {
    // Clear test data
    await this.clearTestData()

    // Close connections
    await this.closeConnections()
  }

  async reset() {
    await this.cleanup()
    await this.setup()
  }
}
```

### Performance Benchmarking
```javascript
// Performance testing integration
async function runPerformanceTests() {
  const metrics = {
    apiResponseTimes: {},
    pageLoadTimes: {},
    databaseQueryTimes: {},
    memoryUsage: {}
  }

  // API performance tests
  metrics.apiResponseTimes = await benchmarkApiEndpoints()

  // Page load performance
  metrics.pageLoadTimes = await benchmarkPageLoads()

  // Database performance
  metrics.databaseQueryTimes = await benchmarkDatabaseQueries()

  // Generate performance report
  await generatePerformanceReport(metrics)

  return metrics
}
```

## Script Usage

### Database Seeding
```bash
# Seed development database
node scripts/seed-demo.js

# Seed with specific user count
node scripts/seed-demo.js --users=100

# Reset and seed
node scripts/seed-demo.js --reset

# Environment-specific seeding
NODE_ENV=staging node scripts/seed-demo.js
```

### Test Execution
```bash
# Run full test suite
node scripts/test-runner.js

# Run specific test types
node scripts/test-runner.js --type=e2e

# Run with specific browsers
node scripts/test-runner.js --browsers=chromium,firefox

# Performance testing
node scripts/test-runner.js --performance

# CI mode with reporting
node scripts/test-runner.js --ci --report=junit
```

## Configuration Options

### Seeding Configuration
```javascript
const seedConfig = {
  // User generation
  users: {
    count: 50,
    roles: {
      admin: 2,
      moderator: 5,
      user: 43
    },
    profileCompleteness: 0.8
  },

  // Data realism
  faker: {
    locale: 'en',
    seed: 12345
  },

  // Database options
  database: {
    reset: true,
    skipIfExists: false,
    batchSize: 10
  }
}
```

### Test Runner Configuration
```javascript
const testConfig = {
  // Execution options
  parallel: true,
  maxWorkers: 4,
  timeout: 30000,

  // Browser options
  browsers: ['chromium', 'firefox', 'webkit'],
  headless: true,

  // Database options
  database: {
    isolateWorkers: true,
    resetBetweenSuites: true,
    seedTestData: true
  },

  // Reporting options
  reporting: {
    formats: ['html', 'junit', 'json'],
    outputDir: './test-results',
    includeScreenshots: true,
    includeVideos: false
  }
}
```

## Dependencies

### Core Dependencies
- **@faker-js/faker**: Realistic test data generation
- **@prisma/client**: Database operations
- **bcrypt**: Password hashing for demo users

### Testing Dependencies
- **@playwright/test**: Browser automation
- **jest**: Unit testing framework (if used)
- **performance-now**: Performance timing

### Utility Dependencies
- **commander**: CLI argument parsing
- **chalk**: Colored console output
- **ora**: Loading spinners and progress

## Integration Points

### Development Workflow
- **Local Development**: Quick database seeding for development
- **Staging Deployment**: Consistent staging data setup
- **Demo Environments**: Realistic demo data for presentations

### CI/CD Integration
- **Test Execution**: Automated test running in CI/CD
- **Performance Monitoring**: Continuous performance benchmarking
- **Database Setup**: Automated test database provisioning

### Monitoring and Reporting
- **Test Metrics**: Detailed test execution metrics
- **Performance Tracking**: Performance regression detection
- **Quality Gates**: Automated quality threshold enforcement

## Error Handling

### Robust Error Handling
```javascript
async function executeWithRetry(operation, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }

      console.log(`Attempt ${attempt} failed, retrying...`)
      await sleep(1000 * attempt) // Exponential backoff
    }
  }
}
```

### Cleanup on Failure
```javascript
process.on('SIGINT', async () => {
  console.log('Received SIGINT, cleaning up...')
  await cleanup()
  process.exit(0)
})

process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception:', error)
  await cleanup()
  process.exit(1)
})
```

## Best Practices

### Script Design
- **Idempotent Operations**: Scripts can be run multiple times safely
- **Environment Awareness**: Different behavior based on environment
- **Verbose Output**: Clear progress and status information
- **Error Recovery**: Graceful error handling and cleanup

### Performance
- **Batch Operations**: Efficient database operations
- **Connection Pooling**: Proper database connection management
- **Memory Management**: Cleanup of large data structures
- **Progress Tracking**: Real-time progress information

### Security
- **Environment Separation**: Different configs per environment
- **Secure Defaults**: Safe default configurations
- **No Production Data**: Never seed production with test data
- **Credential Management**: Secure handling of database credentials

## Maintenance

### Regular Updates
- **Dependency Updates**: Keep dependencies current
- **Configuration Updates**: Update configs as application evolves
- **Performance Optimization**: Regular performance tuning
- **Documentation**: Keep script documentation current

### Monitoring
- **Execution Time**: Track script execution performance
- **Success Rate**: Monitor script success rates
- **Resource Usage**: Track resource consumption
- **Error Patterns**: Identify and fix common failure patterns