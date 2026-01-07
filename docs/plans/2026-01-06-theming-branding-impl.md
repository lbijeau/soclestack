# Theming & Branding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add instance-level branding (name, logo, colors) and layout variants (auth styles, nav styles, density modes) configurable via environment variables.

**Architecture:** Config module reads env vars, injects CSS variables at runtime, layout components switch based on config.

**Tech Stack:** TypeScript, Tailwind CSS v4, React Server Components

**Design Document:** `docs/plans/2026-01-06-theming-branding-design.md`

---

## Phase 1: Core Configuration

### Task 1.1: Create Branding Configuration Module

**Files:**
- Create: `src/lib/branding.ts`
- Create: `tests/unit/branding.spec.ts`

**Step 1: Write failing tests**

Create `tests/unit/branding.spec.ts`:

```typescript
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
      expect(layout.density).toBe('comfortable');
    });

    it('should read layout options from environment', async () => {
      process.env.LAYOUT_AUTH_STYLE = 'split';
      process.env.LAYOUT_NAV_STYLE = 'sidebar';
      process.env.LAYOUT_DENSITY = 'compact';

      const { getLayout } = await import('@/lib/branding');
      const layout = getLayout();

      expect(layout.authStyle).toBe('split');
      expect(layout.navStyle).toBe('sidebar');
      expect(layout.density).toBe('compact');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/branding.spec.ts`
Expected: FAIL - module not found

**Step 3: Implement branding module**

Create `src/lib/branding.ts`:

```typescript
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
export function getBranding(orgId?: string): BrandingConfig {
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
    authStyle: (process.env.LAYOUT_AUTH_STYLE as LayoutConfig['authStyle']) ?? 'centered',
    navStyle: (process.env.LAYOUT_NAV_STYLE as LayoutConfig['navStyle']) ?? 'top',
    density: (process.env.LAYOUT_DENSITY as LayoutConfig['density']) ?? 'comfortable',
  };
}
```

**Step 4: Run tests**

Run: `npm run test:unit -- tests/unit/branding.spec.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/lib/branding.ts tests/unit/branding.spec.ts
git commit -m "feat(theming): add branding configuration module"
```

---

### Task 1.2: Create Color Utility Functions

**Files:**
- Create: `src/lib/color-utils.ts`
- Create: `tests/unit/color-utils.spec.ts`

**Step 1: Write failing tests**

Create `tests/unit/color-utils.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { darken, lighten, isValidHex } from '@/lib/color-utils';

describe('color-utils', () => {
  describe('isValidHex', () => {
    it('should validate 6-digit hex colors', () => {
      expect(isValidHex('#3b82f6')).toBe(true);
      expect(isValidHex('#FF0000')).toBe(true);
    });

    it('should validate 3-digit hex colors', () => {
      expect(isValidHex('#fff')).toBe(true);
      expect(isValidHex('#F00')).toBe(true);
    });

    it('should reject invalid colors', () => {
      expect(isValidHex('red')).toBe(false);
      expect(isValidHex('#gggggg')).toBe(false);
      expect(isValidHex('3b82f6')).toBe(false);
    });
  });

  describe('darken', () => {
    it('should darken a color by percentage', () => {
      const result = darken('#3b82f6', 10);
      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
      // Result should be darker (lower RGB values)
    });

    it('should return original for invalid hex', () => {
      expect(darken('invalid', 10)).toBe('invalid');
    });

    it('should clamp to black at 100%', () => {
      expect(darken('#ffffff', 100)).toBe('#000000');
    });
  });

  describe('lighten', () => {
    it('should lighten a color by percentage', () => {
      const result = lighten('#3b82f6', 10);
      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should return original for invalid hex', () => {
      expect(lighten('invalid', 10)).toBe('invalid');
    });

    it('should clamp to white at 100%', () => {
      expect(lighten('#000000', 100)).toBe('#ffffff');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/color-utils.spec.ts`
Expected: FAIL - module not found

**Step 3: Implement color utilities**

Create `src/lib/color-utils.ts`:

```typescript
/**
 * Color Utility Functions
 *
 * Derive secondary colors from primary brand color.
 */

/**
 * Check if a string is a valid hex color
 */
export function isValidHex(hex: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
}

/**
 * Normalize 3-digit hex to 6-digit
 */
function normalizeHex(hex: string): string {
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
}

/**
 * Parse hex color to RGB components
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!isValidHex(hex)) return null;

  const normalized = normalizeHex(hex);
  const result = /^#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/.exec(normalized);

  if (!result) return null;

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    return clamped.toString(16).padStart(2, '0');
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Darken a hex color by a percentage
 *
 * @param hex - Hex color (e.g., "#3b82f6")
 * @param percent - Amount to darken (0-100)
 * @returns Darkened hex color
 */
export function darken(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const factor = 1 - percent / 100;
  return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
}

/**
 * Lighten a hex color by a percentage
 *
 * @param hex - Hex color (e.g., "#3b82f6")
 * @param percent - Amount to lighten (0-100)
 * @returns Lightened hex color
 */
export function lighten(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const factor = percent / 100;
  return rgbToHex(
    rgb.r + (255 - rgb.r) * factor,
    rgb.g + (255 - rgb.g) * factor,
    rgb.b + (255 - rgb.b) * factor
  );
}
```

