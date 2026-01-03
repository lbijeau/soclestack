# Contexts Directory

## Purpose

This directory is reserved for React Context providers if global client-side state management becomes necessary. Currently, the application uses Next.js App Router's server-first architecture, which eliminates the need for most traditional React Context patterns.

## Current State

**This directory is intentionally empty.** The application's architecture makes React Context largely unnecessary:

### Why No React Context?

1. **Server Components**: Pages fetch data server-side using `getCurrentUser()` and pass it as props
2. **Server Sessions**: Authentication state is managed server-side with iron-session
3. **Props Drilling**: User data flows from server components to client components via props
4. **API Routes**: Client components make direct API calls for data mutations

### Current Data Flow

```
Server Component (page.tsx)
    │
    ├── getCurrentUser() → iron-session
    │
    └── Passes user as props to:
        │
        └── Client Component (component.tsx)
            │
            └── Uses apiClient for mutations
```

## State Management Patterns

### Authentication State

```tsx
// Server component pattern (pages)
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ProtectedPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return <ClientComponent user={user} />;
}
```

### Client-Side Data Fetching

```tsx
// Client component pattern
'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export function DataComponent() {
  const [data, setData] = useState(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get('/api/data')
      .then(setData)
      .catch(() => setError('Failed to load data'));
  }, []);

  if (error) return <div>{error}</div>;
  return <div>{/* render data */}</div>;
}
```

### Form State

```tsx
// Local state for forms
'use client';

import { useState } from 'react';

export function FormComponent() {
  const [formData, setFormData] = useState({ field: '' });
  const [isLoading, setIsLoading] = useState(false);

  // Form logic...
}
```

## When to Add Contexts

Consider adding React Context only if:

1. **Deep prop drilling** becomes unwieldy (>3-4 levels)
2. **Real-time updates** across many unrelated components are needed
3. **Complex client-side state** cannot be managed with server components
4. **Theme switching** or other UI preferences need instant updates

### Potential Future Contexts

If needed, these might be candidates:

| Context             | Use Case                                       |
| ------------------- | ---------------------------------------------- |
| ThemeContext        | Dark/light mode toggle with instant UI updates |
| NotificationContext | Global toast/alert management                  |
| ModalContext        | Centralized modal state management             |

## Dependencies

If contexts are added, they would use:

- **React**: `createContext`, `useContext` hooks
- **@/lib/auth**: Authentication utilities
- **@/lib/api-client**: API communication

## Integration Points

- **`src/app/layout.tsx`**: Context providers would wrap the app here
- **Client components**: Would consume contexts via custom hooks
- **Server components**: Cannot use contexts (server-side only)

## Related Documentation

- [Technical Architecture](../../docs/TECHNICAL_ARCHITECTURE.md) - System design overview
- [Auth Library](../lib/README.md) - Authentication implementation
- [API Client](../lib/api-client.ts) - Client-side API utilities
