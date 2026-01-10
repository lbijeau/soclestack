/**
 * Branding Configuration
 *
 * Reads instance-level branding and layout from environment variables.
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
}

const VALID_AUTH_STYLES = ['centered', 'split', 'fullpage'] as const;
const VALID_NAV_STYLES = ['top', 'sidebar'] as const;

function validateAuthStyle(
  value: string | undefined
): LayoutConfig['authStyle'] {
  if (value && VALID_AUTH_STYLES.includes(value as LayoutConfig['authStyle'])) {
    return value as LayoutConfig['authStyle'];
  }
  if (value) {
    console.warn(
      `Invalid LAYOUT_AUTH_STYLE "${value}". Valid options: ${VALID_AUTH_STYLES.join(', ')}. Using default "centered".`
    );
  }
  return 'centered';
}

function validateNavStyle(value: string | undefined): LayoutConfig['navStyle'] {
  if (value && VALID_NAV_STYLES.includes(value as LayoutConfig['navStyle'])) {
    return value as LayoutConfig['navStyle'];
  }
  if (value) {
    console.warn(
      `Invalid LAYOUT_NAV_STYLE "${value}". Valid options: ${VALID_NAV_STYLES.join(', ')}. Using default "top".`
    );
  }
  return 'top';
}

/**
 * Get branding configuration from environment variables
 */
export function getBranding(): BrandingConfig {
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
    authStyle: validateAuthStyle(process.env.LAYOUT_AUTH_STYLE),
    navStyle: validateNavStyle(process.env.LAYOUT_NAV_STYLE),
  };
}
