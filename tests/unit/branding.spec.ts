import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('branding', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getBranding', () => {
    it('should return defaults when no env vars set', async () => {
      const { getBranding } = await import('@/lib/branding');
      const branding = getBranding();

      expect(branding.name).toBe('SocleStack');
      expect(branding.logoUrl).toBe('/logo.svg');
      expect(branding.faviconUrl).toBe('/favicon.ico');
      expect(branding.primaryColor).toBe('#3b82f6');
    });

    it('should read from environment variables', async () => {
      process.env.BRAND_NAME = 'My App';
      process.env.BRAND_LOGO_URL = '/custom-logo.png';
      process.env.BRAND_FAVICON_URL = '/custom-favicon.ico';
      process.env.BRAND_PRIMARY_COLOR = '#ff0000';

      const { getBranding } = await import('@/lib/branding');
      const branding = getBranding();

      expect(branding.name).toBe('My App');
      expect(branding.logoUrl).toBe('/custom-logo.png');
      expect(branding.faviconUrl).toBe('/custom-favicon.ico');
      expect(branding.primaryColor).toBe('#ff0000');
    });
  });

  describe('getLayout', () => {
    it('should return defaults when no env vars set', async () => {
      const { getLayout } = await import('@/lib/branding');
      const layout = getLayout();

      expect(layout.authStyle).toBe('centered');
      expect(layout.navStyle).toBe('top');
    });

    it('should read layout options from environment', async () => {
      process.env.LAYOUT_AUTH_STYLE = 'split';
      process.env.LAYOUT_NAV_STYLE = 'sidebar';

      const { getLayout } = await import('@/lib/branding');
      const layout = getLayout();

      expect(layout.authStyle).toBe('split');
      expect(layout.navStyle).toBe('sidebar');
    });

    it('should warn and use default for invalid LAYOUT_AUTH_STYLE', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.LAYOUT_AUTH_STYLE = 'invalid';

      const { getLayout } = await import('@/lib/branding');
      const layout = getLayout();

      expect(layout.authStyle).toBe('centered');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid LAYOUT_AUTH_STYLE "invalid"')
      );
      warnSpy.mockRestore();
    });

    it('should warn and use default for invalid LAYOUT_NAV_STYLE', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.LAYOUT_NAV_STYLE = 'invalid';

      const { getLayout } = await import('@/lib/branding');
      const layout = getLayout();

      expect(layout.navStyle).toBe('top');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid LAYOUT_NAV_STYLE "invalid"')
      );
      warnSpy.mockRestore();
    });
  });
});
