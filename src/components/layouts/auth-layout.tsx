import { getLayout } from '@/lib/branding';
import { AuthCentered } from './auth-centered';
import { AuthSplit } from './auth-split';
import { AuthFullpage } from './auth-fullpage';

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  const { authStyle } = getLayout();

  switch (authStyle) {
    case 'split':
      return (
        <AuthSplit title={title} description={description}>
          {children}
        </AuthSplit>
      );
    case 'fullpage':
      return (
        <AuthFullpage title={title} description={description}>
          {children}
        </AuthFullpage>
      );
    default:
      return (
        <AuthCentered title={title} description={description}>
          {children}
        </AuthCentered>
      );
  }
}
