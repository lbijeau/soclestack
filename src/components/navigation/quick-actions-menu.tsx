'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Key,
  Shield,
  Smartphone,
  Monitor,
  History,
  Activity,
  Download,
  Bell,
  UserCog,
  Building2,
  Users,
  Mail,
} from 'lucide-react';

interface QuickActionsMenuProps {
  userRole: 'USER' | 'MODERATOR' | 'ADMIN';
  organizationId?: string;
}

const menuItems = [
  {
    group: 'Security',
    items: [
      { label: 'Change Password', href: '/profile', icon: Key },
      { label: 'Security Settings', href: '/profile/security', icon: Shield },
      { label: 'Trusted Devices', href: '/profile/devices', icon: Smartphone },
      { label: 'Active Sessions', href: '/profile/sessions', icon: Monitor },
    ],
  },
  {
    group: 'Activity',
    items: [
      { label: 'Login History', href: '/profile/login-history', icon: History },
      { label: 'Activity Log', href: '/profile/activity', icon: Activity },
    ],
  },
  {
    group: 'Account',
    items: [
      {
        label: 'Notification Preferences',
        href: '/profile/security',
        icon: Bell,
      },
      { label: 'Export My Data', href: '/profile', icon: Download },
    ],
  },
];

const adminItems = [
  {
    group: 'Admin',
    items: [
      { label: 'User Management', href: '/admin', icon: UserCog },
      { label: 'Audit Logs', href: '/admin/audit-logs', icon: Activity },
    ],
  },
];

const organizationItems = [
  {
    group: 'Organization',
    items: [
      {
        label: 'Organization Settings',
        href: '/organization',
        icon: Building2,
      },
      { label: 'Members', href: '/organization/members', icon: Users },
      { label: 'Invitations', href: '/organization/invites', icon: Mail },
    ],
  },
];

export function QuickActionsMenu({
  userRole,
  organizationId,
}: QuickActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allMenuItems = [
    ...menuItems,
    ...(organizationId ? organizationItems : []),
    ...(userRole === 'ADMIN' || userRole === 'MODERATOR' ? adminItems : []),
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        Quick Actions
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
          {allMenuItems.map((group, groupIndex) => (
            <div key={group.group}>
              {groupIndex > 0 && (
                <div className="my-2 border-t border-gray-100" />
              )}
              <div className="px-3 py-1">
                <span className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
                  {group.group}
                </span>
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <Icon className="h-4 w-4 text-gray-400" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