**Step 4: Run tests**

Run: `npm run test:unit -- tests/unit/color-utils.spec.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/lib/color-utils.ts tests/unit/color-utils.spec.ts
git commit -m "feat(theming): add color utility functions"
```

---

### Task 1.3: Update Environment Example

**Files:**
- Modify: `.env.example`

**Step 1: Add branding variables**

Add to `.env.example`:

```bash
# =============================================================================
# BRANDING
# =============================================================================

# App name shown in title, emails, footer
BRAND_NAME="SocleStack"

# Logo URL (relative to public/ or absolute URL)
BRAND_LOGO_URL="/logo.svg"

# Favicon URL
BRAND_FAVICON_URL="/favicon.ico"

# Primary brand color (hex)
BRAND_PRIMARY_COLOR="#3b82f6"

# =============================================================================
# LAYOUT
# =============================================================================

# Auth page layout: centered | split | fullpage
LAYOUT_AUTH_STYLE="centered"

# Navigation style: top | sidebar
LAYOUT_NAV_STYLE="top"

# UI density: compact | comfortable
LAYOUT_DENSITY="comfortable"
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add branding and layout env vars to .env.example"
```

---

## Phase 2: CSS Integration

### Task 2.1: Inject Brand CSS Variables in Root Layout

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Step 1: Update globals.css**

Add brand color theme variables to `src/app/globals.css`:

