/**
 * Branding Configuration
 *
 * Reads instance-level branding from environment variables.
 * Future: Will support org-level branding from database.
 */

export interface BrandingConfig {
  name: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
}

export interface LayoutConfig {
  authStyle: 'centered' | 'split' | 'fullpage';
  navStyle: 'top' | 'sidebar';
  density: 'compact' | 'comfortable';
}

/**
 * Get branding configuration
 *
 * @param orgId - Future: org ID for org-specific branding
 * @returns Branding config (currently instance-level only)
 */
export function getBranding(_orgId?: string): BrandingConfig {
  // Future: Check DB for org-specific branding first
  return {
    name: process.env.BRAND_NAME ?? 'SocleStack',
    logoUrl: process.env.BRAND_LOGO_URL ?? '/logo.svg',
    faviconUrl: process.env.BRAND_FAVICON_URL ?? '/favicon.ico',
    primaryColor: process.env.BRAND_PRIMARY_COLOR ?? '#3b82f6',
  };
}

/**
 * Get layout configuration
 */
export function getLayout(): LayoutConfig {
  return {
    authStyle:
      (process.env.LAYOUT_AUTH_STYLE as LayoutConfig['authStyle']) ??
      'centered',
    navStyle:
      (process.env.LAYOUT_NAV_STYLE as LayoutConfig['navStyle']) ?? 'top',
    density:
      (process.env.LAYOUT_DENSITY as LayoutConfig['density']) ?? 'comfortable',
  };
}
