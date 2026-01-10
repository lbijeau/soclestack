import Image from 'next/image';
import { getBranding } from '@/lib/branding';

interface AuthSplitProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function AuthSplit({ children, title, description }: AuthSplitProps) {
  const branding = getBranding();

  return (
    <div className="flex min-h-screen">
      {/* Left: Form */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div>
            <Image
              src={branding.logoUrl}
              alt={branding.name}
              width={40}
              height={40}
              unoptimized
            />
            {title && (
              <h1 className="mt-6 text-2xl font-bold text-gray-900">{title}</h1>
            )}
            {description && (
              <p className="mt-2 text-sm text-gray-600">{description}</p>
            )}
          </div>
          <div className="mt-8">{children}</div>
        </div>
      </div>

      {/* Right: Hero */}
      <div
        className="relative hidden w-0 flex-1 lg:block"
        style={{ backgroundColor: 'var(--brand-primary-light)' }}
      >
        <div className="flex h-full items-center justify-center p-12">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-800">
              Welcome to {branding.name}
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Secure authentication for your application
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
