import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome back
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to your account to continue
          </p>
        </div>
        <Suspense fallback={
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Loading...</CardTitle>
              <CardDescription>Please wait while we load the login form.</CardDescription>
            </CardHeader>
          </Card>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}

export const metadata = {
  title: 'Sign In - SocleStack',
  description: 'Sign in to your SocleStack account',
}