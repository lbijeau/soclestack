# Navigation Components

## Purpose
Navigation components that provide site-wide navigation, user authentication status, and role-based menu access. These components ensure consistent navigation experience across the application.

## Contents

### `navbar.tsx`
**Purpose**: Main application navigation bar with authentication integration
- **Features**:
  - Responsive navigation design
  - User authentication status display
  - Role-based navigation items
  - User profile dropdown menu
  - Logout functionality
  - Mobile-responsive hamburger menu
  - Active route highlighting

## Key Features

### Authentication Integration
- **User Status**: Displays current user information when logged in
- **Login/Logout**: Dynamic login/logout buttons based on auth state
- **User Profile Access**: Quick access to profile and settings
- **Role-Based Items**: Navigation items shown based on user role

### Responsive Design
- **Desktop Navigation**: Full horizontal navigation bar
- **Mobile Menu**: Collapsible hamburger menu for mobile devices
- **Touch-Friendly**: Optimized for touch interactions
- **Breakpoint Handling**: Smooth transitions between desktop and mobile

### Navigation Features
- **Active State**: Highlights current page in navigation
- **Smooth Transitions**: Animated state changes and hover effects
- **Dropdown Menus**: User profile and admin dropdown menus
- **Keyboard Navigation**: Full keyboard accessibility support

## Component Architecture

### Props Interface
```typescript
interface NavbarProps {
  user?: User | null
  className?: string
  onLogout?: () => void
}
```

### Navigation Items Structure
```typescript
interface NavItem {
  label: string
  href: string
  icon?: React.ComponentType
  requiresAuth?: boolean
  requiredRole?: string
  external?: boolean
}
```

### User Menu Items
- **Profile**: Link to user profile page
- **Settings**: Account settings and preferences
- **Admin Panel**: Administrative interface (admin/moderator only)
- **Logout**: Sign out functionality

## Usage Examples

### Basic Implementation
```typescript
import { Navbar } from '@/components/navigation/navbar'
import { getCurrentUser } from '@/lib/auth'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <div className="min-h-screen">
      <Navbar user={user} />
      <main>{children}</main>
    </div>
  )
}
```

### With Custom Logout Handler
```typescript
'use client'

import { Navbar } from '@/components/navigation/navbar'
import { useRouter } from 'next/navigation'

export function AppNavigation({ user }: { user: User | null }) {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <Navbar
      user={user}
      onLogout={handleLogout}
    />
  )
}
```

### Integration with Layout System
```typescript
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-layout">
          <AppNavigation user={user} />
          <main className="main-content">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
```

## Navigation Structure

### Public Navigation Items
```typescript
const publicNavItems = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
]
```

### Authenticated User Items
```typescript
const authenticatedNavItems = [
  { label: 'Dashboard', href: '/dashboard', requiresAuth: true },
  { label: 'Profile', href: '/profile', requiresAuth: true },
]
```

### Admin Navigation Items
```typescript
const adminNavItems = [
  {
    label: 'Admin',
    href: '/admin',
    requiresAuth: true,
    requiredRole: 'ADMIN'
  },
  {
    label: 'User Management',
    href: '/admin/users',
    requiresAuth: true,
    requiredRole: 'MODERATOR'
  },
]
```

## Dependencies

### UI Components
- **@/components/ui/button**: Navigation buttons and actions
- **@/components/ui/badge**: User role indicators
- **Custom Icons**: Navigation and UI icons

### Authentication
- **@/lib/auth**: User authentication utilities
- **@/types/auth**: User and authentication types

### Navigation
- **Next.js Link**: Client-side navigation
- **usePathname**: Active route detection
- **useRouter**: Programmatic navigation

## Features Implementation

### Active Route Detection
```typescript
'use client'

import { usePathname } from 'next/navigation'

export function NavItem({ href, children }: NavItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <Link
      href={href}
      className={clsx(
        'nav-item',
        {
          'nav-item-active': isActive,
          'nav-item-inactive': !isActive,
        }
      )}
    >
      {children}
    </Link>
  )
}
```

### User Dropdown Menu
```typescript
function UserDropdown({ user, onLogout }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="user-menu-button"
      >
        {user.firstName || user.email}
      </button>

      {isOpen && (
        <div className="user-dropdown">
          <Link href="/profile">Profile</Link>
          <Link href="/settings">Settings</Link>
          {hasRequiredRole(user.role, 'MODERATOR') && (
            <Link href="/admin">Admin Panel</Link>
          )}
          <button onClick={onLogout}>Logout</button>
        </div>
      )}
    </div>
  )
}
```

### Mobile Menu Toggle
```typescript
function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="mobile-menu">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hamburger-button"
      >
        {/* Hamburger icon */}
      </button>

      {isOpen && (
        <div className="mobile-nav-overlay">
          <nav className="mobile-nav">
            {/* Navigation items */}
          </nav>
        </div>
      )}
    </div>
  )
}
```

## Styling Approach
- **Tailwind CSS**: Utility-first styling for responsive design
- **Mobile-First**: Responsive design starting from mobile
- **Dark Mode Ready**: Prepared for dark mode implementation
- **Consistent Spacing**: Follows design system spacing patterns

## Accessibility Features
- **Keyboard Navigation**: Full keyboard support for all interactive elements
- **ARIA Labels**: Proper ARIA attributes for screen readers
- **Focus Management**: Visible focus indicators
- **Semantic HTML**: Proper nav, button, and link semantics

## Performance Considerations
- **Client-Side Navigation**: Uses Next.js Link for optimal performance
- **Conditional Rendering**: Only renders relevant navigation items
- **Event Delegation**: Efficient event handling for dropdown menus
- **Responsive Images**: Optimized logo and avatar images

## Integration Points
- **Layout System**: Integrated with app layout components
- **Authentication System**: Direct integration with auth state
- **Routing System**: Works with Next.js App Router
- **Admin Interface**: Provides access to administrative features

## Customization Options
- **Theme Variants**: Support for different visual themes
- **Logo Customization**: Easy logo and branding updates
- **Menu Structure**: Configurable navigation items
- **Style Overrides**: Custom className support for styling extensions