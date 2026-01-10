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

## Recipe 4: Invite Accept Flow

Handle organization invite tokens - validate, display invite details, and accept membership.

### Usage

```typescript
// Basic usage with token from URL
<InviteAccept token={params.token} />

// With callbacks
<InviteAccept
  token={token}
  onAccepted={(org) => router.push(`/org/${org.slug}`)}
  onError={(error) => toast.error(error.message)}
/>

// Hook for custom UI
const { invite, status, accept, isAccepting } = useInvite(token);
```

### Behaviors

- Validates token on mount
- Shows invite details (org name, inviter, role)
- Handles error states: expired, invalid, already_used, already_member
- Prompts login if unauthenticated
- Accepts invite and joins organization

### Invite Types

```typescript
// packages/core/src/types.ts
export interface Invite {
  id: string;
  organizationId: string;
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
  role: 'ROLE_ADMIN' | 'ROLE_MEMBER';
  email: string;
  expiresAt: string;
}

export type InviteStatus = 'loading' | 'valid' | 'expired' | 'invalid' | 'already_used' | 'already_member';

export interface InviteResult {
  success: boolean;
  invite?: Invite;
  error?: string;
  status?: InviteStatus;
}

export interface AcceptInviteResult {
  success: boolean;
  organization?: Organization;
  error?: string;
}
```

### API Methods

```typescript
// packages/core/src/api.ts
async getInvite(token: string): Promise<InviteResult> {
  const { ok, data } = await this.request<{
    invite?: Invite;
    error?: string;
    status?: InviteStatus;
  }>(`/api/invites/${token}`);

  if (ok && data.invite) {
    return { success: true, invite: data.invite, status: 'valid' };
  }

  return {
    success: false,
    error: data.error ?? 'Invalid invite',
    status: data.status ?? 'invalid',
  };
}

async acceptInvite(token: string): Promise<AcceptInviteResult> {
  const { ok, data } = await this.request<{
    organization?: Organization;
    error?: string;
  }>(`/api/invites/${token}/accept`, { method: 'POST' });

  if (ok && data.organization) {
    return { success: true, organization: data.organization };
  }

  return { success: false, error: data.error ?? 'Failed to accept invite' };
}
```

### useInvite Hook

```typescript
// packages/react/src/hooks/useInvite.ts
import { useState, useEffect, useCallback } from 'react';
import { useSocleContext } from '../provider';
import type { Invite, InviteStatus, Organization } from '@soclestack/core';

export function useInvite(token: string) {
  const { client, state } = useSocleContext();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [status, setStatus] = useState<InviteStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  const isAuthenticated = state.status === 'authenticated';

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }

    client.rawApi.getInvite(token).then((result) => {
      if (result.success && result.invite) {
        setInvite(result.invite);
        setStatus('valid');
      } else {
        setError(result.error ?? 'Invalid invite');
        setStatus(result.status ?? 'invalid');
      }
    });
  }, [client, token]);

  const accept = useCallback(async (): Promise<Organization | null> => {
    if (!isAuthenticated) return null;

    setIsAccepting(true);
    try {
      const result = await client.rawApi.acceptInvite(token);
      if (result.success && result.organization) {
        return result.organization;
      }
      setError(result.error ?? 'Failed to accept invite');
      return null;
    } finally {
      setIsAccepting(false);
    }
  }, [client, token, isAuthenticated]);

  return {
    invite,
    status,
    error,
    isLoading: status === 'loading',
    isAccepting,
    isAuthenticated,
    accept,
  };
}
```

### InviteAccept Component

