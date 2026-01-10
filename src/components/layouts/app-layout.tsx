import { getLayout } from '@/lib/branding';
import { NavTop } from './nav-top';
import { NavSidebar } from './nav-sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { navStyle } = getLayout();

  if (navStyle === 'sidebar') {
    return <NavSidebar>{children}</NavSidebar>;
  }

  return <NavTop>{children}</NavTop>;
}
