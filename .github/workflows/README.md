# GitHub Workflows

## Purpose
CI/CD workflows for automated testing, building, and deployment. These workflows ensure code quality, run comprehensive tests, and maintain the integrity of the application through automated processes.

## Contents

### `playwright-tests.yml`
**Purpose**: Automated end-to-end testing workflow using Playwright
- **Features**:
  - Multi-browser testing (Chromium, Firefox, WebKit)
  - Parallel test execution for performance
  - Test database setup and management
  - Automated test reporting and artifacts
  - Pull request integration
  - Scheduled test runs
  - Performance monitoring

## Workflow Features

### Trigger Events
```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:      # Manual trigger
```

### Multi-Browser Testing
- **Chromium**: Primary browser for testing
- **Firefox**: Cross-browser compatibility
- **WebKit**: Safari compatibility testing
- **Mobile Browsers**: Mobile viewport testing

### Test Environment Setup
- **Node.js Environment**: Specified Node version setup
- **Database Provisioning**: Test database initialization
- **Environment Variables**: Secure configuration management
- **Dependency Installation**: Package installation and caching

## Key Workflow Steps

### Environment Preparation
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v3
  with:
    node-version: '18'
    cache: 'npm'

- name: Install dependencies
  run: npm ci

- name: Setup test database
  run: |
    npm run db:test:setup
    npm run db:migrate
```

### Test Execution
```yaml
- name: Run Playwright tests
  run: npx playwright test
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

### Artifact Collection
```yaml
- name: Upload test results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
    retention-days: 30
```

## Test Configuration

### Parallel Execution
- **Worker Isolation**: Each worker gets isolated test environment
- **Database Separation**: Worker-specific test databases
- **Performance Optimization**: Parallel test execution for speed
- **Resource Management**: Efficient CI resource utilization

### Test Reporting
- **HTML Reports**: Comprehensive test execution reports
- **Screenshots**: Failure point screenshots
- **Video Recording**: Full test execution videos
- **Performance Metrics**: Test execution timing and metrics

## Security Configuration

### Secret Management
```yaml
env:
  DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
  SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  ENCRYPTION_KEY: ${{ secrets.ENCRYPTION_KEY }}
```

### Secure Testing
- **Isolated Environment**: Tests run in isolated containers
- **Secret Injection**: Secure environment variable injection
- **No Sensitive Data**: No production data in test environment
- **Audit Logging**: All workflow executions logged

## Performance Optimization

### Caching Strategy
```yaml
- name: Cache node modules
  uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

### Build Optimization
- **Dependency Caching**: npm package caching
- **Docker Layer Caching**: Container layer caching
- **Artifact Reuse**: Build artifact reuse across jobs
- **Parallel Jobs**: Concurrent job execution

## Quality Gates

### Test Coverage Requirements
- **Minimum Coverage**: 80% code coverage requirement
- **Coverage Reports**: Detailed coverage analysis
- **Trend Tracking**: Coverage trend monitoring
- **Failure Handling**: Build fails on coverage regression

### Performance Thresholds
- **Response Time**: API response time monitoring
- **Page Load**: Page load performance testing
- **Bundle Size**: JavaScript bundle size monitoring
- **Memory Usage**: Memory leak detection

## Integration Features

### Pull Request Integration
```yaml
- name: Comment PR
  uses: actions/github-script@v6
  if: github.event_name == 'pull_request'
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: 'Test results: ✅ All tests passed!'
      })
```

### Slack Notifications
- **Test Results**: Automated test result notifications
- **Failure Alerts**: Immediate failure notifications
- **Daily Reports**: Daily test execution summaries
- **Performance Alerts**: Performance regression notifications

## Deployment Integration

### Staging Deployment
- **Automatic Deployment**: Deploy to staging on successful tests
- **Smoke Tests**: Post-deployment smoke testing
- **Rollback Capability**: Automatic rollback on failures
- **Environment Validation**: Staging environment validation

### Production Deployment
- **Manual Approval**: Production deployment requires approval
- **Blue-Green Deployment**: Zero-downtime deployment strategy
- **Health Checks**: Post-deployment health verification
- **Monitoring**: Deployment monitoring and alerting

## Monitoring and Alerting

### Test Execution Monitoring
- **Execution Time**: Test execution time tracking
- **Flaky Test Detection**: Identification of unstable tests
- **Success Rate**: Test success rate monitoring
- **Resource Usage**: CI resource utilization tracking

### Failure Analysis
- **Failure Categorization**: Automatic failure classification
- **Root Cause Analysis**: Failure pattern analysis
- **Retry Logic**: Intelligent test retry mechanisms
- **Escalation**: Automatic escalation of critical failures

## Configuration Management

### Environment Variables
```yaml
env:
  NODE_ENV: test
  CI: true
  PLAYWRIGHT_BROWSERS_PATH: 0
  DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

### Matrix Testing
```yaml
strategy:
  matrix:
    browser: [chromium, firefox, webkit]
    node-version: [16.x, 18.x]
```

## Best Practices

### Workflow Design
- **Fast Feedback**: Quick initial checks before expensive tests
- **Fail Fast**: Early termination on critical failures
- **Resource Efficiency**: Optimal CI resource usage
- **Maintainability**: Clear, documented workflow steps

### Security
- **Least Privilege**: Minimum required permissions
- **Secret Rotation**: Regular secret rotation schedule
- **Audit Trail**: Comprehensive workflow execution logging
- **Isolation**: Secure test environment isolation

## Usage Examples

### Manual Workflow Trigger
```bash
# Trigger workflow manually with specific parameters
gh workflow run playwright-tests.yml \
  --ref main \
  --field browser=chromium \
  --field test-suite=smoke
```

### Local Development
```bash
# Run same tests locally as in CI
npm run test:e2e
npm run test:e2e:ci  # CI-specific configuration
```

## Troubleshooting

### Common Issues
- **Flaky Tests**: Network timing and element loading issues
- **Resource Limits**: CI resource exhaustion
- **Environment Setup**: Database connection issues
- **Browser Compatibility**: Cross-browser test failures

### Debug Strategies
- **Verbose Logging**: Detailed execution logging
- **Test Artifacts**: Screenshots and videos for debugging
- **Environment Inspection**: CI environment debugging
- **Local Reproduction**: Running CI tests locally