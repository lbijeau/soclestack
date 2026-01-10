import { getBranding } from '@/lib/branding';

interface AuthFullpageProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function AuthFullpage({
  children,
  title,
  description,
}: AuthFullpageProps) {
  const branding = getBranding();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-white px-4 py-4">
        <img
          src={branding.logoUrl}
          alt={branding.name}
          className="h-8 w-auto"
        />
      </header>
      <main className="flex flex-1 items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-lg">
          {(title || description) && (
            <div className="mb-8 text-center">
              {title && (
                <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
              )}
              {description && (
                <p className="mt-2 text-gray-600">{description}</p>
              )}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
