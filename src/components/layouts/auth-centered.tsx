import Image from 'next/image';
import { getBranding } from '@/lib/branding';

interface AuthCenteredProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function AuthCentered({
  children,
  title,
  description,
}: AuthCenteredProps) {
  const branding = getBranding();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Image
            src={branding.logoUrl}
            alt={branding.name}
            width={48}
            height={48}
            className="mx-auto"
            unoptimized
          />
          {title && (
            <h1 className="mt-6 text-3xl font-extrabold text-gray-900">
              {title}
            </h1>
          )}
          {description && (
            <p className="mt-2 text-sm text-gray-600">{description}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
