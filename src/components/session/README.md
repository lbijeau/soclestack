# Session Components

> Components for session management and user experience around authentication state.

## Purpose

This directory contains components that manage the user's session lifecycle, providing visual feedback and controls for session-related events like timeout warnings and session extension.

## Contents

| File | Description |
|------|-------------|
| `session-timeout-warning.tsx` | Displays a warning when the user's session is about to expire |

## Component Architecture

### SessionTimeoutWarning

A client component that monitors session status and displays a dismissible warning banner when the session is close to expiring.

#### Props

This component takes no props - it manages its own state internally.

#### Internal State

```typescript
interface SessionStatus {
  isValid: boolean;        // Whether the session is still valid
  expiresAt: number | null; // Unix timestamp when session expires
  timeRemainingMs: number | null; // Milliseconds until expiry
  shouldWarn: boolean;     // Whether to show the warning
}
```

#### Behavior

1. **Periodic Checking**: Polls `/api/auth/session-status` every 60 seconds
2. **Warning Display**: Shows warning when `shouldWarn` is true (configurable threshold)
3. **Live Countdown**: Updates every second when warning is visible
4. **Session Extension**: Calls `/api/auth/extend-session` to refresh the session
5. **Auto-Redirect**: Redirects to `/login?expired=true` when session expires

## Usage Examples

### Basic Usage (Root Layout)

The component is designed to be placed in the root layout to provide app-wide session monitoring:

```tsx
// src/app/layout.tsx
import { SessionTimeoutWarning } from '@/components/session/session-timeout-warning';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <SessionTimeoutWarning />
      </body>
    </html>
  );
}
```

### Conditional Rendering

If you need session warnings only on certain pages:

```tsx
'use client';

import { SessionTimeoutWarning } from '@/components/session/session-timeout-warning';
import { usePathname } from 'next/navigation';

export function ConditionalSessionWarning() {
  const pathname = usePathname();

  // Only show on authenticated routes
  const authenticatedPaths = ['/dashboard', '/profile', '/admin'];
  const shouldShow = authenticatedPaths.some(p => pathname.startsWith(p));

  if (!shouldShow) return null;

  return <SessionTimeoutWarning />;
}
```

## Dependencies

### Internal Dependencies

- `@/components/ui/button` - Button component for actions
- `@/components/ui/card` - Card container for the warning
- `@/lib/api-client` - API utilities for session extension

### External Dependencies

- `next/navigation` - Router for redirect on expiry
- `lucide-react` - Icons (Clock, X, RefreshCw)

## API Integration

### Session Status Endpoint

```
GET /api/auth/session-status
```

**Response:**
```json
{
  "isValid": true,
  "expiresAt": 1704312000000,
  "timeRemainingMs": 300000,
  "shouldWarn": true
}
```

### Extend Session Endpoint

```
POST /api/auth/extend-session
```

**Success Response:**
```json
{
  "success": true,
  "message": "Session extended successfully",
  "expiresAt": 1704315600000,
  "timeRemainingMs": 3600000,
  "sessionDurationMs": 3600000
}
```

**Error Response (401):**
```json
{
  "error": {
    "type": "UNAUTHORIZED",
    "message": "No active session to extend"
  }
}
```

## Configuration

Session timing is configured in `src/lib/auth.ts`:

| Constant | Default | Description |
|----------|---------|-------------|
| `SESSION_DURATION_MS` | 1 hour | Total session duration |
| `SESSION_WARNING_THRESHOLD_MS` | 5 minutes | When to start showing warning |

Component-level timing:

| Constant | Value | Description |
|----------|-------|-------------|
| `CHECK_INTERVAL_MS` | 60 seconds | How often to poll session status |
| `WARNING_UPDATE_INTERVAL_MS` | 1 second | Countdown update frequency |

## Styling

The warning uses a fixed-position card in the bottom-right corner:

- **Position**: `fixed right-4 bottom-4 z-50`
- **Animation**: Slides in from bottom (`animate-in slide-in-from-bottom-4`)
- **Theme**: Orange color scheme for urgency
- **Width**: Fixed at 320px (`w-80`)

### Customization

To customize the appearance, modify the component or create a wrapper:

```tsx
// Custom styled wrapper
export function CustomSessionWarning() {
  return (
    <div className="custom-position">
      <SessionTimeoutWarning />
    </div>
  );
}
```

## Security Considerations

- **No Sensitive Data**: Component only receives timing information, never session tokens
- **Server Authority**: Session validity is determined server-side
- **Graceful Degradation**: If API calls fail, component logs errors but doesn't crash
- **CSRF Protection**: Uses `apiPost` which includes CSRF tokens for session extension

## Accessibility Features

- **Keyboard Navigation**: Buttons are focusable and keyboard-accessible
- **Visual Feedback**: Clear countdown display and loading states
- **Dismissible**: Users can dismiss the warning if it's intrusive
- **Non-Blocking**: Warning doesn't prevent interaction with the page

## Related Documentation

- [Auth Library](../../lib/README.md) - Session management implementation
- [API Auth Routes](../../app/api/auth/session-status/route.ts) - Session status endpoint
- [Security Configuration](../../lib/config/security.ts) - Session timing settings

## Related Components

- [Auth Components](../auth/README.md) - Login/logout forms
- [Navigation](../navigation/README.md) - Navbar with user menu
