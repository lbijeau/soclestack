import { Suspense } from 'react'
import { RegisterForm } from '@/components/auth/register-form'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join SocleStack to get started
          </p>
        </div>
        <Suspense fallback={
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Loading...</CardTitle>
              <CardDescription>Please wait while we load the registration form.</CardDescription>
            </CardHeader>
          </Card>
        }>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  )
}

export const metadata = {
  title: 'Sign Up - SocleStack',
  description: 'Create a new SocleStack account',
}