# UI Components Library

## Purpose
Reusable React UI components that form the design system foundation. Built with Tailwind CSS and TypeScript for consistency, accessibility, and type safety across the application.

## Contents

### `button.tsx`
**Purpose**: Versatile button component with multiple variants and sizes
- **Variants**: primary, secondary, destructive, ghost
- **Sizes**: sm (small), md (medium), lg (large)
- **Features**:
  - Focus management with visible focus rings
  - Disabled states with opacity and cursor changes
  - forwardRef support for advanced usage
  - Customizable className prop for extensions

### `input.tsx`
**Purpose**: Standardized form input component
- **Features**:
  - Consistent styling across the application
  - Focus states and validation styling
  - Accessible form integration
  - forwardRef for form library compatibility

### `card.tsx`
**Purpose**: Content container component with header and body sections
- **Components**: Card, CardHeader, CardTitle, CardDescription, CardContent
- **Features**:
  - Modular composition pattern
  - Consistent spacing and typography
  - Flexible content layout
  - Responsive design support

### `alert.tsx`
**Purpose**: Message display component for notifications and feedback
- **Variants**: Default, destructive, success, warning
- **Features**:
  - Icon integration capability
  - Flexible content composition
  - Consistent color theming
  - Dismissible variants support

### `badge.tsx`
**Purpose**: Small status indicators and labels
- **Variants**: default, secondary, destructive, outline
- **Features**:
  - Compact information display
  - Status indication
  - Color-coded variants
  - Inline and standalone usage

## Design System Principles

### Consistency
- **Color Palette**: Standardized color scheme across all components
- **Typography**: Consistent font sizing and weight hierarchy
- **Spacing**: Uniform padding and margin patterns
- **Border Radius**: Consistent rounding for visual harmony

### Accessibility
- **Focus Management**: Visible focus indicators on all interactive elements
- **ARIA Support**: Proper ARIA attributes for screen readers
- **Keyboard Navigation**: Full keyboard accessibility
- **Color Contrast**: WCAG compliant color combinations

### Composability
- **forwardRef**: All components support ref forwarding
- **Prop Extensions**: Components extend native HTML element props
- **Flexible Styling**: className prop for custom styling
- **Variant System**: Consistent variant naming across components

## Usage Examples

### Button Component
```typescript
import { Button } from '@/components/ui/button'

// Primary button (default)
<Button onClick={handleClick}>Submit</Button>

// Secondary button with custom size
<Button variant="secondary" size="lg">Cancel</Button>

// Destructive action
<Button variant="destructive" disabled={isLoading}>
  Delete Account
</Button>

// Ghost button for subtle actions
<Button variant="ghost" size="sm">
  Learn More
</Button>
```

### Card Component
```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

<Card>
  <CardHeader>
    <CardTitle>User Profile</CardTitle>
    <CardDescription>Manage your account settings</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Profile content goes here</p>
  </CardContent>
</Card>
```

### Alert Component
```typescript
import { Alert } from '@/components/ui/alert'

// Success message
<Alert variant="success">
  Your profile has been updated successfully!
</Alert>

// Error message
<Alert variant="destructive">
  Failed to save changes. Please try again.
</Alert>

// Warning
<Alert variant="warning">
  Your session will expire in 5 minutes.
</Alert>
```

### Input Component
```typescript
import { Input } from '@/components/ui/input'

// Basic input
<Input
  type="email"
  placeholder="Enter your email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>

// With error state
<Input
  type="password"
  placeholder="Password"
  className={errors.password ? 'border-red-500' : ''}
  aria-invalid={!!errors.password}
/>
```

### Badge Component
```typescript
import { Badge } from '@/components/ui/badge'

// Status indicators
<Badge variant="default">Active</Badge>
<Badge variant="destructive">Inactive</Badge>
<Badge variant="secondary">Pending</Badge>

// Role indicators
<Badge variant="outline">{user.role}</Badge>
```

## Styling Architecture

### Tailwind CSS Integration
- **Utility Classes**: Comprehensive use of Tailwind utilities
- **Custom Variants**: Component-specific styling patterns
- **Responsive Design**: Mobile-first responsive utilities
- **Dark Mode Ready**: Color schemes prepared for dark mode

### Component Variants
```typescript
// Variant system pattern
{
  'bg-blue-600 text-white hover:bg-blue-700': variant === 'primary',
  'bg-gray-200 text-gray-900 hover:bg-gray-300': variant === 'secondary',
  'bg-red-600 text-white hover:bg-red-700': variant === 'destructive',
  'hover:bg-gray-100 text-gray-900': variant === 'ghost',
}
```

### Size System
```typescript
// Consistent sizing across components
{
  'h-8 px-3 text-sm': size === 'sm',
  'h-10 px-4 text-sm': size === 'md',
  'h-12 px-6 text-base': size === 'lg',
}
```

## TypeScript Integration

### Prop Types
```typescript
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}
```

### forwardRef Pattern
```typescript
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    // Component implementation
  }
)
```

## Dependencies
- **React**: Core React library with hooks and forwardRef
- **clsx**: Conditional className composition
- **Tailwind CSS**: Utility-first CSS framework
- **TypeScript**: Type safety and IntelliSense

## Integration Points
- **Form Components**: Used by all form-related components
- **Page Components**: Building blocks for page layouts
- **Authentication Forms**: Styling for auth workflows
- **Admin Interfaces**: Consistent UI for admin panels

## Extension Patterns
- **Compound Components**: Card component pattern for complex UI
- **Variant Extensions**: Easy to add new variants to existing components
- **Custom Styling**: className prop allows for component extensions
- **Theme Customization**: Centralized color and spacing systems

## Performance Considerations
- **Tree Shaking**: Components are individually exportable
- **CSS Purging**: Tailwind CSS purges unused styles
- **Bundle Size**: Minimal JavaScript footprint
- **Runtime Performance**: Optimized re-renders with proper prop handling