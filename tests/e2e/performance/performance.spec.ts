import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { RegistrationPage } from '../../pages/RegistrationPage';
import { ExtendedProfilePage as ProfilePage } from '../../pages/ExtendedProfilePage';
import { AuthHelpers } from '../../utils/auth-helpers';
import { DatabaseHelpers } from '../../utils/database-helpers';
import { TestDataFactory } from '../../utils/test-data-factory';

test.describe('Performance Tests', () => {
  test.beforeEach(async () => {
    await DatabaseHelpers.setupTestUsers();
  });

  test.describe('Page Load Performance', () => {
    test('should load login page within acceptable time', async ({ page }) => {
      const loginPage = new LoginPage(page);

      const performance = await test.step('Measure login page load time', async () => {
        return await loginPage.measureLoginPerformance();
      });

      await test.step('Verify performance benchmarks', async () => {
        const expectedTimes = TestDataFactory.createPerformanceTestData().expectedResponseTimes;

        expect(performance.formLoadTime).toBeLessThan(expectedTimes.login);
        expect(performance.totalTime).toBeLessThan(expectedTimes.login * 1.5);

        console.log('Login Page Performance:', {
          formLoadTime: `${performance.formLoadTime}ms`,
          loginSubmissionTime: `${performance.loginSubmissionTime}ms`,
          totalTime: `${performance.totalTime}ms`,
        });
      });
    });

    test('should load registration page within acceptable time', async ({ page }) => {
      const registrationPage = new RegistrationPage(page);

      const performance = await test.step('Measure registration page performance', async () => {
        return await registrationPage.measureRegistrationPerformance();
      });

      await test.step('Verify registration performance', async () => {
        const expectedTimes = TestDataFactory.createPerformanceTestData().expectedResponseTimes;

        expect(performance.formLoadTime).toBeLessThan(expectedTimes.registration);
        expect(performance.submissionTime).toBeLessThan(expectedTimes.registration);

        console.log('Registration Page Performance:', {
          formLoadTime: `${performance.formLoadTime}ms`,
          validationTime: `${performance.validationTime}ms`,
          submissionTime: `${performance.submissionTime}ms`,
          totalTime: `${performance.totalTime}ms`,
        });
      });
    });

    test('should load profile page within acceptable time', async ({ page }) => {
      const profilePage = new ProfilePage(page);

      await AuthHelpers.loginAsUser(page);

      const performance = await test.step('Measure profile page performance', async () => {
        return await profilePage.measureProfileUpdatePerformance();
      });

      await test.step('Verify profile performance', async () => {
        const expectedTimes = TestDataFactory.createPerformanceTestData().expectedResponseTimes;

        expect(performance.pageLoadTime).toBeLessThan(expectedTimes.profileLoad);
        expect(performance.updateTime).toBeLessThan(expectedTimes.profileLoad);

        console.log('Profile Page Performance:', performance);
      });
    });
  });

  test.describe('Authentication Performance', () => {
    test('should handle login requests efficiently', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      const loginTimes: number[] = [];

      await test.step('Perform multiple login attempts', async () => {
        for (let i = 0; i < 5; i++) {
          const startTime = Date.now();

          await loginPage.login('user@test.com', 'UserTest123!');
          await page.waitForURL(/.*\/dashboard/);

          const loginTime = Date.now() - startTime;
          loginTimes.push(loginTime);

          await AuthHelpers.logout(page);
          await loginPage.goto();
        }
      });

      await test.step('Verify consistent login performance', async () => {
        const averageTime = loginTimes.reduce((a, b) => a + b, 0) / loginTimes.length;
        const maxTime = Math.max(...loginTimes);

        expect(averageTime).toBeLessThan(3000); // 3 seconds average
        expect(maxTime).toBeLessThan(5000); // 5 seconds max

        console.log('Login Performance Stats:', {
          average: `${averageTime.toFixed(0)}ms`,
          max: `${maxTime}ms`,
          min: `${Math.min(...loginTimes)}ms`,
          attempts: loginTimes.length,
        });
      });
    });

    test('should handle concurrent authentication requests', async ({ browser }) => {
      const concurrentLogins = 10;
      const contexts = [];
      const results = [];

      await test.step('Create concurrent browser contexts', async () => {
        for (let i = 0; i < concurrentLogins; i++) {
          const context = await browser.newContext();
          contexts.push(context);
        }
      });

      await test.step('Perform concurrent logins', async () => {
        const loginPromises = contexts.map(async (context, index) => {
          const page = await context.newPage();
          const startTime = Date.now();

          try {
            await AuthHelpers.loginAsUser(page);
            const duration = Date.now() - startTime;
            return { success: true, duration, index };
          } catch (error) {
            const duration = Date.now() - startTime;
            return { success: false, duration, index, error: error.message };
          }
        });

        const loginResults = await Promise.allSettled(loginPromises);
        results.push(...loginResults.map(result =>
          result.status === 'fulfilled' ? result.value : { success: false, error: result.reason }
        ));
      });

      await test.step('Verify concurrent performance', async () => {
        const successfulLogins = results.filter(r => r.success);
        const averageTime = successfulLogins.reduce((sum, r) => sum + r.duration, 0) / successfulLogins.length;

        expect(successfulLogins.length).toBeGreaterThan(concurrentLogins * 0.8); // 80% success rate
        expect(averageTime).toBeLessThan(10000); // 10 seconds under load

        console.log('Concurrent Login Performance:', {
          successful: successfulLogins.length,
          total: concurrentLogins,
          averageTime: `${averageTime.toFixed(0)}ms`,
        });
      });

      await test.step('Cleanup contexts', async () => {
        for (const context of contexts) {
          await context.close();
        }
      });
    });
  });

  test.describe('Database Performance', () => {
    test('should handle bulk user operations efficiently', async ({ page }) => {
      const userCount = TestDataFactory.createPerformanceTestData().bulkUserCount;

      await test.step('Create bulk test data', async () => {
        const startTime = Date.now();
        await DatabaseHelpers.createBulkTestData(userCount);
        const duration = Date.now() - startTime;

        console.log(`Created ${userCount} users in ${duration}ms`);
        expect(duration).toBeLessThan(30000); // 30 seconds for bulk creation
      });

      await test.step('Test admin user list performance', async ({ page }) => {
        await AuthHelpers.loginAsAdmin(page);

        const startTime = Date.now();
        await page.goto('/admin/users');
        await page.waitForSelector('[data-testid="user-list"]');
        await page.waitForLoadState('networkidle');
        const loadTime = Date.now() - startTime;

        expect(loadTime).toBeLessThan(TestDataFactory.createPerformanceTestData().expectedResponseTimes.userList);

        console.log(`User list with ${userCount} users loaded in ${loadTime}ms`);
      });
    });

    test('should handle search operations efficiently', async ({ page }) => {
      await AuthHelpers.loginAsAdmin(page);
      await page.goto('/admin/users');

      await test.step('Test user search performance', async () => {
        const searchQueries = ['admin', 'test', 'user', '@test.com'];

        for (const query of searchQueries) {
          const startTime = Date.now();

          await page.fill('[data-testid="user-search-input"]', query);
          await page.waitForSelector('[data-testid="search-results"]');
          await page.waitForLoadState('networkidle');

          const searchTime = Date.now() - startTime;
          expect(searchTime).toBeLessThan(2000); // 2 seconds for search

          console.log(`Search for "${query}" completed in ${searchTime}ms`);
        }
      });
    });
  });

  test.describe('Network Performance', () => {
    test('should minimize network requests', async ({ page }) => {
      const requests: any[] = [];

      page.on('request', request => {
        requests.push({
          url: request.url(),
          method: request.method(),
          resourceType: request.resourceType(),
        });
      });

      await test.step('Load login page and analyze requests', async () => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        const apiRequests = requests.filter(req => req.url.includes('/api/'));
        const staticRequests = requests.filter(req =>
          ['stylesheet', 'script', 'font', 'image'].includes(req.resourceType)
        );

        // Should minimize API calls on initial load
        expect(apiRequests.length).toBeLessThan(5);

        console.log('Network Requests Analysis:', {
          total: requests.length,
          api: apiRequests.length,
          static: staticRequests.length,
        });
      });
    });

    test('should handle slow network conditions', async ({ page, context }) => {
      // Simulate slow 3G network
      await context.route('**/*', async route => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Add 100ms delay
        await route.continue();
      });

      await test.step('Test login under slow network', async () => {
        const loginPage = new LoginPage(page);
        const startTime = Date.now();

        await loginPage.goto();
        await loginPage.login('user@test.com', 'UserTest123!');
        await page.waitForURL(/.*\/dashboard/);

        const totalTime = Date.now() - startTime;
        expect(totalTime).toBeLessThan(15000); // Should still work within 15 seconds

        console.log(`Login under slow network: ${totalTime}ms`);
      });
    });
  });

  test.describe('Memory Performance', () => {
    test('should not have memory leaks during form interactions', async ({ page }) => {
      const registrationPage = new RegistrationPage(page);
      await registrationPage.goto();

      await test.step('Perform repetitive form interactions', async () => {
        for (let i = 0; i < 50; i++) {
          await registrationPage.fillEmail(`test${i}@example.com`);
          await registrationPage.fillPassword('TestPassword123!');
          await registrationPage.fillConfirmPassword('TestPassword123!');

          // Clear and start over
          await registrationPage.fillEmail('');
          await registrationPage.fillPassword('');
          await registrationPage.fillConfirmPassword('');
        }
      });

      await test.step('Check for excessive DOM nodes', async () => {
        const elementCount = await page.locator('*').count();
        expect(elementCount).toBeLessThan(1000); // Reasonable DOM size

        console.log(`DOM element count after repetitive interactions: ${elementCount}`);
      });
    });
  });

  test.describe('Bundle Size Performance', () => {
    test('should have reasonable JavaScript bundle sizes', async ({ page }) => {
      const scriptSizes: { url: string; size: number }[] = [];

      page.on('response', async response => {
        if (response.url().endsWith('.js') && response.status() === 200) {
          try {
            const buffer = await response.body();
            scriptSizes.push({
              url: response.url(),
              size: buffer.length,
            });
          } catch {
            // Ignore if body can't be read
          }
        }
      });

      await test.step('Load application and analyze bundle sizes', async () => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        const totalSize = scriptSizes.reduce((sum, script) => sum + script.size, 0);
        const largestScript = scriptSizes.reduce((prev, current) =>
          prev.size > current.size ? prev : current, { size: 0, url: '' }
        );

        expect(totalSize).toBeLessThan(2 * 1024 * 1024); // 2MB total
        expect(largestScript.size).toBeLessThan(1 * 1024 * 1024); // 1MB largest

        console.log('Bundle Size Analysis:', {
          totalSize: `${(totalSize / 1024).toFixed(0)}KB`,
          largestScript: `${(largestScript.size / 1024).toFixed(0)}KB`,
          scriptCount: scriptSizes.length,
        });
      });
    });
  });

  test.describe('Rendering Performance', () => {
    test('should render pages efficiently', async ({ page }) => {
      await test.step('Measure Core Web Vitals', async () => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Measure First Contentful Paint and Largest Contentful Paint
        const metrics = await page.evaluate(() => {
          return new Promise(resolve => {
            new PerformanceObserver(list => {
              const entries = list.getEntries();
              const fcp = entries.find(entry => entry.name === 'first-contentful-paint');
              const lcp = entries.find(entry => entry.entryType === 'largest-contentful-paint');

              if (fcp && lcp) {
                resolve({
                  fcp: fcp.startTime,
                  lcp: lcp.startTime,
                });
              }
            }).observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
          });
        });

        if (metrics) {
          expect(metrics.fcp).toBeLessThan(2000); // 2 seconds FCP
          expect(metrics.lcp).toBeLessThan(2500); // 2.5 seconds LCP

          console.log('Core Web Vitals:', {
            fcp: `${metrics.fcp.toFixed(0)}ms`,
            lcp: `${metrics.lcp.toFixed(0)}ms`,
          });
        }
      });
    });

    test('should handle form rendering efficiently', async ({ page }) => {
      const registrationPage = new RegistrationPage(page);

      await test.step('Measure form rendering time', async () => {
        const startTime = Date.now();

        await registrationPage.goto();
        await registrationPage.waitForFormToLoad();

        const renderTime = Date.now() - startTime;
        expect(renderTime).toBeLessThan(1500); // 1.5 seconds

        console.log(`Registration form rendered in ${renderTime}ms`);
      });
    });
  });
});