```typescript
// packages/react/src/components/InviteAccept.tsx
import { type ReactNode, type CSSProperties } from 'react';
import { useInvite } from '../hooks/useInvite';
import type { Organization } from '@soclestack/core';
import { LoadingSpinner } from './LoadingSpinner';

export interface InviteAcceptProps {
  token: string;
  onAccepted?: (org: Organization) => void;
  onError?: (error: Error) => void;
  loginUrl?: string;
  loadingFallback?: ReactNode;
  className?: string;
}

export function InviteAccept({
  token,
  onAccepted,
  onError,
  loginUrl = '/login',
  loadingFallback,
  className,
}: InviteAcceptProps) {
  const { invite, status, error, isLoading, isAccepting, isAuthenticated, accept } = useInvite(token);

  const handleAccept = async () => {
    const org = await accept();
    if (org) {
      onAccepted?.(org);
    } else if (error) {
      onError?.(new Error(error));
    }
  };

  if (isLoading) {
    return <>{loadingFallback ?? <LoadingSpinner />}</>;
  }

  if (status !== 'valid' || !invite) {
    return <ErrorState status={status} error={error} />;
  }

  return (
    <div className={className} style={containerStyles}>
      <InviteCard invite={invite} />
      {isAuthenticated ? (
        <button
          onClick={handleAccept}
          disabled={isAccepting}
          style={buttonStyles}
        >
          {isAccepting ? 'Joining...' : 'Accept Invite'}
        </button>
      ) : (
        <LoginPrompt loginUrl={loginUrl} token={token} />
      )}
    </div>
  );
}
```

---

## Recipe 5: Session Timeout Warning

Alert users before their session expires and let them extend it. Essential for apps with sensitive data or compliance requirements.

### Usage

```typescript
// Basic usage - shows warning 5 min before expiry
<SessionTimeoutWarning />

// Custom timing and callbacks
<SessionTimeoutWarning
  warnBefore={300}  // seconds before expiry to warn
  onTimeout={() => router.push('/login?expired=true')}
  onExtend={() => toast.success('Session extended')}
/>

// Hook for custom UI
const { timeRemaining, isWarning, extend, isExpired } = useSessionTimeout();
```

### Behaviors

- Tracks session expiry from JWT or server response
- Shows modal when `warnBefore` threshold reached
- User can extend (calls `refreshSession`)
- Auto-logout on expiry if not extended

### useSessionTimeout Hook

```typescript
// packages/react/src/hooks/useSessionTimeout.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocleContext } from '../provider';

export interface UseSessionTimeoutOptions {
  /** Seconds before expiry to trigger warning (default: 300) */
  warnBefore?: number;
  /** How often to check in seconds (default: 30) */
  checkInterval?: number;
  /** Called when warning threshold reached */
  onWarning?: () => void;
  /** Called when session expires */
  onTimeout?: () => void;
}

export function useSessionTimeout({
  warnBefore = 300,
  checkInterval = 30,
  onWarning,
  onTimeout,
}: UseSessionTimeoutOptions = {}) {
  const { client, state } = useSocleContext();
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isWarning, setIsWarning] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const warningFiredRef = useRef(false);

  // Get expiry time from session
  const getExpiryTime = useCallback((): number | null => {
    if (state.status !== 'authenticated') return null;
    // Assume session has expiresAt field or calculate from JWT
    const expiresAt = (state as any).expiresAt;
    if (!expiresAt) return null;
    return Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
  }, [state]);

  useEffect(() => {
    if (state.status !== 'authenticated') {
      setTimeRemaining(null);
      setIsWarning(false);
      setIsExpired(false);
      return;
    }

    const check = () => {
      const remaining = getExpiryTime();
      setTimeRemaining(remaining);

      if (remaining === null) return;

      if (remaining <= 0) {
        setIsExpired(true);
        onTimeout?.();
      } else if (remaining <= warnBefore && !warningFiredRef.current) {
        setIsWarning(true);
        warningFiredRef.current = true;
        onWarning?.();
      }
    };

    check();
    const interval = setInterval(check, checkInterval * 1000);
    return () => clearInterval(interval);
  }, [state, warnBefore, checkInterval, getExpiryTime, onWarning, onTimeout]);

  const extend = useCallback(async (): Promise<boolean> => {
    setIsExtending(true);
    try {
      const user = await client.refreshSession();
      if (user) {
        setIsWarning(false);
        warningFiredRef.current = false;
        return true;
      }
      return false;
    } finally {
      setIsExtending(false);
    }
  }, [client]);

  return {
    timeRemaining,
    isWarning,
    isExpired,
    extend,
    isExtending,
  };
}
```

### SessionTimeoutWarning Component

