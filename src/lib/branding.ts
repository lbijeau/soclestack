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

const VALID_AUTH_STYLES = ['centered', 'split', 'fullpage'] as const;
const VALID_NAV_STYLES = ['top', 'sidebar'] as const;
const VALID_DENSITIES = ['compact', 'comfortable'] as const;

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

function validateNavStyle(
  value: string | undefined
): LayoutConfig['navStyle'] {
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

function validateDensity(
  value: string | undefined
): LayoutConfig['density'] {
  if (value && VALID_DENSITIES.includes(value as LayoutConfig['density'])) {
    return value as LayoutConfig['density'];
  }
  if (value) {
    console.warn(
      `Invalid LAYOUT_DENSITY "${value}". Valid options: ${VALID_DENSITIES.join(', ')}. Using default "comfortable".`
    );
  }
  return 'comfortable';
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
    authStyle: validateAuthStyle(process.env.LAYOUT_AUTH_STYLE),
    navStyle: validateNavStyle(process.env.LAYOUT_NAV_STYLE),
    density: validateDensity(process.env.LAYOUT_DENSITY),
  };
}
