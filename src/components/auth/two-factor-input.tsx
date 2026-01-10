'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';

interface TwoFactorInputProps {
  onSubmit: (code: string, isBackupCode: boolean) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error?: string;
}

export function TwoFactorInput({
  onSubmit,
  onCancel,
  isLoading,
  error,
}: TwoFactorInputProps) {
  const [code, setCode] = useState('');
  const [isBackupMode, setIsBackupMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [isBackupMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(code, isBackupMode);
  };

  const toggleBackupMode = () => {
    setIsBackupMode(!isBackupMode);
    setCode('');
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">
          {isBackupMode ? 'Enter Backup Code' : 'Two-Factor Authentication'}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {isBackupMode
            ? 'Enter one of your backup codes'
            : 'Enter the 6-digit code from your authenticator app'}
        </p>
      </div>

      {error && (
        <Alert variant="error" data-testid="error-message">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            ref={inputRef}
            type="text"
            inputMode={isBackupMode ? 'text' : 'numeric'}
            pattern={isBackupMode ? '[A-Za-z0-9]{8}' : '[0-9]{6}'}
            maxLength={isBackupMode ? 8 : 6}
            placeholder={isBackupMode ? 'XXXXXXXX' : '000000'}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={isLoading}
            className="text-center text-2xl tracking-widest"
            autoComplete="one-time-code"
            data-testid={isBackupMode ? 'backup-code-input' : '2fa-code-input'}
          />
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              isLoading ||
              (isBackupMode ? code.length !== 8 : code.length !== 6)
            }
            className="flex-1"
            data-testid="2fa-submit"
          >
            {isLoading ? 'Verifying...' : 'Verify'}
          </Button>
        </div>
      </form>

      <div className="text-center">
        <button
          type="button"
          onClick={toggleBackupMode}
          className="text-sm text-blue-600 hover:text-blue-500"
          disabled={isLoading}
        >
          {isBackupMode ? 'Use authenticator app instead' : 'Use backup code'}
        </button>
      </div>
    </div>
  );
}
