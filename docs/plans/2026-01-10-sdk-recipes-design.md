# SDK Recipes Design

## Overview

Two SDK recipes for common authentication patterns: Protected Routes and Role-Based UI.

## Recipe 1: Protected Routes

Protect routes from unauthenticated users with automatic redirects to login. Supports Next.js App Router, Pages Router, and React Router.

### Usage

```typescript
// Wrap any component to require auth
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>

// With role requirements
<ProtectedRoute roles={['ROLE_ADMIN']}>
  <AdminPanel />
</ProtectedRoute>
```

### Behaviors

- Shows loading spinner while checking auth
- Redirects to `/login?returnUrl=...` if unauthenticated
- Optionally checks for specific roles
- Preserves the original URL for post-login redirect

### Core Implementation

```typescript
// packages/react/src/components/ProtectedRoute.tsx
import { useAuth } from '../hooks';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
  fallback?: React.ReactNode;
  loginPath?: string;
}

export function ProtectedRoute({
  children,
  roles,
  fallback = <LoadingSpinner />,
  loginPath = '/login',
}: ProtectedRouteProps) {
  const { status, user } = useAuth();

  // Loading state
  if (status === 'loading') {
    return <>{fallback}</>;
  }

  // Not authenticated - redirect handled by hook or parent
  if (status !== 'authenticated' || !user) {
    return null;
  }

  // Role check (if specified)
  if (roles && roles.length > 0) {
    const userRoles = user.roles || [];
    const hasRole = roles.some((r) => userRoles.includes(r));
    if (!hasRole) {
      return <AccessDenied />;
    }
  }

  return <>{children}</>;
}
```

### Redirect Hook

```typescript
// packages/react/src/hooks/useAuthRedirect.ts
import { useEffect } from 'react';
import { useAuth } from './useAuth';

interface UseAuthRedirectOptions {
  loginPath?: string;
  onRedirect?: (url: string) => void; // Framework-agnostic redirect
}

export function useAuthRedirect({
  loginPath = '/login',
  onRedirect,
}: UseAuthRedirectOptions = {}) {
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'unauthenticated' && onRedirect) {
      const currentPath = typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : '/';
      const returnUrl = encodeURIComponent(currentPath);
      onRedirect(`${loginPath}?returnUrl=${returnUrl}`);
    }
  }, [status, loginPath, onRedirect]);

  return { status };
}
```

### Next.js App Router Integration

```typescript
// recipes/nextjs-app-router/ProtectedRoute.tsx
'use client';

import { useRouter } from 'next/navigation';
import { ProtectedRoute as BaseProtectedRoute } from '@soclestack/react';
import { useAuthRedirect } from '@soclestack/react';

export function ProtectedRoute({
  children,
  roles,
  loginPath = '/login',
}: {
  children: React.ReactNode;
  roles?: string[];
  loginPath?: string;
}) {
  const router = useRouter();

  useAuthRedirect({
    loginPath,
    onRedirect: (url) => router.push(url),
  });

  return (
    <BaseProtectedRoute roles={roles}>
      {children}
    </BaseProtectedRoute>
  );
}

// Usage in app/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
```

---

## Recipe 2: Role-Based UI

Conditionally render UI elements based on user roles or permissions.

### Usage

```typescript
// Show only to admins
<Can roles={['ROLE_ADMIN']}>
  <DeleteButton />
</Can>

// Show only to org owners/admins
<Can orgRoles={['ROLE_OWNER', 'ROLE_ADMIN']}>
  <InviteMemberButton />
</Can>

// Fallback for unauthorized
<Can roles={['ROLE_ADMIN']} fallback={<UpgradePrompt />}>
  <PremiumFeature />
</Can>

// Hook for programmatic checks
const { can } = usePermissions();
if (can({ roles: ['ROLE_ADMIN'] })) {
  // ...
}
```

### Behaviors

- Check global user roles (system-wide)
- Check organization roles (within current org)
- Optional fallback content
- Hook for logic outside JSX

### Permissions Hook

