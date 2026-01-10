import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import { AuthLayout } from '@/components/layouts/auth-layout';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getBranding } from '@/lib/branding';

export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to your account to continue"
    >
      <Suspense
        fallback={
          <Card className="mx-auto w-full max-w-md">
            <CardHeader>
              <CardTitle>Loading...</CardTitle>
              <CardDescription>
                Please wait while we load the login form.
              </CardDescription>
            </CardHeader>
          </Card>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}

export async function generateMetadata() {
  const branding = getBranding();
  return {
    title: `Sign In - ${branding.name}`,
    description: `Sign in to your ${branding.name} account`,
  };
}
