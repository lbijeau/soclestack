import { Navbar } from '@/components/navigation/navbar';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      {children}
    </div>
  );
}
