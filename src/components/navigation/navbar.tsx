'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ImpersonationBanner } from '@/components/admin/impersonation-banner';
import { QuickActionsMenu } from './quick-actions-menu';
import { User, Settings, LogOut, Users, Building2 } from 'lucide-react';
import { apiPost } from '@/lib/api-client';
import { hasMinimumRole, ROLES } from '@/lib/security/client';

function Logo() {
  return (
    <Image
      src="/images/logo.svg"
      alt="SocleStack Logo"
      width={32}
      height={32}
      className="rounded"
      priority
    />
  );
}

interface User {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName: string;
  role: 'ROLE_USER' | 'ROLE_MODERATOR' | 'ROLE_ADMIN';
  organizationId?: string;
  organizationRole?: 'OWNER' | 'ADMIN' | 'MEMBER';
}

interface Impersonation {
  originalEmail: string;
  minutesRemaining: number;
}

export function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [impersonation, setImpersonation] = useState<Impersonation | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Run only on mount
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setImpersonation(data.impersonation || null);
      } else if (response.status === 401) {
        // Session is invalid - clear any stale tokens and redirect to login
        // if we're on a protected route
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        const protectedPaths = [
          '/dashboard',
          '/profile',
          '/admin',
          '/organization',
        ];
        const isProtectedRoute = protectedPaths.some((path) =>
          window.location.pathname.startsWith(path)
        );
        if (isProtectedRoute) {
          router.push(
            `/login?returnUrl=${encodeURIComponent(window.location.pathname)}`
          );
        }
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiPost('/api/auth/logout');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getDisplayName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.username) {
      return user.username;
    }
    return user?.email || 'User';
  };

  if (isLoading) {
    return (
      <nav className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex items-center">
              <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
            </div>
            <div className="flex items-center space-x-4">
              <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        </div>
      </nav>
    );
  }

  if (!user) {
    return (
      <nav className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex items-center">
              <Link
                href="/"
                className="flex items-center space-x-2 text-xl font-bold text-gray-900"
              >
                <Logo />
                <span>SocleStack</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-gray-900 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <>
      {impersonation && user && (
        <ImpersonationBanner
          originalEmail={impersonation.originalEmail}
          targetEmail={user.email}
          minutesRemaining={impersonation.minutesRemaining}
        />
      )}
      <nav className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex items-center space-x-8">
              <Link
                href="/dashboard"
                className="flex items-center space-x-2 text-xl font-bold text-gray-900"
              >
                <Logo />
                <span>SocleStack</span>
              </Link>

              <div className="hidden items-center space-x-1 md:flex">
                <Link
                  href="/dashboard"
                  className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Dashboard
                </Link>
                <Link
                  href="/profile"
                  className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Profile
                </Link>
                {user.organizationId && (
                  <Link
                    href="/organization"
                    className="flex items-center space-x-1 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                  >
                    <Building2 size={16} />
                    <span>Organization</span>
                  </Link>
                )}
                {hasMinimumRole(user.role, ROLES.MODERATOR) && (
                  <Link
                    href="/admin"
                    className="flex items-center space-x-1 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                  >
                    <Users size={16} />
                    <span>Admin</span>
                  </Link>
                )}
                <QuickActionsMenu
                  userRole={user.role}
                  organizationId={user.organizationId}
                  organizationRole={user.organizationRole}
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User size={16} className="text-gray-500" />
                <span className="text-sm text-gray-700">
                  {getDisplayName()}
                </span>
                {user.role !== ROLES.USER && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                    {user.role.replace('ROLE_', '')}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Link
                  href="/profile"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-900 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
                  aria-label="Settings"
                >
                  <Settings size={16} />
                </Link>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-900 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
                  onClick={handleLogout}
                  aria-label="Logout"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
