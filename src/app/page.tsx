import { getCurrentUser } from '@/lib/auth'
import { Navbar } from '@/components/navigation/navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Users, Shield, Globe } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const user = await getCurrentUser()

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Hero Section */}
          <div className="text-center py-16">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Welcome to SocleStack
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              A complete Next.js application with Enterprise-grade-style user management features.
              Secure authentication, role-based access control, and modern React components.
            </p>

            {user ? (
              <div className="space-y-4">
                <p className="text-lg text-green-600 font-medium">
                  Welcome back, {user.firstName || user.username || user.email}!
                </p>
                <div className="space-x-4">
                  <Link href="/dashboard">
                    <Button size="lg">
                      Go to Dashboard
                    </Button>
                  </Link>
                  <Link href="/profile">
                    <Button variant="secondary" size="lg">
                      Manage Profile
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-x-4">
                <Link href="/register">
                  <Button size="lg">
                    Get Started
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="secondary" size="lg">
                    Sign In
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Features */}
          <div className="py-16">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
              Features
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <Shield className="h-6 w-6 text-blue-600" />
                  </div>
                  <CardTitle>Secure Authentication</CardTitle>
                  <CardDescription>
                    Complete user authentication system with email verification, password reset, and secure session management.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Email/Password authentication
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Email verification
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Password reset workflow
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Secure session management
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                  <CardTitle>Role-Based Access</CardTitle>
                  <CardDescription>
                    Comprehensive role-based access control with User, Moderator, and Admin roles.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      User role management
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Protected routes
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Admin panel
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Permission-based UI
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                    <Globe className="h-6 w-6 text-purple-600" />
                  </div>
                  <CardTitle>Modern Stack</CardTitle>
                  <CardDescription>
                    Built with Next.js 14, TypeScript, Prisma, and Tailwind CSS for a modern development experience.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Next.js 14 with App Router
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      TypeScript for type safety
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Prisma ORM
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Tailwind CSS
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Hello World Section */}
          <div className="py-16 text-center">
            <div className="max-w-3xl mx-auto">
              <div className="text-8xl mb-8">👋</div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Hello World!
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                This is a complete, production-ready Next.js application with Enterprise-grade-style user management features.
                Everything from user registration to admin panels is fully implemented and ready to use.
              </p>

              {!user && (
                <div className="space-x-4">
                  <Link href="/register">
                    <Button size="lg">
                      Create Account
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="secondary" size="lg">
                      Sign In
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export const metadata = {
  title: 'SocleStack - Next.js User Management',
  description: 'A complete Next.js application with Enterprise-grade-style user management features',
}
