'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { apiPost } from '@/lib/api-client';

interface DeleteAccountProps {
  isAdmin: boolean;
  isOrgOwner: boolean;
  hasPassword: boolean;
}

export function DeleteAccount({
  isAdmin,
  isOrgOwner,
  hasPassword,
}: DeleteAccountProps) {
  const router = useRouter();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const canDelete = !isAdmin && !isOrgOwner && hasPassword;

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await apiPost('/api/users/delete-account', {
        password,
        confirmation,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Failed to delete account');
        return;
      }

      // Redirect to home page after successful deletion
      router.push('/?deleted=true');
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setPassword('');
    setConfirmation('');
    setError('');
  };

  return (
    <Card className="border-red-200" data-testid="delete-account-card">
      <CardHeader>
        <CardTitle
          className="flex items-center gap-2 text-red-700"
          data-testid="delete-account-title"
        >
          <Trash2 className="h-5 w-5" />
          Delete Account
        </CardTitle>
        <CardDescription data-testid="delete-account-description">
          Permanently delete your account and all associated data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!canDelete ? (
          <Alert
            variant="warning"
            className="mb-4"
            data-testid="delete-account-blocked"
          >
            {isAdmin &&
              'System administrators cannot delete their own account. Contact another admin.'}
            {isOrgOwner &&
              'You must transfer organization ownership before deleting your account.'}
            {!hasPassword &&
              'OAuth-only accounts cannot be deleted this way. Please contact support.'}
          </Alert>
        ) : !showConfirmation ? (
          <div className="space-y-4" data-testid="delete-account-warning">
            <div className="rounded-md border border-red-200 bg-red-50 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                <div className="text-sm text-red-700">
                  <p className="mb-1 font-medium">
                    This action is permanent and cannot be undone.
                  </p>
                  <p>All your data will be permanently deleted, including:</p>
                  <ul
                    className="mt-2 ml-4 list-disc space-y-1"
                    data-testid="delete-account-data-list"
                  >
                    <li>Your profile and account information</li>
                    <li>All active sessions and devices</li>
                    <li>API keys and OAuth connections</li>
                    <li>Two-factor authentication settings</li>
                  </ul>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => setShowConfirmation(true)}
              data-testid="delete-account-understand-button"
            >
              I understand, delete my account
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleDelete}
            className="space-y-4"
            data-testid="delete-account-form"
          >
            {error && (
              <Alert variant="error" data-testid="delete-account-error">
                {error}
              </Alert>
            )}

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-gray-700"
              >
                Enter your password to confirm
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
                disabled={isLoading}
                data-testid="delete-account-password"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirmation"
                className="text-sm font-medium text-gray-700"
              >
                Type{' '}
                <span className="rounded bg-gray-100 px-1 font-mono">
                  DELETE MY ACCOUNT
                </span>{' '}
                to confirm
              </label>
              <Input
                id="confirmation"
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                required
                disabled={isLoading}
                data-testid="delete-account-confirmation"
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                data-testid="delete-account-cancel-button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isLoading || confirmation !== 'DELETE MY ACCOUNT'}
                data-testid="delete-account-submit-button"
              >
                {isLoading ? 'Deleting...' : 'Delete my account permanently'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
