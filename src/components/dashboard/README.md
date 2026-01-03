# Dashboard Components

> Reusable dashboard widgets for displaying user and account information.

## Purpose

This directory contains widget components designed for dashboard pages. These components fetch and display data independently, making them easy to compose into different dashboard layouts.

## Contents

| File                         | Description                                            |
| ---------------------------- | ------------------------------------------------------ |
| `security-events-widget.tsx` | Displays recent security events with severity coloring |

## Component Architecture

### SecurityEventsWidget

A self-contained client component that fetches and displays recent security events for the current user.

#### Props

This component takes no props - it manages its own data fetching and state internally.

#### Internal State

```typescript
interface SecurityEvent {
  id: string;
  action: string;
  description: string;
  icon: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  ipAddress: string | null;
  createdAt: string;
}
```

#### Behavior

1. **Auto-Fetch**: Fetches events from `/api/users/security-events` on mount
2. **Limited Display**: Shows the 5 most recent events
3. **Relative Time**: Displays timestamps as "2m ago", "3h ago", etc.
4. **Link to Full History**: "View all" link navigates to `/profile/activity`

## Usage Examples

### Basic Usage (Dashboard Page)

```tsx
import { SecurityEventsWidget } from '@/components/dashboard/security-events-widget';

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {/* Other content */}
      <div className="lg:col-span-2">{/* Main content */}</div>

      {/* Security widget in sidebar */}
      <SecurityEventsWidget />
    </div>
  );
}
```

### Standalone Usage

The widget can be placed anywhere that needs security event visibility:

```tsx
import { SecurityEventsWidget } from '@/components/dashboard/security-events-widget';

export function ProfileSidebar() {
  return (
    <aside className="w-80">
      <SecurityEventsWidget />
    </aside>
  );
}
```

## Dependencies

### Internal Dependencies

- `@/components/ui/card` - Card, CardHeader, CardTitle, CardContent

### External Dependencies

- `next/link` - Navigation to activity page
- `lucide-react` - Icons for event types and severity

## API Integration

### Security Events Endpoint

```
GET /api/users/security-events
```

**Response:**

```json
{
  "events": [
    {
      "id": "evt_123",
      "action": "LOGIN_SUCCESS",
      "description": "Signed in successfully",
      "icon": "login",
      "severity": "success",
      "ipAddress": "192.168.1.1",
      "createdAt": "2024-01-03T12:00:00Z"
    }
  ]
}
```

## Event Types and Icons

The widget maps event icons to Lucide components:

| Icon Key       | Component    | Typical Use                |
| -------------- | ------------ | -------------------------- |
| `login`        | LogIn        | Successful login           |
| `logout`       | LogOut       | User logout                |
| `key`          | Key          | Password changes           |
| `shield-check` | ShieldCheck  | 2FA enabled                |
| `shield-off`   | ShieldOff    | 2FA disabled               |
| `shield-alert` | ShieldAlert  | Security warning           |
| `lock`         | Lock         | Account locked             |
| `unlock`       | Unlock       | Account unlocked           |
| `device`       | Smartphone   | New device login           |
| `link`         | Link         | OAuth account linked       |
| `unlink`       | Unlink       | OAuth account unlinked     |
| `key-plus`     | KeyRound     | API key created            |
| `key-minus`    | KeyRound     | API key revoked            |
| `backup`       | Key          | Backup codes generated     |
| `alert`        | AlertTriangle| General security alert     |
| `info`         | Info         | Informational event        |

## Severity Levels

Events are color-coded by severity:

| Severity  | Background        | Text Color     | Use Case                    |
| --------- | ----------------- | -------------- | --------------------------- |
| `info`    | `bg-blue-100`     | `text-blue-600`| Informational events        |
| `success` | `bg-green-100`    | `text-green-600`| Successful actions         |
| `warning` | `bg-amber-100`    | `text-amber-600`| Attention needed           |
| `error`   | `bg-red-100`      | `text-red-600` | Failed or blocked actions   |

## States

### Loading State

Displays a centered spinner while fetching events:

```tsx
<div className="flex items-center justify-center py-8">
  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
</div>
```

### Error State

Shows error message if fetch fails:

```tsx
<p className="text-sm text-red-600">{error}</p>
```

### Empty State

Shows message when no events exist:

```tsx
<p className="py-4 text-center text-sm text-gray-500">
  No recent security events
</p>
```

## Styling

The widget uses Card component styling with:

- **Header**: Title with Shield icon, "View all" link
- **Content**: Vertically stacked event list with `space-y-3`
- **Event Items**: Icon badge + description + timestamp/IP

### Time Formatting

| Time Difference | Display Format |
| --------------- | -------------- |
| < 1 minute      | "Just now"     |
| < 60 minutes    | "Xm ago"       |
| < 24 hours      | "Xh ago"       |
| 1 day           | "Yesterday"    |
| < 7 days        | "Xd ago"       |
| >= 7 days       | "Mon DD"       |

## Security Considerations

- **Authentication Required**: API endpoint requires valid session
- **User-Scoped Data**: Only returns events for the authenticated user
- **No Sensitive Data**: Event descriptions are sanitized server-side
- **IP Display**: Shows IP addresses for audit purposes (user's own data)

## Accessibility Features

- **Icon + Text**: Events display both icon and description
- **Color + Shape**: Severity indicated by both color and icon style
- **Link Navigation**: "View all" is a proper link element
- **Loading Feedback**: Visual spinner during data fetch

## Related Documentation

- [Auth Library](../../lib/README.md) - Session management
- [API Examples](../../../docs/API_EXAMPLES.md) - API usage patterns
- [Technical Architecture](../../../docs/TECHNICAL_ARCHITECTURE.md) - System design

## Related Components

- [Auth Components](../auth/README.md) - Login/logout forms
- [Profile Components](../profile/README.md) - User profile management
- [Navigation](../navigation/README.md) - Navbar with user menu
