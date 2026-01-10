import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks';
import type { User, LoginResult } from '@soclestack/core';

export interface LoginFormProps {
  /** Called on successful login */
  onSuccess?: (user: User) => void;
  /** Called on login error */
  onError?: (error: string) => void;
  /** Called when 2FA is required */
  onRequires2FA?: (tempToken: string) => void;
  /** Custom class name */
  className?: string;
  /** Labels customization */
  labels?: {
    email?: string;
    password?: string;
    submit?: string;
  };
}

export function LoginForm({
  onSuccess,
  onError,
  onRequires2FA,
  className,
  labels,
}: LoginFormProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result: LoginResult = await login(email, password);

      if (result.success) {
        onSuccess?.(result.user);
      } else if ('requires2FA' in result && result.requires2FA) {
        onRequires2FA?.(result.tempToken);
      } else if ('error' in result) {
        const errorMessage = result.error;
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className} data-socle="login-form">
      <div data-socle="field">
        <label htmlFor="socle-email" data-socle="label">
          {labels?.email ?? 'Email'}
        </label>
        <input
          id="socle-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          data-socle="input"
        />
      </div>

      <div data-socle="field">
        <label htmlFor="socle-password" data-socle="label">
          {labels?.password ?? 'Password'}
        </label>
        <input
          id="socle-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          data-socle="input"
        />
      </div>

      {error && (
        <div data-socle="error" role="alert">
          {error}
        </div>
      )}

      <button type="submit" disabled={isLoading} data-socle="submit">
        {isLoading ? 'Signing in...' : (labels?.submit ?? 'Sign in')}
      </button>
    </form>
  );
}
