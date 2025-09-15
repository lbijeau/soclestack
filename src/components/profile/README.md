# Profile Components

## Purpose
User profile management components that allow users to update their personal information and change their passwords. These components provide secure, validated forms for self-service account management.

## Contents

### `profile-form.tsx`
**Purpose**: User profile information editing form
- **Features**:
  - Edit username, first name, and last name
  - Real-time validation with error feedback
  - Username availability checking
  - Form state management with loading states
  - Success and error messaging
  - Integration with profile update API

### `password-change-form.tsx`
**Purpose**: Secure password change functionality
- **Features**:
  - Current password verification
  - New password validation with strength indicators
  - Confirmation password matching
  - Secure API integration
  - Clear form after successful change
  - Comprehensive error handling

## Common Features

### Form Validation
- **Client-Side Validation**: Real-time input validation
- **Server-Side Integration**: API error handling and display
- **Field-Specific Errors**: Granular error messaging
- **Form-Level Feedback**: Success and general error messages

### User Experience
- **Loading States**: Visual feedback during API operations
- **Form Reset**: Clear sensitive data after operations
- **Accessibility**: Proper form labels and ARIA attributes
- **Mobile-Friendly**: Responsive design for all devices

## Component Architecture

### Profile Form Props
```typescript
interface ProfileFormProps {
  user: User
  onUpdate?: (updatedUser: User) => void
  className?: string
}
```

### Password Form Props
```typescript
interface PasswordChangeFormProps {
  onSuccess?: () => void
  className?: string
}
```

### Form State Management
```typescript
const [formData, setFormData] = useState({
  username: user.username || '',
  firstName: user.firstName || '',
  lastName: user.lastName || ''
})
const [errors, setErrors] = useState<Record<string, string[]>>({})
const [isLoading, setIsLoading] = useState(false)
const [success, setSuccess] = useState('')
```

## Usage Examples

### Profile Form Implementation
```typescript
import { ProfileForm } from '@/components/profile/profile-form'

export default function ProfilePage() {
  const user = await getCurrentUser()

  const handleProfileUpdate = (updatedUser: User) => {
    // Handle successful profile update
    toast.success('Profile updated successfully')
    // Optionally redirect or refresh data
  }

  return (
    <div className="profile-container">
      <h1>Edit Profile</h1>
      <ProfileForm
        user={user}
        onUpdate={handleProfileUpdate}
      />
    </div>
  )
}
```

### Password Change Implementation
```typescript
import { PasswordChangeForm } from '@/components/profile/password-change-form'

export default function SecurityPage() {
  const handlePasswordSuccess = () => {
    toast.success('Password changed successfully')
    // Optionally force re-authentication
  }

  return (
    <div className="security-settings">
      <h2>Change Password</h2>
      <PasswordChangeForm onSuccess={handlePasswordSuccess} />
    </div>
  )
}
```

### Integrated Profile Management
```typescript
function ProfileManagement({ user }: { user: User }) {
  return (
    <div className="profile-management">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm user={user} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Security Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordChangeForm />
        </CardContent>
      </Card>
    </div>
  )
}
```

## API Integration

### Profile Update
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsLoading(true)
  setErrors({})

  try {
    const response = await fetch('/api/users/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    })

    const data = await response.json()

    if (!response.ok) {
      const authError = data.error as AuthError
      if (authError.type === 'VALIDATION_ERROR' && authError.details) {
        setErrors(authError.details)
      } else {
        setError(authError.message)
      }
      return
    }

    onUpdate?.(data.user)
    setSuccess('Profile updated successfully')
  } catch (error) {
    setError('An error occurred while updating profile')
  } finally {
    setIsLoading(false)
  }
}
```

### Password Change
```typescript
const handlePasswordChange = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsLoading(true)
  setErrors({})

  try {
    const response = await fetch('/api/users/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      }),
    })

    if (response.ok) {
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      onSuccess?.()
      setSuccess('Password changed successfully')
    } else {
      const data = await response.json()
      setError(data.error.message)
    }
  } catch (error) {
    setError('An error occurred while changing password')
  } finally {
    setIsLoading(false)
  }
}
```

## Dependencies

### UI Components
- **@/components/ui/button**: Form submission and action buttons
- **@/components/ui/input**: Form input fields
- **@/components/ui/alert**: Success and error messages
- **@/components/ui/card**: Form container styling

### Utilities
- **@/lib/validations**: Input validation schemas
- **@/types/auth**: TypeScript type definitions
- **@/types/user**: User-related types

### External Libraries
- **React**: State management and form handling
- **Next.js**: Client-side navigation
- **clsx**: Conditional styling

## Validation Features

### Profile Form Validation
- **Username**: Minimum length, uniqueness check, format validation
- **Names**: Optional fields with reasonable length limits
- **Real-time Feedback**: Immediate validation on input change

### Password Validation
- **Current Password**: Required for security verification
- **New Password**: Strength requirements and complexity rules
- **Confirmation**: Must match new password exactly
- **Security Rules**: Prevents weak or common passwords

## Security Considerations

### Password Change Security
- **Current Password Verification**: Prevents unauthorized changes
- **Secure Transmission**: HTTPS-only password submission
- **Form Clearing**: Sensitive data cleared after submission
- **Session Validation**: Requires active authenticated session

### Data Protection
- **Input Sanitization**: Prevents XSS through validation
- **CSRF Protection**: Secure form submission
- **Rate Limiting**: API endpoints include rate limiting
- **Error Handling**: Generic errors to prevent information disclosure

## User Experience Features

### Form Feedback
```typescript
// Success state
{success && (
  <Alert variant="success">
    {success}
  </Alert>
)}

// Error state
{error && (
  <Alert variant="destructive">
    {error}
  </Alert>
)}

// Field-specific errors
{errors.username && (
  <span className="text-red-500 text-sm">
    {errors.username[0]}
  </span>
)}
```

### Loading States
```typescript
<Button
  type="submit"
  disabled={isLoading}
  className="w-full"
>
  {isLoading ? 'Updating...' : 'Update Profile'}
</Button>
```

### Progressive Enhancement
- **Client-Side Validation**: Immediate feedback for better UX
- **Server-Side Fallback**: Works without JavaScript
- **Graceful Degradation**: Basic functionality in all browsers

## Integration Points
- **User Profile Pages**: Primary forms for profile management
- **Settings Dashboard**: Integrated with user settings interface
- **Account Security**: Password change for security settings
- **Admin Interface**: Profile editing in administrative contexts

## Accessibility Features
- **Form Labels**: Proper label associations for screen readers
- **Error Announcements**: ARIA live regions for error messages
- **Keyboard Navigation**: Full keyboard accessibility
- **Focus Management**: Logical tab order and focus indicators