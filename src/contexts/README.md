# Contexts Directory

## Purpose
React Context providers for global state management across the application. This directory is currently empty but is intended to house React Context implementations for authentication state, theme management, and other global application state.

## Contents
Currently empty - prepared for future context implementations.

## Planned Usage

### Authentication Context (Future)
```typescript
// Planned: AuthContext for global authentication state
import { createContext, useContext } from 'react'
import { AuthState } from '@/types/auth'

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Authentication state management
  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

### Theme Context (Future)
```typescript
// Planned: ThemeContext for dark/light mode
interface ThemeState {
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeState | null>(null)
```

## Dependencies
- **React**: Context API and hooks
- **@/types/auth**: Type definitions for authentication state
- **@/lib/auth**: Authentication utilities and session management

## Architecture Notes
- **Server-First**: Currently using server-side session management with iron-session
- **Future Enhancement**: Will add client-side state management for improved UX
- **Hydration Safe**: Context implementations will handle SSR/CSR hydration properly
- **Type Safety**: All contexts will be fully typed with TypeScript

## Integration Points
- **Layout Components**: Root layout will wrap app with context providers
- **Page Components**: Pages will consume context through custom hooks
- **API Integration**: Contexts will sync with server-side authentication state
- **Middleware**: Will coordinate with Next.js middleware for route protection

## Current State Management
Without React contexts, the application currently uses:
- **Server Sessions**: iron-session for server-side state
- **API Calls**: Direct API calls from components for data fetching
- **URL State**: Next.js router for navigation state
- **Form State**: Local component state for form management

## Migration Path
When implementing contexts:
1. **AuthContext**: Wrap authentication state and sync with server sessions
2. **ThemeContext**: Add dark/light mode toggle functionality
3. **NotificationContext**: Global notification/toast management
4. **UserPreferencesContext**: User settings and preferences