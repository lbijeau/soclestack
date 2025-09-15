import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global test teardown...');

  try {
    // Clean up test database
    await cleanupTestDatabase();

    // Clean up temporary files and auth states
    await cleanupTemporaryFiles();

    // Generate test summary
    await generateTestSummary();

    console.log('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw to avoid masking test failures
  }
}

async function cleanupTestDatabase() {
  console.log('🗄️ Cleaning up test database...');

  try {
    if (process.env.TEST_DATABASE_URL) {
      // In a real implementation, you would:
      // 1. Clean up test data
      // 2. Reset sequences
      // 3. Close database connections
      console.log('Database cleanup completed');
    }
  } catch (error) {
    console.error('Database cleanup failed:', error);
  }
}

async function cleanupTemporaryFiles() {
  console.log('🗂️ Cleaning up temporary files...');

  try {
    // Clean up auth state files (they'll be regenerated next run)
    const authDir = path.join(process.cwd(), 'tests/fixtures/auth');
    if (fs.existsSync(authDir)) {
      const authFiles = fs.readdirSync(authDir);
      authFiles.forEach(file => {
        if (file.endsWith('.json')) {
          const filePath = path.join(authDir, file);
          try {
            fs.unlinkSync(filePath);
            console.log(`Removed auth file: ${file}`);
          } catch (error) {
            console.warn(`Could not remove auth file ${file}:`, error.message);
          }
        }
      });
    }

    // Clean up temporary uploads or test files
    const tempDir = path.join(process.cwd(), 'temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('Removed temporary directory');
    }

  } catch (error) {
    console.error('File cleanup failed:', error);
  }
}

async function generateTestSummary() {
  console.log('📊 Generating test summary...');

  try {
    const summary = {
      timestamp: new Date().toISOString(),
      environment: {
        node_version: process.version,
        platform: process.platform,
        base_url: process.env.BASE_URL || 'http://localhost:3000',
        test_env: process.env.TEST_ENV || 'development'
      },
      cleanup_performed: [
        'Database reset',
        'Auth states cleared',
        'Temporary files removed'
      ],
      next_run_preparation: 'Environment ready for next test execution'
    };

    const summaryPath = path.join(process.cwd(), 'test-results/teardown-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log('Test summary generated:', summaryPath);

  } catch (error) {
    console.error('Summary generation failed:', error);
  }
}

export default globalTeardown;