import { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    return (
      <input
        className={clsx(
          'flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm',
          'placeholder:text-gray-500',
          'focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          {
            'border-red-500 focus:ring-red-500': error,
          },
          className
        )}
        ref={ref}
        aria-invalid={ariaInvalid ?? error}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
