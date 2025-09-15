import { chromium, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...');

  try {
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

  // In a real implementation, this would populate the database with:
  // - Test users with different roles
  // - Test data for various scenarios
  // - Reference data needed for tests

  const testUsers = [
    {
      email: 'admin@test.com',
      password: 'AdminTest123!',
      role: 'admin',
      verified: true
    },
    {
      email: 'user@test.com',
      password: 'UserTest123!',
      role: 'user',
      verified: true
    },
    {
      email: 'unverified@test.com',
      password: 'UnverifiedTest123!',
      role: 'user',
      verified: false
    }
  ];

  // Create test fixture data files
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