```typescript
// packages/react/src/hooks/usePermissions.ts
import { useAuth, useOrganization } from './hooks';

interface CanOptions {
  roles?: string[];      // Global user roles
  orgRoles?: string[];   // Organization-specific roles
}

export function usePermissions() {
  const { user } = useAuth();
  const { organization } = useOrganization();

  const can = ({ roles, orgRoles }: CanOptions): boolean => {
    if (!user) return false;

    // Check global roles
    if (roles && roles.length > 0) {
      const userRoles = user.roles || [];
      if (!roles.some((r) => userRoles.includes(r))) {
        return false;
      }
    }

    // Check org roles
    if (orgRoles && orgRoles.length > 0) {
      const userOrgRole = organization?.role;
      if (!userOrgRole || !orgRoles.includes(userOrgRole)) {
        return false;
      }
    }

    return true;
  };

  return { can, user, organization };
}
```

### Can Component

```typescript
// packages/react/src/components/Can.tsx
import { usePermissions } from '../hooks/usePermissions';

interface CanProps {
  children: React.ReactNode;
  roles?: string[];
  orgRoles?: string[];
  fallback?: React.ReactNode;
}

export function Can({
  children,
  roles,
  orgRoles,
  fallback = null
}: CanProps) {
  const { can } = usePermissions();

  if (can({ roles, orgRoles })) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
```

### Usage Examples

```typescript
// Dashboard with role-based sections
function Dashboard() {
  const { can } = usePermissions();

  return (
    <div>
      <h1>Dashboard</h1>

      {/* Admin-only stats */}
      <Can roles={['ROLE_ADMIN']}>
        <AdminStatsPanel />
      </Can>

      {/* Org owner/admin can manage team */}
      <Can orgRoles={['ROLE_OWNER', 'ROLE_ADMIN']} fallback={<ViewOnlyBadge />}>
        <TeamManagement />
      </Can>

      {/* Programmatic check for complex logic */}
      {can({ roles: ['ROLE_ADMIN'] }) && (
        <Button onClick={handleDangerousAction}>
          Danger Zone
        </Button>
      )}
    </div>
  );
}
```

---

---

## Recipe 3: Organization Switcher

Dropdown component that lets users switch between organizations they belong to. Essential for multi-tenant apps.

### Usage

```typescript
// Basic usage
<OrganizationSwitcher />

// With custom trigger
<OrganizationSwitcher
  trigger={<Button>Switch Org</Button>}
/>

// With callbacks
<OrganizationSwitcher
  onSwitch={(org) => router.push(`/org/${org.slug}`)}
/>

// With create link
<OrganizationSwitcher
  showCreateLink
  createOrgUrl="/organizations/new"
/>
```

### Behaviors

- Shows current org name with dropdown arrow
- Lists all orgs the user belongs to
- Shows role badge for each org (Owner/Admin/Member)
- Highlights currently selected org
- Calls `switchOrganization()` from SDK on selection
- Optional "Create Organization" link at bottom

### useOrganizations Hook

```typescript
// packages/react/src/hooks/useOrganizations.ts
import { useState, useEffect, useCallback } from 'react';
import { useSocleContext } from '../provider';
import type { Organization } from '@soclestack/core';

export function useOrganizations() {
  const { client, state } = useSocleContext();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentOrg = state.status === 'authenticated'
    ? state.organization ?? null
    : null;

  useEffect(() => {
    if (state.status === 'authenticated') {
      client.rawApi.getOrganizations()
        .then(setOrganizations)
        .finally(() => setIsLoading(false));
    }
  }, [client, state.status]);

  const switchOrganization = useCallback(async (orgId: string) => {
    await client.switchOrganization(orgId);
    const org = organizations.find(o => o.id === orgId);
    return org ?? null;
  }, [client, organizations]);

  return {
    organizations,
    currentOrganization: currentOrg,
    switchOrganization,
    isLoading,
  };
}
```

### OrganizationSwitcher Component

