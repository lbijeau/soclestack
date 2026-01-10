import { Suspense } from 'react';
import { RegisterForm } from '@/components/auth/register-form';
import { AuthLayout } from '@/components/layouts/auth-layout';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getBranding } from '@/lib/branding';

export default function RegisterPage() {
  const branding = getBranding();

  return (
    <AuthLayout
      title="Create your account"
      description={`Join ${branding.name} to get started`}
    >
      <Suspense
        fallback={
          <Card className="mx-auto w-full max-w-md">
            <CardHeader>
              <CardTitle>Loading...</CardTitle>
              <CardDescription>
                Please wait while we load the registration form.
              </CardDescription>
            </CardHeader>
          </Card>
        }
      >
        <RegisterForm />
      </Suspense>
    </AuthLayout>
  );
}

export async function generateMetadata() {
  const branding = getBranding();
  return {
    title: `Sign Up - ${branding.name}`,
    description: `Create a new ${branding.name} account`,
  };
}
