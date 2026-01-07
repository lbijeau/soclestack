# Theming & Branding Design

**Date:** 2026-01-06
**Status:** Draft
**Author:** Architecture Brainstorm

## Executive Summary

Instance-level branding via environment variables and static assets. Supports custom app name, logo, colors, and layout variants. Designed for future org-level branding without rewrite.

## Problem Statement

Different SocleStack deployments need their own branding - logos, colors, app name. Currently hardcoded with no customization path.

**Scope:**
- Instance-level branding (env vars + static assets)
- Layout variants (auth flows, navigation, density)
- Future-proof for org-level branding

**Out of scope (for now):**
- Org-level branding (DB schema, admin UI)
- Mobile-specific redesign
- Full typography customization

## Configuration

### Environment Variables

```bash
# Branding
BRAND_NAME="My App"              # Title, emails, footer
BRAND_LOGO_URL="/logo.svg"       # Header logo (relative or absolute)
BRAND_FAVICON_URL="/favicon.ico"
BRAND_PRIMARY_COLOR="#3b82f6"    # Buttons, links, accents

# Layouts
LAYOUT_AUTH_STYLE="centered"     # centered | split | fullpage
LAYOUT_NAV_STYLE="top"           # top | sidebar
LAYOUT_DENSITY="comfortable"     # compact | comfortable
```

### Branding Module

```typescript
// src/lib/branding.ts

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

export function getBranding(orgId?: string): BrandingConfig {
  // Future: check DB for org-specific branding first
  return {
    name: process.env.BRAND_NAME ?? 'SocleStack',
    logoUrl: process.env.BRAND_LOGO_URL ?? '/logo.svg',
    faviconUrl: process.env.BRAND_FAVICON_URL ?? '/favicon.ico',
    primaryColor: process.env.BRAND_PRIMARY_COLOR ?? '#3b82f6',
  };
}

export function getLayout(): LayoutConfig {
  return {
    authStyle: (process.env.LAYOUT_AUTH_STYLE as LayoutConfig['authStyle']) ?? 'centered',
    navStyle: (process.env.LAYOUT_NAV_STYLE as LayoutConfig['navStyle']) ?? 'top',
    density: (process.env.LAYOUT_DENSITY as LayoutConfig['density']) ?? 'comfortable',
  };
}
```

## Layout Variants

### Auth Styles

| Style | Description | Use Case |
|-------|-------------|----------|
| `centered` | Card centered on page | Default, clean |
| `split` | Two-column: form + hero image | Marketing-focused |
| `fullpage` | Form takes full width | Minimal, embedded |

### Navigation Styles

| Style | Description | Use Case |
|-------|-------------|----------|
| `top` | Horizontal navbar | Default, familiar |
| `sidebar` | Collapsible left sidebar | Admin-heavy apps |

### Density Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `comfortable` | Standard spacing | Default |
| `compact` | Tighter padding, smaller text | Data-dense admin UIs |

## Implementation Architecture

### CSS Variables

Brand colors injected at runtime via root layout:

```typescript
// src/app/layout.tsx
import { getBranding, getLayout } from '@/lib/branding';
import { darken, lighten } from '@/lib/color-utils';

export default function RootLayout({ children }) {
  const branding = getBranding();
  const layout = getLayout();

  return (
    <html
      style={{
        '--brand-primary': branding.primaryColor,
        '--brand-primary-hover': darken(branding.primaryColor, 10),
        '--brand-primary-light': lighten(branding.primaryColor, 40),
      }}
    >
      <body data-density={layout.density}>
        {children}
      </body>
    </html>
  );
}
```

### globals.css Updates

```css
@import 'tailwindcss';

:root {
  --background: #ffffff;
  --foreground: #171717;
  /* Brand colors injected via style attribute */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-brand-primary: var(--brand-primary);
  --color-brand-primary-hover: var(--brand-primary-hover);
  --color-brand-primary-light: var(--brand-primary-light);
}

/* Density modes */
[data-density="compact"] {
  --spacing-unit: 0.75rem;
  --text-base: 0.875rem;
}

[data-density="comfortable"] {
  --spacing-unit: 1rem;
  --text-base: 1rem;
}
```

### Layout Components

Auth pages use `AuthLayout` wrapper that switches variants:

```typescript
// src/components/layouts/auth-layout.tsx
import { getLayout } from '@/lib/branding';
import { AuthCentered } from './auth-centered';
import { AuthSplit } from './auth-split';
import { AuthFullpage } from './auth-fullpage';

export function AuthLayout({ children }: { children: React.ReactNode }) {
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

Authenticated pages use `AppLayout` for navigation:

```typescript
// src/components/layouts/app-layout.tsx
import { getLayout } from '@/lib/branding';
import { NavTop } from './nav-top';
import { NavSidebar } from './nav-sidebar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { navStyle } = getLayout();

  if (navStyle === 'sidebar') {
    return <NavSidebar>{children}</NavSidebar>;
  }

  return <NavTop>{children}</NavTop>;
}
```

## File Structure

```
src/
├── lib/
│   ├── branding.ts              # NEW: Config exports
│   └── color-utils.ts           # NEW: darken/lighten helpers
├── app/
│   ├── globals.css              # MODIFY: Add brand CSS variables
│   └── layout.tsx               # MODIFY: Inject colors, density
├── components/
│   └── layouts/
│       ├── auth-layout.tsx      # NEW: Auth wrapper (switches variants)
│       ├── auth-centered.tsx    # NEW: Centered card layout
│       ├── auth-split.tsx       # NEW: Split screen layout
│       ├── auth-fullpage.tsx    # NEW: Full page layout
│       ├── app-layout.tsx       # NEW: App wrapper (switches nav)
│       ├── nav-top.tsx          # EXTRACT: Current navbar
│       └── nav-sidebar.tsx      # NEW: Sidebar variant
public/
├── logo.svg                     # Default logo
└── favicon.ico                  # Default favicon
.env.example                     # MODIFY: Add branding vars
```

## Component Updates

Existing components reference brand colors instead of hardcoded values:

```typescript
// Before
<button className="bg-blue-600 hover:bg-blue-700">

// After
<button className="bg-brand-primary hover:bg-brand-primary-hover">
```

## Future: Org-Level Branding

The `getBranding(orgId?)` abstraction allows org-level branding later:

1. Add `OrganizationBranding` table:
   ```prisma
   model OrganizationBranding {
     id           String  @id @default(cuid())
     organizationId String @unique
     name         String?
     logoUrl      String?
     primaryColor String?
     organization Organization @relation(fields: [organizationId], references: [id])
   }
   ```

2. Update `getBranding()` to check DB first:
   ```typescript
   export async function getBranding(orgId?: string): Promise<BrandingConfig> {
     if (orgId) {
       const orgBranding = await prisma.organizationBranding.findUnique({
         where: { organizationId: orgId },
       });
       if (orgBranding) {
         return {
           name: orgBranding.name ?? instanceBranding.name,
           logoUrl: orgBranding.logoUrl ?? instanceBranding.logoUrl,
           // ... merge with instance defaults
         };
       }
     }
     return instanceBranding;
   }
   ```

3. Components already use `getBranding()` - no changes needed.

**Not building now:** DB schema, admin UI, logo upload.

## Success Criteria

- [ ] Deployer can set app name, logo, colors via env vars
- [ ] Auth pages support three layout variants
- [ ] Navigation supports top and sidebar modes
- [ ] Density mode affects spacing throughout app
- [ ] Existing components use brand colors
- [ ] Future org-level branding requires minimal changes

---

Generated with [Claude Code](https://claude.ai/code)
