#!/usr/bin/env node

/**
 * Comprehensive test runner script for the Playwright test suite
 * Provides different test execution modes and reporting options
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('mode', {
    alias: 'm',
    description: 'Test execution mode',
    choices: ['all', 'auth', 'user-management', 'security', 'performance', 'accessibility', 'validation'],
    default: 'all'
  })
  .option('browser', {
    alias: 'b',
    description: 'Browser to run tests on',
    choices: ['chromium', 'firefox', 'webkit', 'all'],
    default: 'chromium'
  })
  .option('headed', {
    alias: 'h',
    description: 'Run tests in headed mode',
    type: 'boolean',
    default: false
  })
  .option('debug', {
    alias: 'd',
    description: 'Run tests in debug mode',
    type: 'boolean',
    default: false
  })
  .option('parallel', {
    alias: 'p',
    description: 'Number of parallel workers',
    type: 'number',
    default: 1
  })
  .option('retries', {
    alias: 'r',
    description: 'Number of retries for failed tests',
    type: 'number',
    default: 0
  })
  .option('reporter', {
    description: 'Test reporter',
    choices: ['html', 'json', 'junit', 'line', 'list', 'dot'],
    default: 'html'
  })
  .option('timeout', {
    alias: 't',
    description: 'Test timeout in milliseconds',
    type: 'number',
    default: 60000
  })
  .option('grep', {
    alias: 'g',
    description: 'Only run tests matching this pattern',
    type: 'string'
  })
  .option('env', {
    alias: 'e',
    description: 'Environment to run tests against',
    choices: ['local', 'staging', 'production'],
    default: 'local'
  })
  .option('setup', {
    description: 'Run test setup before executing tests',
    type: 'boolean',
    default: true
  })
  .option('cleanup', {
    description: 'Run test cleanup after executing tests',
    type: 'boolean',
    default: true
  })
  .help()
  .argv;

class TestRunner {
  constructor(options) {
    this.options = options;
    this.startTime = Date.now();
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    };
  }

  async run() {
    console.log('🚀 Starting Playwright test execution...');
    console.log(`Mode: ${this.options.mode}`);
    console.log(`Browser: ${this.options.browser}`);
    console.log(`Environment: ${this.options.env}`);
    console.log('─'.repeat(50));

    try {
      if (this.options.setup) {
        await this.runSetup();
      }

      await this.executeTests();

      if (this.options.cleanup) {
        await this.runCleanup();
      }

      await this.generateReport();
      this.printSummary();

    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      process.exit(1);
    }
  }

  async runSetup() {
    console.log('🔧 Running test setup...');

    // Ensure test directories exist
    const dirs = [
      'test-results/html-report',
      'test-results/json-report',
      'test-results/junit-report',
      'test-results/artifacts',
      'test-results/screenshots',
      'tests/fixtures/auth',
      'tests/fixtures/data'
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`  ✓ Created directory: ${dir}`);
      }
    });

    // Setup test database
    if (this.options.env === 'local') {
      try {
        console.log('  🗄️ Setting up test database...');
        execSync('npm run db:migrate', { stdio: 'inherit' });
        execSync('npm run db:seed:test', { stdio: 'inherit' });
        console.log('  ✓ Database setup complete');
      } catch (error) {
        console.warn('  ⚠️ Database setup failed:', error.message);
      }
    }

    // Install browsers if needed
    try {
      console.log('  🌐 Checking browser installations...');
      execSync('npx playwright install --with-deps', { stdio: 'pipe' });
      console.log('  ✓ Browser check complete');
    } catch (error) {
      console.warn('  ⚠️ Browser installation check failed:', error.message);
    }

    console.log('✅ Setup complete\n');
  }

  async executeTests() {
    console.log('🧪 Executing tests...');

    const testPatterns = this.getTestPatterns();
    const playwrightArgs = this.buildPlaywrightArgs();

    for (const pattern of testPatterns) {
      console.log(`\n📋 Running: ${pattern}`);

      try {
        const command = `npx playwright test ${pattern} ${playwrightArgs.join(' ')}`;
        console.log(`Command: ${command}\n`);

        execSync(command, {
          stdio: 'inherit',
          env: { ...process.env, ...this.getEnvironmentVariables() }
        });

        console.log(`✅ ${pattern} completed successfully`);
      } catch (error) {
        console.error(`❌ ${pattern} failed:`, error.message);
        if (!this.options.debug) {
          throw error;
        }
      }
    }
  }

  getTestPatterns() {
    const patterns = {
      all: [
        'tests/e2e/auth/',
        'tests/e2e/user-management/',
        'tests/e2e/authorization/',
        'tests/e2e/validation/',
      ],
      auth: ['tests/e2e/auth/'],
      'user-management': ['tests/e2e/user-management/'],
      security: ['tests/e2e/authorization/', 'tests/e2e/security/'],
      performance: ['tests/e2e/performance/'],
      accessibility: ['tests/e2e/accessibility/'],
      validation: ['tests/e2e/validation/']
    };

    return patterns[this.options.mode] || patterns.all;
  }

  buildPlaywrightArgs() {
    const args = [];

    // Browser selection
    if (this.options.browser !== 'all') {
      args.push(`--project=${this.options.browser}`);
    }

    // Reporter configuration
    args.push(`--reporter=${this.options.reporter}`);

    // Parallel execution
    if (this.options.parallel > 1) {
      args.push(`--workers=${this.options.parallel}`);
    }

    // Retries
    if (this.options.retries > 0) {
      args.push(`--retries=${this.options.retries}`);
    }

    // Timeout
    args.push(`--timeout=${this.options.timeout}`);

    // Headed mode
    if (this.options.headed) {
      args.push('--headed');
    }

    // Debug mode
    if (this.options.debug) {
      args.push('--debug');
    }

    // Grep pattern
    if (this.options.grep) {
      args.push(`--grep="${this.options.grep}"`);
    }

    return args;
  }

  getEnvironmentVariables() {
    const baseUrl = {
      local: 'http://localhost:3000',
          staging: 'https://staging.soclestack.com',
          production: 'https://soclestack.com'    }[this.options.env];

    return {
      BASE_URL: baseUrl,
      TEST_ENV: this.options.env,
      CI: process.env.CI || 'false'
    };
  }

  async runCleanup() {
    console.log('\n🧹 Running test cleanup...');

    try {
      // Clean up test data
      if (this.options.env === 'local') {
        console.log('  🗄️ Cleaning up test database...');
        execSync('npm run db:cleanup:test', { stdio: 'pipe' });
        console.log('  ✓ Database cleanup complete');
      }

      // Archive old test results
      const archiveDir = `test-results/archive/${new Date().toISOString().split('T')[0]}`;
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }

      console.log('  📁 Archiving test results...');
      // Move old results to archive (implementation would go here)

      console.log('✅ Cleanup complete');
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error.message);
    }
  }

  async generateReport() {
    console.log('\n📊 Generating test reports...');

    try {
      // Parse test results
      await this.parseResults();

      // Generate summary report
      const summary = {
        timestamp: new Date().toISOString(),
        duration: Date.now() - this.startTime,
        mode: this.options.mode,
        browser: this.options.browser,
        environment: this.options.env,
        results: this.results,
        options: this.options
      };

      const summaryPath = 'test-results/summary.json';
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
      console.log(`  ✓ Summary report: ${summaryPath}`);

      // Generate badge
      await this.generateBadge(summary);

      console.log('✅ Report generation complete');
    } catch (error) {
      console.warn('⚠️ Report generation warning:', error.message);
    }
  }

  async parseResults() {
    try {
      // Parse Playwright JSON results
      const jsonReportPath = 'test-results/json-report/results.json';
      if (fs.existsSync(jsonReportPath)) {
        const results = JSON.parse(fs.readFileSync(jsonReportPath, 'utf8'));

        this.results.total = results.suites?.reduce((total, suite) => {
          return total + (suite.specs?.length || 0);
        }, 0) || 0;

        this.results.passed = results.suites?.reduce((passed, suite) => {
          return passed + (suite.specs?.filter(spec =>
            spec.tests?.every(test => test.results?.every(result => result.status === 'passed'))
          ).length || 0);
        }, 0) || 0;

        this.results.failed = results.suites?.reduce((failed, suite) => {
          return failed + (suite.specs?.filter(spec =>
            spec.tests?.some(test => test.results?.some(result => result.status === 'failed'))
          ).length || 0);
        }, 0) || 0;

        this.results.skipped = results.suites?.reduce((skipped, suite) => {
          return skipped + (suite.specs?.filter(spec =>
            spec.tests?.some(test => test.results?.some(result => result.status === 'skipped'))
          ).length || 0);
        }, 0) || 0;

        this.results.duration = Date.now() - this.startTime;
      }
    } catch (error) {
      console.warn('Could not parse results:', error.message);
    }
  }

  async generateBadge(summary) {
    const status = summary.results.failed > 0 ? 'failing' : 'passing';
    const color = status === 'passing' ? 'brightgreen' : 'red';
    const badge = {
      schemaVersion: 1,
      label: 'tests',
      message: `${summary.results.passed}/${summary.results.total} passing`,
      color: color
    };

    fs.writeFileSync('test-results/badge.json', JSON.stringify(badge, null, 2));
    console.log('  ✓ Generated test badge');
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('📈 TEST EXECUTION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Mode: ${this.options.mode}`);
    console.log(`Browser: ${this.options.browser}`);
    console.log(`Environment: ${this.options.env}`);
    console.log(`Duration: ${((Date.now() - this.startTime) / 1000).toFixed(2)}s`);
    console.log('─'.repeat(50));
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⏭️ Skipped: ${this.results.skipped}`);
    console.log('─'.repeat(50));

    if (this.results.failed > 0) {
      console.log('❌ Some tests failed. Check the detailed report for more information.');
      console.log('📄 HTML Report: test-results/html-report/index.html');
      process.exit(1);
    } else {
      console.log('🎉 All tests passed successfully!');
      console.log('📄 HTML Report: test-results/html-report/index.html');
      process.exit(0);
    }
  }
}

// Execute the test runner
const runner = new TestRunner(argv);
runner.run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});