```typescript
// packages/react/src/components/SessionTimeoutWarning.tsx
import { type CSSProperties } from 'react';
import { useSessionTimeout, type UseSessionTimeoutOptions } from '../hooks/useSessionTimeout';

export interface SessionTimeoutWarningProps extends UseSessionTimeoutOptions {
  /** Modal title */
  title?: string;
  /** Modal message */
  message?: string;
  /** Extend button text */
  extendLabel?: string;
  /** Logout button text */
  logoutLabel?: string;
  /** Called after successful extend */
  onExtend?: () => void;
  /** Called when user clicks logout */
  onLogout?: () => void;
  /** Additional class name */
  className?: string;
}

export function SessionTimeoutWarning({
  warnBefore = 300,
  checkInterval = 30,
  onWarning,
  onTimeout,
  onExtend,
  onLogout,
  title = 'Session Expiring',
  message = 'Your session is about to expire. Would you like to stay signed in?',
  extendLabel = 'Stay Signed In',
  logoutLabel = 'Log Out',
  className,
}: SessionTimeoutWarningProps) {
  const { timeRemaining, isWarning, extend, isExtending } = useSessionTimeout({
    warnBefore,
    checkInterval,
    onWarning,
    onTimeout,
  });

  const handleExtend = async () => {
    const success = await extend();
    if (success) onExtend?.();
  };

  if (!isWarning || timeRemaining === null) return null;

  return (
    <div className={className} style={overlayStyles}>
      <div style={modalStyles}>
        <h2 style={titleStyles}>{title}</h2>
        <p style={messageStyles}>{message}</p>
        <Countdown seconds={timeRemaining} />
        <div style={buttonContainerStyles}>
          <button
            type="button"
            onClick={handleExtend}
            disabled={isExtending}
            style={primaryButtonStyles}
          >
            {isExtending ? 'Extending...' : extendLabel}
          </button>
          <button
            type="button"
            onClick={onLogout}
            style={secondaryButtonStyles}
          >
            {logoutLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Countdown({ seconds }: { seconds: number }) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const display = `${mins}:${secs.toString().padStart(2, '0')}`;

  return (
    <div style={countdownStyles}>
      <span style={countdownNumberStyles}>{display}</span>
    </div>
  );
}

// Styles
const overlayStyles: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const modalStyles: CSSProperties = {
  backgroundColor: 'white',
  borderRadius: 12,
  padding: 32,
  maxWidth: 400,
  width: '90%',
  textAlign: 'center',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
};

const titleStyles: CSSProperties = {
  margin: '0 0 8px',
  fontSize: 20,
  fontWeight: 600,
};

const messageStyles: CSSProperties = {
  margin: '0 0 16px',
  fontSize: 14,
  color: '#6b7280',
};

const countdownStyles: CSSProperties = {
  marginBottom: 24,
};

const countdownNumberStyles: CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  fontFamily: 'monospace',
  color: '#ef4444',
};

const buttonContainerStyles: CSSProperties = {
  display: 'flex',
  gap: 12,
  justifyContent: 'center',
};

const primaryButtonStyles: CSSProperties = {
  padding: '10px 20px',
  backgroundColor: '#6366f1',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};

const secondaryButtonStyles: CSSProperties = {
  padding: '10px 20px',
  backgroundColor: 'transparent',
  color: '#6b7280',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  fontSize: 14,
  cursor: 'pointer',
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
| `packages/react/src/hooks/useInvite.ts` | Invite validation and accept hook |
| `packages/react/src/components/InviteAccept.tsx` | Invite accept UI component |
| `packages/react/src/hooks/useSessionTimeout.ts` | Session timeout tracking hook |
| `packages/react/src/components/SessionTimeoutWarning.tsx` | Session timeout warning modal |

## Exports to Add

```typescript
// packages/react/src/index.ts
export { ProtectedRoute } from './components/ProtectedRoute';
export { Can } from './components/Can';
export { useAuthRedirect } from './hooks/useAuthRedirect';
export { usePermissions } from './hooks/usePermissions';
export { useOrganizations } from './hooks/useOrganizations';
export { OrganizationSwitcher } from './components/OrganizationSwitcher';
export { useInvite } from './hooks/useInvite';
export { InviteAccept } from './components/InviteAccept';
export { useSessionTimeout } from './hooks/useSessionTimeout';
export { SessionTimeoutWarning } from './components/SessionTimeoutWarning';
```
