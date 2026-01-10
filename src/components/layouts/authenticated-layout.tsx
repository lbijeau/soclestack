import { AppLayout } from './app-layout';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return <AppLayout>{children}</AppLayout>;
}
