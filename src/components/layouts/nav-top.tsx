import { Navbar } from '@/components/navigation/navbar';

interface NavTopProps {
  children: React.ReactNode;
}

export function NavTop({ children }: NavTopProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
