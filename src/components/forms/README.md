# Forms Components

## Purpose

This directory is currently empty but is intended to house reusable form components and form-related utilities that can be shared across different parts of the application.

## Contents

Currently empty - prepared for future form component implementations.

## Planned Components

### Form Utilities (Future)

```typescript
// Planned: Reusable form wrapper with validation
export function Form({ children, onSubmit, validationSchema }: FormProps) {
  // Form state management
  // Validation integration
  // Error handling
  return <form onSubmit={onSubmit}>{children}</form>
}
```

### Field Components (Future)

```typescript
// Planned: Reusable field components
export function TextField({
  name,
  label,
  validation,
  ...props
}: TextFieldProps) {
  // Field-specific validation
  // Error display
  // Label association
}

export function SelectField({
  name,
  label,
  options,
  ...props
}: SelectFieldProps) {
  // Dropdown field with validation
}

export function CheckboxField({ name, label, ...props }: CheckboxFieldProps) {
  // Checkbox with proper labeling
}
```

### Form Patterns (Future)

```typescript
// Planned: Common form patterns
export function FormSection({ title, children }: FormSectionProps) {
  // Form section grouping
}

export function FormActions({ children }: FormActionsProps) {
  // Submit/cancel button grouping
}
```

## Current Form Implementation

Currently, form components are implemented directly in their respective feature directories:

- **Authentication Forms**: `/components/auth/`
- **Profile Forms**: `/components/profile/`
- **Admin Forms**: Within `/components/admin/`

## Dependencies

- **React**: For component state and lifecycle management
- **@/components/ui/**: UI components for form styling
- **@/lib/validations**: Validation schemas and utilities
- **React Hook Form**: (Planned) For advanced form state management

## Integration Strategy

When implemented, these components will:

- **Standardize Form Patterns**: Consistent form behavior across the app
- **Reduce Code Duplication**: Reusable form components
- **Improve Validation**: Centralized validation logic
- **Enhance Accessibility**: Consistent accessibility patterns

## Architecture Goals

- **Composable**: Small, focused components that work together
- **Accessible**: WCAG compliant form components
- **Type Safe**: Full TypeScript integration
- **Flexible**: Customizable styling and behavior
- **Validated**: Built-in validation support

## Migration Plan

Future development will move form logic from feature-specific components to this shared directory:

1. **Extract Common Patterns**: Identify reusable form patterns
2. **Create Base Components**: Build foundational form components
3. **Migrate Existing Forms**: Update existing forms to use shared components
4. **Add Advanced Features**: Implement advanced form features like conditional fields

## Examples of Future Usage

```typescript
// Planned usage pattern
import { Form, TextField, SelectField, FormActions } from '@/components/forms'

export function UserForm({ user, onSubmit }: UserFormProps) {
  return (
    <Form onSubmit={onSubmit} validationSchema={userSchema}>
      <TextField
        name="email"
        label="Email Address"
        type="email"
        required
      />
      <TextField
        name="firstName"
        label="First Name"
      />
      <TextField
        name="lastName"
        label="Last Name"
      />
      <SelectField
        name="role"
        label="Role"
        options={roleOptions}
      />
      <FormActions>
        <Button type="submit">Save</Button>
        <Button type="button" variant="secondary">Cancel</Button>
      </FormActions>
    </Form>
  )
}
```

## Current Alternative

Until shared form components are implemented, use the existing UI components directly:

```typescript
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

// Direct implementation with UI components
export function CustomForm() {
  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit">Submit</Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

## Related Documentation

- [UI Components](../ui/README.md) - Base UI primitives
- [Auth Components](../auth/README.md) - Authentication forms
- [Profile Components](../profile/README.md) - Profile management forms
- [Validation Library](../../lib/validations.ts) - Form validation schemas
- [Technical Architecture](../../../docs/TECHNICAL_ARCHITECTURE.md) - System design
