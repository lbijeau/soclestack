import { ReactNode } from 'react';
import { clsx } from 'clsx';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

interface AlertProps {
  variant?: 'default' | 'success' | 'warning' | 'error';
  children: ReactNode;
  className?: string;
}

const Alert = ({ variant = 'default', children, className }: AlertProps) => {
  const icons = {
    default: Info,
    success: CheckCircle,
    warning: AlertCircle,
    error: XCircle,
  };

  const Icon = icons[variant];

  // Use role="alert" for error/warning to announce to screen readers
  const role =
    variant === 'error' || variant === 'warning' ? 'alert' : 'status';
  // Use assertive for errors, polite for success/info
  const ariaLive = variant === 'error' ? 'assertive' : 'polite';

  return (
    <div
      role={role}
      aria-live={ariaLive}
      className={clsx(
        'relative w-full rounded-lg border p-4',
        {
          'border-blue-200 bg-blue-50 text-blue-800': variant === 'default',
          'border-green-200 bg-green-50 text-green-800': variant === 'success',
          'border-yellow-200 bg-yellow-50 text-yellow-800':
            variant === 'warning',
          'border-red-200 bg-red-50 text-red-800': variant === 'error',
        },
        className
      )}
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <div className="text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
};

export { Alert };
