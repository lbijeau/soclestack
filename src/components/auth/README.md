# Authentication Components

## Purpose

React components for user authentication workflows including login, registration, and password recovery. These components handle form state, validation, API integration, and user feedback.

## Contents

### `login-form.tsx`

**Purpose**: User login form with validation and error handling

- **Features**:
  - Email and password input fields
  - Client-side validation with real-time feedback
  - API integration with `/api/auth/login`
  - Return URL handling for post-login redirects
  - Loading states and error messaging
  - Responsive design with mobile support

### `register-form.tsx`

**Purpose**: User registration form with comprehensive validation

- **Features**:
  - Email, password, and optional profile fields
  - Multi-step validation (client + server)
  - Password strength indicators
  - Username availability checking
  - Success messaging and redirect handling
  - Terms of service acceptance

### `forgot-password-form.tsx`

**Purpose**: Password reset request form

- **Features**:
  - Email input for password reset
  - Form validation and submission
  - User feedback for reset email status
  - Integration with password reset API
  - Clear instructions and help text

## Common Patterns

### Form State Management

```typescript
const [formData, setFormData] = useState<LoginInput>({
  email: '',
  password: '',
});
const [errors, setErrors] = useState<Record<string, string[]>>({});
const [error, setError] = useState<string>('');
const [isLoading, setIsLoading] = useState(false);
```

### Error Handling

```typescript
if (!response.ok) {
  const authError = data.error as AuthError;
  if (authError.type === 'VALIDATION_ERROR' && authError.details) {
    setErrors(authError.details);
  } else {
    setError(authError.message);
  }
  return;
}
```

### API Integration

```typescript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(formData),
});
```

## Dependencies

### UI Components

- **@/components/ui/button**: Primary action buttons
- **@/components/ui/input**: Form input fields
- **@/components/ui/alert**: Error and success messages
- **@/components/ui/card**: Form container styling

### Utilities

- **@/lib/validations**: Input validation schemas
- **@/types/auth**: TypeScript type definitions
- **Next.js**: Navigation and routing hooks

### External Libraries

- **React**: State management and lifecycle
- **clsx**: Conditional styling
- **Next.js Router**: Navigation after successful auth

## Usage Examples

### Login Form Implementation

```typescript
import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoginForm />
    </div>
  )
}
```

### Registration Flow

```typescript
import { RegisterForm } from '@/components/auth/register-form'

export default function RegisterPage() {
  return (
    <div className="container mx-auto max-w-md py-8">
      <RegisterForm />
    </div>
  )
}
```

### Password Reset Integration

```typescript
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <div className="auth-container">
      <ForgotPasswordForm />
    </div>
  )
}
```

## Features

### Validation Integration

- **Client-side Validation**: Real-time field validation
- **Server-side Validation**: API error handling and display
- **Field-specific Errors**: Granular error messaging per field
- **Form-level Errors**: General authentication errors

### User Experience

- **Loading States**: Visual feedback during API calls
- **Return URL Handling**: Redirect users after successful login
- **Progressive Enhancement**: Works with and without JavaScript
- **Accessibility**: Proper ARIA labels and keyboard navigation

### Security Features

- **Rate Limiting**: Handles API rate limit responses
- **CSRF Protection**: Secure form submission
- **Input Sanitization**: Prevents XSS through validation
- **Secure Redirects**: Validates return URLs

## Styling Approach

- **Tailwind CSS**: Utility-first styling
- **Component Composition**: Reusable UI components
- **Responsive Design**: Mobile-first responsive layout
- **Consistent Theming**: Shared design system

## State Management

- **Local State**: Form-specific state with useState
- **Error Boundaries**: Graceful error handling
- **Loading Management**: Consistent loading state patterns
- **Form Reset**: Clear forms after successful submission

## Integration Points

- **API Routes**: Direct integration with authentication APIs
- **Page Components**: Used by page-level auth components
- **Layout Systems**: Integrated with app layouts and routing
- **Error Handling**: Consistent error display patterns

## Best Practices

- **Type Safety**: Full TypeScript integration
- **Error Handling**: Comprehensive error state management
- **Accessibility**: WCAG compliant form implementation
- **Performance**: Optimized re-renders and API calls
- **Security**: Secure form handling and validation
