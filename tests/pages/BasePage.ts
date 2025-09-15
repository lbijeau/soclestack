import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Common navigation elements
  get navigation(): Locator {
    return this.page.locator('[data-testid="main-navigation"]');
  }

  get userMenu(): Locator {
    return this.page.locator('[data-testid="user-menu"]');
  }

  get logoutButton(): Locator {
    return this.page.locator('[data-testid="logout-button"]');
  }

  get loadingSpinner(): Locator {
    return this.page.locator('[data-testid="loading-spinner"]');
  }

  get errorMessage(): Locator {
    return this.page.locator('[data-testid="error-message"]');
  }

  get successMessage(): Locator {
    return this.page.locator('[data-testid="success-message"]');
  }

  // Common actions
  async navigateTo(path: string): Promise<void> {
    await this.page.goto(path);
    await this.waitForPageLoad();
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async waitForLoadingToComplete(): Promise<void> {
    // Wait for loading spinner to disappear if present
    const spinner = this.loadingSpinner;
    if (await spinner.isVisible()) {
      await spinner.waitFor({ state: 'hidden', timeout: 10000 });
    }
  }

  async logout(): Promise<void> {
    await this.userMenu.click();
    await this.logoutButton.click();
    await this.page.waitForURL('**/login');
  }

  async assertSuccessMessage(expectedMessage?: string): Promise<void> {
    await expect(this.successMessage).toBeVisible();
    if (expectedMessage) {
      await expect(this.successMessage).toContainText(expectedMessage);
    }
  }

  async assertErrorMessage(expectedMessage?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (expectedMessage) {
      await expect(this.errorMessage).toContainText(expectedMessage);
    }
  }

  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true
    });
  }

  async scrollToElement(selector: string): Promise<void> {
    await this.page.locator(selector).scrollIntoViewIfNeeded();
  }

  async fillFormField(selector: string, value: string): Promise<void> {
    const field = this.page.locator(selector);
    await field.clear();
    await field.fill(value);
  }

  async selectDropdownOption(selector: string, option: string): Promise<void> {
    await this.page.locator(selector).selectOption(option);
  }

  async uploadFile(selector: string, filePath: string): Promise<void> {
    await this.page.locator(selector).setInputFiles(filePath);
  }

  async clickAndWaitForNavigation(selector: string, expectedUrl?: string): Promise<void> {
    const [response] = await Promise.all([
      this.page.waitForNavigation(),
      this.page.locator(selector).click()
    ]);

    if (expectedUrl) {
      await this.page.waitForURL(expectedUrl);
    }
  }

  async assertPageTitle(expectedTitle: string): Promise<void> {
    await expect(this.page).toHaveTitle(expectedTitle);
  }

  async assertPageUrl(expectedUrl: string | RegExp): Promise<void> {
    if (typeof expectedUrl === 'string') {
      await expect(this.page).toHaveURL(expectedUrl);
    } else {
      await expect(this.page).toHaveURL(expectedUrl);
    }
  }

  async waitForApiResponse(urlPattern: string | RegExp, timeout: number = 30000): Promise<void> {
    await this.page.waitForResponse(urlPattern, { timeout });
  }

  async mockApiResponse(urlPattern: string | RegExp, responseData: any): Promise<void> {
    await this.page.route(urlPattern, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseData)
      });
    });
  }

  // Accessibility helpers
  async assertFocusedElement(selector: string): Promise<void> {
    await expect(this.page.locator(selector)).toBeFocused();
  }

  async navigateWithKeyboard(key: 'Tab' | 'Enter' | 'Space' | 'Escape'): Promise<void> {
    await this.page.keyboard.press(key);
  }

  // Mobile helpers
  async swipe(direction: 'left' | 'right' | 'up' | 'down'): Promise<void> {
    const viewport = this.page.viewportSize();
    if (!viewport) return;

    const { width, height } = viewport;
    let startX = width / 2;
    let startY = height / 2;
    let endX = startX;
    let endY = startY;

    switch (direction) {
      case 'left':
        endX = width * 0.1;
        break;
      case 'right':
        endX = width * 0.9;
        break;
      case 'up':
        endY = height * 0.1;
        break;
      case 'down':
        endY = height * 0.9;
        break;
    }

    await this.page.touchscreen.tap(startX, startY);
    await this.page.touchscreen.tap(endX, endY);
  }

  // Performance helpers
  async measurePageLoadTime(): Promise<number> {
    const startTime = Date.now();
    await this.waitForPageLoad();
    return Date.now() - startTime;
  }

  async getNetworkRequests(): Promise<any[]> {
    const requests: any[] = [];
    this.page.on('request', (request) => {
      requests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        timestamp: Date.now()
      });
    });
    return requests;
  }
}