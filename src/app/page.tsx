import { getCurrentUser } from '@/lib/auth';
import { Navbar } from '@/components/navigation/navbar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Hero Section */}
          <div className="py-16 text-center">
            <h1 className="mb-6 text-4xl font-bold text-gray-900 md:text-6xl">
              Welcome to SocleStack
            </h1>
            <p className="mx-auto mb-8 max-w-3xl text-xl text-gray-600">
              A complete Next.js application with Enterprise-grade user
              management features. Secure authentication, role-based access
              control, and modern React components.
            </p>

            {user ? (
              <div className="space-y-4">
                <p className="text-lg font-medium text-green-600">
                  Welcome back, {user.firstName || user.username || user.email}!
                </p>
                <div className="space-x-4">
                  <Link href="/dashboard">
                    <Button size="lg">Go to Dashboard</Button>
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
                  <Button size="lg">Get Started</Button>
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
            <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
              Features
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <div className="mb-4 flex h-32 w-full items-center justify-center rounded-lg bg-blue-50">
                    <Image
                      src="/images/auth-icon.svg"
                      alt="Secure Authentication"
                      width={128}
                      height={128}
                      className="object-contain"
                    />
                  </div>
                  <CardTitle>Secure Authentication</CardTitle>
                  <CardDescription>
                    Complete user authentication system with email verification,
                    password reset, and secure session management.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center">
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      Email/Password authentication
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      Email verification
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      Password reset workflow
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      Secure session management
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="mb-4 flex h-32 w-full items-center justify-center rounded-lg bg-green-50">
                    <Image
                      src="/images/rbac-icon.svg"
                      alt="Role-Based Access"
                      width={128}
                      height={128}
                      className="object-contain"
                    />
                  </div>
                  <CardTitle>Role-Based Access</CardTitle>
                  <CardDescription>
                    Comprehensive role-based access control with User,
                    Moderator, and Admin roles.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center">
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      User role management
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      Protected routes
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      Admin panel
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      Permission-based UI
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="mb-4 flex h-32 w-full items-center justify-center rounded-lg bg-purple-50">
                    <Image
                      src="/images/stack-icon.svg"
                      alt="Modern Stack"
                      width={128}
                      height={128}
                      className="object-contain"
                    />
                  </div>
                  <CardTitle>Modern Stack</CardTitle>
                  <CardDescription>
                    Built with Next.js 14, TypeScript, Prisma, and Tailwind CSS
                    for a modern development experience.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center">
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      Next.js 14 with App Router
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      TypeScript for type safety
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      Prisma ORM
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      Tailwind CSS
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Hello World Section */}
          <div className="py-16 text-center">
            <div className="mx-auto max-w-3xl">
              <div className="mb-8 text-8xl">👋</div>
              <h2 className="mb-4 text-4xl font-bold text-gray-900">
                Hello World!
              </h2>
              <p className="mb-8 text-xl text-gray-600">
                This is a complete, production-ready Next.js application with
                Enterprise-grade user management features. Everything from user
                registration to admin panels is fully implemented and ready to
                use.
              </p>

              {!user && (
                <div className="space-x-4">
                  <Link href="/register">
                    <Button size="lg">Create Account</Button>
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
  );
}

export const metadata = {
  title: 'SocleStack - Next.js User Management',
  description:
    'A complete Next.js application with Enterprise-grade user management features',
};