```typescript
// packages/react/src/components/OrganizationSwitcher.tsx
import { useState, useRef, useEffect, type ReactNode, type CSSProperties } from 'react';
import { useOrganizations } from '../hooks/useOrganizations';
import type { Organization } from '@soclestack/core';

export interface OrganizationSwitcherProps {
  /** Custom trigger element */
  trigger?: ReactNode;
  /** Called after switching orgs */
  onSwitch?: (org: Organization) => void;
  /** Show "Create Organization" link */
  showCreateLink?: boolean;
  /** URL for create org link */
  createOrgUrl?: string;
  /** Additional class name */
  className?: string;
}

export function OrganizationSwitcher({
  trigger,
  onSwitch,
  showCreateLink = false,
  createOrgUrl = '/organizations/new',
  className,
}: OrganizationSwitcherProps) {
  const { organizations, currentOrganization, switchOrganization, isLoading } = useOrganizations();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (org: Organization) => {
    if (org.id === currentOrganization?.id) {
      setIsOpen(false);
      return;
    }
    const switched = await switchOrganization(org.id);
    setIsOpen(false);
    if (switched) onSwitch?.(switched);
  };

  if (isLoading) return null;
  if (organizations.length === 0) return null;

  return (
    <div ref={dropdownRef} className={className} style={{ position: 'relative' }}>
      <button onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>
        {trigger ?? <DefaultTrigger org={currentOrganization} />}
      </button>

      {isOpen && (
        <div role="menu" style={dropdownStyles}>
          {organizations.map((org) => (
            <OrgItem
              key={org.id}
              org={org}
              isSelected={org.id === currentOrganization?.id}
              onSelect={() => handleSelect(org)}
            />
          ))}
          {showCreateLink && (
            <a href={createOrgUrl} style={createLinkStyles}>
              + Create Organization
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// Sub-components

function DefaultTrigger({ org }: { org: Organization | null }) {
  return (
    <span style={triggerStyles}>
      {org?.name ?? 'Select Organization'}
      <ChevronDown />
    </span>
  );
}

function OrgItem({
  org,
  isSelected,
  onSelect,
}: {
  org: Organization;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      role="menuitem"
      onClick={onSelect}
      style={{
        ...itemStyles,
        backgroundColor: isSelected ? '#f3f4f6' : 'transparent',
      }}
    >
      <span style={orgNameStyles}>{org.name}</span>
      {org.role && <RoleBadge role={org.role} />}
      {isSelected && <CheckIcon />}
    </button>
  );
}

function RoleBadge({ role }: { role: string }) {
  const label = role.replace('ROLE_', '').toLowerCase();
  const colors: Record<string, string> = {
    owner: '#7c3aed',
    admin: '#2563eb',
    member: '#6b7280',
  };
  return (
    <span style={{
      ...badgeStyles,
      backgroundColor: colors[label] ?? '#6b7280',
    }}>
      {label}
    </span>
  );
}

function ChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ marginLeft: 4 }}>
      <path d="M4.5 6L8 9.5L11.5 6" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ marginLeft: 'auto' }}>
      <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

// Styles
const triggerStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '8px 12px',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  backgroundColor: 'white',
  cursor: 'pointer',
};

const dropdownStyles: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 4,
  minWidth: 200,
  backgroundColor: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
  zIndex: 50,
};

const itemStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '8px 12px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  textAlign: 'left',
};

const orgNameStyles: CSSProperties = {
  fontWeight: 500,
};

const badgeStyles: CSSProperties = {
  fontSize: 11,
  padding: '2px 6px',
  borderRadius: 4,
  color: 'white',
  marginLeft: 8,
};

const createLinkStyles: CSSProperties = {
  display: 'block',
  padding: '8px 12px',
  borderTop: '1px solid #e5e7eb',
  color: '#6366f1',
  textDecoration: 'none',
  fontSize: 14,
};
```

---

## Files to Create

| File | Description |
|------|-------------|
| `packages/react/src/components/ProtectedRoute.tsx` | Base protected route component |
| `packages/react/src/components/Can.tsx` | Role-based UI component |
| `packages/react/src/hooks/useAuthRedirect.ts` | Redirect hook for unauthenticated users |
| `packages/react/src/hooks/usePermissions.ts` | Permissions checking hook |
| `packages/react/src/components/AccessDenied.tsx` | Default access denied component |
| `packages/react/src/components/LoadingSpinner.tsx` | Default loading component |
| `packages/react/src/hooks/useOrganizations.ts` | Organizations list and switch hook |
| `packages/react/src/components/OrganizationSwitcher.tsx` | Org switcher dropdown component |

## Exports to Add

```typescript
// packages/react/src/index.ts
export { ProtectedRoute } from './components/ProtectedRoute';
export { Can } from './components/Can';
export { useAuthRedirect } from './hooks/useAuthRedirect';
export { usePermissions } from './hooks/usePermissions';
export { useOrganizations } from './hooks/useOrganizations';
export { OrganizationSwitcher } from './components/OrganizationSwitcher';
```
