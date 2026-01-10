'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { getBranding } from '@/lib/branding';
import { apiPost } from '@/lib/api-client';
import { hasMinimumRole, displayRole, ROLES } from '@/lib/security/client';
import {
  Home,
  User,
  Settings,
  LogOut,
  Users,
  Building2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface UserData {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName: string;
  role: string;
  organizationId?: string;
  organizationRole?: 'OWNER' | 'ADMIN' | 'MEMBER';
}

interface NavSidebarProps {
  children: React.ReactNode;
}

export function NavSidebar({ children }: NavSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const branding = getBranding();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
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

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/profile', label: 'Profile', icon: User },
  ];

  if (user?.organizationId) {
    navItems.push({
      href: '/organization',
      label: 'Organization',
      icon: Building2,
    });
  }

  if (user && hasMinimumRole(user.role, ROLES.MODERATOR)) {
    navItems.push({ href: '/admin', label: 'Admin', icon: Users });
  }

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-gray-900 text-white transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-gray-800 px-4">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center space-x-2">
              <Image
                src={branding.logoUrl}
                alt={branding.name}
                width={32}
                height={32}
                unoptimized
              />
              <span className="font-semibold">{branding.name}</span>
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard" className="mx-auto">
              <Image
                src={branding.logoUrl}
                alt={branding.name}
                width={32}
                height={32}
                unoptimized
              />
            </Link>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                } ${collapsed ? 'justify-center' : 'space-x-3'}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={20} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        {!isLoading && user && (
          <div className="border-t border-gray-800 p-4">
            {!collapsed && (
              <div className="mb-3">
                <p className="truncate text-sm font-medium text-white">
                  {getDisplayName()}
                </p>
                <p className="truncate text-xs text-gray-400">{user.email}</p>
                {hasMinimumRole(user.role, ROLES.MODERATOR) && (
                  <span className="mt-1 inline-flex items-center rounded-full bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-300">
                    {displayRole(user.role)}
                  </span>
                )}
              </div>
            )}
            <div
              className={`flex ${collapsed ? 'flex-col space-y-2' : 'space-x-2'}`}
            >
              <Link
                href="/profile"
                className="flex items-center justify-center rounded-md p-2 text-gray-300 hover:bg-gray-800 hover:text-white"
                title="Settings"
              >
                <Settings size={18} />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center justify-center rounded-md p-2 text-gray-300 hover:bg-gray-800 hover:text-white"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center border-t border-gray-800 p-4 text-gray-400 hover:text-white"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-50">{children}</main>
    </div>
  );
}
