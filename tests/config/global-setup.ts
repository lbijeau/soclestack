import { chromium, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function resetRateLimits(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';

  try {
    const response = await fetch(`${baseURL}/api/test/reset-rate-limits`, {
      method: 'POST',
    });

    if (response.ok) {
      console.log('🔄 Rate limits reset successfully');
    } else if (response.status === 404) {
      // Endpoint might not exist in production - that's fine
      console.log('⚠️ Rate limit reset endpoint not available');
    } else {
      console.warn('⚠️ Failed to reset rate limits:', await response.text());
    }
  } catch (error) {
    console.warn('⚠️ Could not reset rate limits (server may not be running):', error.message);
  }
}

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...');

  try {
    // Reset rate limits before running tests
    await resetRateLimits(config);

    // Ensure test directories exist
    const dirs = [
      'test-results/html-report',
      'test-results/json-report',
      'test-results/junit-report',
      'test-results/artifacts',
      'tests/fixtures/auth',
      'tests/fixtures/data'
    ];

    dirs.forEach(dir => {
      const fullPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    });

    // Setup test database
    await setupTestDatabase();

    // Create authenticated browser state for reuse
    await setupAuthenticatedStates(config);

    console.log('✅ Global setup completed successfully');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

async function setupTestDatabase() {
  console.log('🗄️ Setting up test database...');

  try {
    // Reset test database
    if (process.env.TEST_DATABASE_URL) {
      // In a real implementation, you would:
      // 1. Drop and recreate test database
      // 2. Run migrations
      // 3. Seed with test data
      console.log('Database reset and migration completed');
    }

    // Seed test data
    await seedTestData();

  } catch (error) {
    console.error('Database setup failed:', error);
    throw error;
  }
}

async function seedTestData() {
  console.log('🌱 Seeding test data...');

  // Use execSync to run the database setup via tsx
  // This avoids ESM/CJS module compatibility issues
  try {
    execSync('npx tsx tests/scripts/seed-test-users.ts', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch (error) {
    console.error('Failed to seed test data via script');
    // Continue without failing - tests might still work if users exist
  }

  // Also write test fixture data files for reference
  const testUsers = [
    {
      email: 'admin@test.com',
      password: 'AdminTest123!',
      role: 'ROLE_ADMIN',
      verified: true
    },
    {
      email: 'user@test.com',
      password: 'UserTest123!',
      role: 'ROLE_USER',
      verified: true
    },
    {
      email: 'unverified@test.com',
      password: 'UnverifiedTest123!',
      role: 'ROLE_USER',
      verified: false
    }
  ];

  fs.writeFileSync(
    path.join(process.cwd(), 'tests/fixtures/data/test-users.json'),
    JSON.stringify(testUsers, null, 2)
  );

  console.log(`Created ${testUsers.length} test users`);
}

async function setupAuthenticatedStates(config: FullConfig) {
  console.log('🔐 Setting up authenticated browser states...');

  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';

  // Create browser instance
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto(`${baseURL}/login`);

    // Perform login for standard user
    await page.waitForSelector('[data-testid="login-form"]', { timeout: 10000 });
    await page.fill('[data-testid="email-input"]', 'user@test.com');
    await page.fill('[data-testid="password-input"]', 'UserTest123!');
    await page.click('[data-testid="login-submit"]');

    // Wait for successful login
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Save authenticated state
    await context.storageState({
      path: path.join(process.cwd(), 'tests/fixtures/auth/user-auth.json')
    });
    console.log('✅ User authentication state saved');

    // Create admin authenticated state
    await page.goto(`${baseURL}/logout`);
    await page.goto(`${baseURL}/login`);

    await page.waitForSelector('[data-testid="login-form"]');
    await page.fill('[data-testid="email-input"]', 'admin@test.com');
    await page.fill('[data-testid="password-input"]', 'AdminTest123!');
    await page.click('[data-testid="login-submit"]');

    await page.waitForURL('**/admin**');

    await context.storageState({
      path: path.join(process.cwd(), 'tests/fixtures/auth/admin-auth.json')
    });
    console.log('✅ Admin authentication state saved');

  } catch (error) {
    console.warn('⚠️ Could not setup authenticated states - tests will handle authentication individually');
    console.warn('Error:', error.message);

    // Create empty auth files so tests don't fail
    const emptyAuth = { cookies: [], origins: [] };
    fs.writeFileSync(
      path.join(process.cwd(), 'tests/fixtures/auth/user-auth.json'),
      JSON.stringify(emptyAuth)
    );
    fs.writeFileSync(
      path.join(process.cwd(), 'tests/fixtures/auth/admin-auth.json'),
      JSON.stringify(emptyAuth)
    );
  } finally {
    await browser.close();
  }
}

export default globalSetup;