```css
@import 'tailwindcss';

:root {
  --background: #ffffff;
  --foreground: #171717;
  /* Brand colors injected via layout.tsx style attribute */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-brand-primary: var(--brand-primary, #3b82f6);
  --color-brand-primary-hover: var(--brand-primary-hover, #2563eb);
  --color-brand-primary-light: var(--brand-primary-light, #dbeafe);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

/* Density modes */
[data-density="compact"] {
  --spacing-base: 0.75rem;
  --text-size-base: 0.875rem;
}

[data-density="comfortable"] {
  --spacing-base: 1rem;
  --text-size-base: 1rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

**Step 2: Update root layout**

Update `src/app/layout.tsx` to inject brand colors:

```typescript
import type { Metadata } from 'next';
import { getBranding, getLayout } from '@/lib/branding';
import { darken, lighten } from '@/lib/color-utils';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const branding = getBranding();
  return {
    title: branding.name,
    icons: {
      icon: branding.faviconUrl,
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = getBranding();
  const layout = getLayout();

  const brandStyles = {
    '--brand-primary': branding.primaryColor,
    '--brand-primary-hover': darken(branding.primaryColor, 10),
    '--brand-primary-light': lighten(branding.primaryColor, 40),
  } as React.CSSProperties;

  return (
    <html lang="en" style={brandStyles}>
      <body data-density={layout.density}>
        {children}
      </body>
    </html>
  );
}
```

**Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat(theming): inject brand CSS variables in root layout"
```

---

### Task 2.2: Update Components to Use Brand Colors

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/input.tsx`

**Step 1: Update Button component**

Update `src/components/ui/button.tsx` to use brand colors for primary variant:

Replace hardcoded `bg-blue-*` classes with `bg-brand-primary` etc.

**Step 2: Update Input component**

Update `src/components/ui/input.tsx` focus ring to use brand color.

**Step 3: Visual verification**

Run: `npm run dev`
Verify buttons and inputs use brand color.

**Step 4: Commit**

```bash
git add src/components/ui/
git commit -m "feat(theming): update UI components to use brand colors"
```

---

## Phase 3: Layout Variants

### Task 3.1: Implement Auth Layout Variants

**Files:**
- Create: `src/components/layouts/auth-layout.tsx`
- Create: `src/components/layouts/auth-centered.tsx`
- Create: `src/components/layouts/auth-split.tsx`
- Create: `src/components/layouts/auth-fullpage.tsx`

**Step 1: Create AuthCentered (extract current)**

Create `src/components/layouts/auth-centered.tsx`:

```typescript
import { getBranding } from '@/lib/branding';

interface AuthCenteredProps {
  children: React.ReactNode;
}

export function AuthCentered({ children }: AuthCenteredProps) {
  const branding = getBranding();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <img
            src={branding.logoUrl}
            alt={branding.name}
            className="mx-auto h-12 w-auto"
          />
          <h1 className="mt-4 text-2xl font-bold">{branding.name}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
```

**Step 2: Create AuthSplit**

Create `src/components/layouts/auth-split.tsx`:

```typescript
import { getBranding } from '@/lib/branding';

interface AuthSplitProps {
  children: React.ReactNode;
}

export function AuthSplit({ children }: AuthSplitProps) {
  const branding = getBranding();

  return (
    <div className="min-h-screen flex">
      {/* Left: Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="h-10 w-auto"
            />
          </div>
          {children}
        </div>
      </div>
      {/* Right: Hero */}
      <div
        className="hidden lg:flex flex-1 items-center justify-center"
        style={{ backgroundColor: `var(--brand-primary-light)` }}
      >
        <div className="text-center p-8">
          <h2 className="text-3xl font-bold text-gray-800">
            Welcome to {branding.name}
          </h2>
          <p className="mt-2 text-gray-600">
            Secure authentication for your application
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Create AuthFullpage**

Create `src/components/layouts/auth-fullpage.tsx`:

```typescript
import { getBranding } from '@/lib/branding';

interface AuthFullpageProps {
  children: React.ReactNode;
}

export function AuthFullpage({ children }: AuthFullpageProps) {
  const branding = getBranding();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 border-b">
        <img
          src={branding.logoUrl}
          alt={branding.name}
          className="h-8 w-auto"
        />
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {children}
        </div>
      </main>
    </div>
  );
}
```

**Step 4: Create AuthLayout switcher**

Create `src/components/layouts/auth-layout.tsx`:

```typescript
import { getLayout } from '@/lib/branding';
import { AuthCentered } from './auth-centered';
import { AuthSplit } from './auth-split';
import { AuthFullpage } from './auth-fullpage';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { authStyle } = getLayout();

  switch (authStyle) {
    case 'split':
      return <AuthSplit>{children}</AuthSplit>;
    case 'fullpage':
      return <AuthFullpage>{children}</AuthFullpage>;
    default:
      return <AuthCentered>{children}</AuthCentered>;
  }
}
```

**Step 5: Update login page to use AuthLayout**

Update `src/app/login/page.tsx` to wrap content in `<AuthLayout>`.

**Step 6: Commit**

```bash
git add src/components/layouts/auth-*.tsx src/app/login/page.tsx
git commit -m "feat(theming): implement auth layout variants"
```

---

### Task 3.2: Implement Navigation Layout Variants

**Files:**
- Create: `src/components/layouts/app-layout.tsx`
- Create: `src/components/layouts/nav-top.tsx`
- Create: `src/components/layouts/nav-sidebar.tsx`
- Modify: `src/components/layouts/authenticated-layout.tsx`

**Step 1: Extract NavTop from current navbar**

Create `src/components/layouts/nav-top.tsx` - extract current navbar logic.

**Step 2: Create NavSidebar**

Create `src/components/layouts/nav-sidebar.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { getBranding } from '@/lib/branding';

interface NavSidebarProps {
  children: React.ReactNode;
}

export function NavSidebar({ children }: NavSidebarProps) {
  const branding = getBranding();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`bg-gray-900 text-white transition-all ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="p-4 flex items-center justify-between">
          {!collapsed && (
            <img src={branding.logoUrl} alt={branding.name} className="h-8" />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 hover:bg-gray-800 rounded"
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>
        <nav className="mt-4">
          {/* Navigation items */}
          <Link href="/dashboard" className="block px-4 py-2 hover:bg-gray-800">
            {collapsed ? '🏠' : 'Dashboard'}
          </Link>
          <Link href="/profile" className="block px-4 py-2 hover:bg-gray-800">
            {collapsed ? '👤' : 'Profile'}
          </Link>
          {/* Add more nav items */}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-50">
        {children}
      </main>
    </div>
  );
}
```

**Step 3: Create AppLayout switcher**

Create `src/components/layouts/app-layout.tsx`:

```typescript
import { getLayout } from '@/lib/branding';
import { NavTop } from './nav-top';
import { NavSidebar } from './nav-sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { navStyle } = getLayout();

  if (navStyle === 'sidebar') {
    return <NavSidebar>{children}</NavSidebar>;
  }

  return <NavTop>{children}</NavTop>;
}
```

**Step 4: Update authenticated layout**

Update `src/components/layouts/authenticated-layout.tsx` to use `AppLayout`.

**Step 5: Commit**

```bash
git add src/components/layouts/
git commit -m "feat(theming): implement navigation layout variants"
```

---

### Task 3.3: Add Default Branding Assets

**Files:**
- Create: `public/logo.svg`

**Step 1: Create default logo**

Create a simple default SVG logo at `public/logo.svg`.

**Step 2: Commit**

```bash
git add public/logo.svg
git commit -m "feat(theming): add default logo asset"
```

---

## Summary

This plan creates:

1. **Branding module** - Reads config from env vars
2. **Color utilities** - Derive hover/light variants
3. **CSS variables** - Brand colors injected at runtime
4. **Auth layouts** - Centered, split, fullpage variants
5. **Nav layouts** - Top navbar, sidebar variants
6. **Density modes** - Compact and comfortable spacing

Total tasks: 8 implementation tasks across 3 phases.
