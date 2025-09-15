import { ReactNode } from 'react'
import { clsx } from 'clsx'
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react'

interface AlertProps {
  variant?: 'default' | 'success' | 'warning' | 'error'
  children: ReactNode
  className?: string
}

const Alert = ({ variant = 'default', children, className }: AlertProps) => {
  const icons = {
    default: Info,
    success: CheckCircle,
    warning: AlertCircle,
    error: XCircle,
  }

  const Icon = icons[variant]

  return (
    <div
      className={clsx(
        'relative w-full rounded-lg border p-4',
        {
          'bg-blue-50 border-blue-200 text-blue-800': variant === 'default',
          'bg-green-50 border-green-200 text-green-800': variant === 'success',
          'bg-yellow-50 border-yellow-200 text-yellow-800': variant === 'warning',
          'bg-red-50 border-red-200 text-red-800': variant === 'error',
        },
        className
      )}
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div className="ml-3">
          <div className="text-sm">{children}</div>
        </div>
      </div>
    </div>
  )
}

export { Alert }