'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { UpdateProfileInput } from '@/lib/validations';
import { AuthError } from '@/types/auth';
import { apiPatch } from '@/lib/api-client';

interface User {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

interface ProfileFormProps {
  user: User;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [formData, setFormData] = useState<UpdateProfileInput>({
    email: user.email,
    username: user.username || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    setErrors({});

    try {
      const response = await apiPatch('/api/users/profile', formData);

      const data = await response.json();

      if (!response.ok) {
        const authError = data.error as AuthError;
        if (authError.type === 'VALIDATION_ERROR' && authError.details) {
          setErrors(authError.details);
        } else {
          setError(authError.message);
        }
        return;
      }

      setSuccess(data.message);

      // If email was changed, show additional message
      if (formData.email !== user.email) {
        setSuccess(data.message + ' Please verify your new email address.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: [] }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      {success && <Alert variant="success">{success}</Alert>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="firstName"
            className="text-sm font-medium text-gray-700"
          >
            First Name
          </label>
          <Input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            value={formData.firstName}
            onChange={handleChange}
            error={!!errors.firstName}
            disabled={isLoading}
          />
          {errors.firstName && (
            <p className="text-sm text-red-600">{errors.firstName[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="lastName"
            className="text-sm font-medium text-gray-700"
          >
            Last Name
          </label>
          <Input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            value={formData.lastName}
            onChange={handleChange}
            error={!!errors.lastName}
            disabled={isLoading}
          />
          {errors.lastName && (
            <p className="text-sm text-red-600">{errors.lastName[0]}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">
          Email Address
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={formData.email}
          onChange={handleChange}
          error={!!errors.email}
          disabled={isLoading}
        />
        {errors.email && (
          <p className="text-sm text-red-600">{errors.email[0]}</p>
        )}
        {formData.email !== user.email && (
          <p className="text-sm text-amber-600">
            Changing your email will require verification of the new email
            address.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium text-gray-700">
          Username
        </label>
        <Input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          value={formData.username}
          onChange={handleChange}
          error={!!errors.username}
          disabled={isLoading}
        />
        {errors.username && (
          <p className="text-sm text-red-600">{errors.username[0]}</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Updating...' : 'Update Profile'}
        </Button>
      </div>
    </form>
  );
}
