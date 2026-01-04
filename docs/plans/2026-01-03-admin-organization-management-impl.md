# Admin Organization Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add admin UI for monitoring and managing organizations with oversight capabilities.

**Architecture:** Server-side Next.js pages for admin views, client components for interactive tables, API routes for CRUD operations. Follows existing UserManagement patterns. All endpoints require `ADMIN` role.

**Tech Stack:** Next.js 15 App Router, Prisma ORM, React, TypeScript, Tailwind CSS, shadcn/ui components

---

## Task 1: Add Audit Action Types

**Files:**
- Modify: `src/lib/audit.ts:46` (add new audit actions)

**Step 1: Add new audit action types**

In `src/lib/audit.ts`, add these three new actions to the `AuditAction` type union (after `'SECURITY_DEVICE_REVOKED'`):

```typescript
  // Admin Organization Management
  | 'ADMIN_ORG_OWNERSHIP_TRANSFER'
  | 'ADMIN_ORG_MEMBER_REMOVED'
  | 'ADMIN_ORG_DELETED';
```

**Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/lib/audit.ts`
Expected: No output (success)

**Step 3: Commit**

```bash
git add src/lib/audit.ts
git commit -m "feat: add admin organization audit action types"
```

---

## Task 2: Create Organizations List API Endpoint

**Files:**
- Create: `src/app/api/admin/organizations/route.ts`
- Test: Manual API test

**Step 1: Create the list endpoint**

Create `src/app/api/admin/organizations/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 100);
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          _count: { select: { members: true } },
          members: {
            where: { role: 'OWNER' },
            include: {
              user: {
                select: { id: true, email: true, firstName: true, lastName: true },
              },
            },
            take: 1,
          },
        },
        orderBy: sortBy === 'memberCount'
          ? { members: { _count: sortOrder } }
          : { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.organization.count({ where }),
    ]);

    return NextResponse.json({
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        createdAt: org.createdAt.toISOString(),
        memberCount: org._count.members,
        owner: org.members[0]?.user || null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin organizations list error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to fetch organizations' } },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/app/api/admin/organizations/route.ts`
Expected: No output (success)

**Step 3: Commit**

```bash
git add src/app/api/admin/organizations/route.ts
git commit -m "feat: add admin organizations list API endpoint"
```

---

## Task 3: Create Organization Detail API Endpoint

**Files:**
- Create: `src/app/api/admin/organizations/[id]/route.ts`

**Step 1: Create the detail/update/delete endpoint**

Create `src/app/api/admin/organizations/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { headers } from 'next/headers';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
          orderBy: [
            { role: 'asc' }, // OWNER first, then ADMIN, then MEMBER
            { createdAt: 'asc' },
          ],
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'Organization not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt.toISOString(),
        members: organization.members.map((m) => ({
          userId: m.userId,
          role: m.role,
          joinedAt: m.createdAt.toISOString(),
          user: m.user,
        })),
      },
    });
  } catch (error) {
    console.error('Admin organization detail error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to fetch organization' } },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { newOwnerId } = body;

    if (!newOwnerId) {
      return NextResponse.json(
        { error: { type: 'VALIDATION_ERROR', message: 'New owner ID is required' } },
        { status: 400 }
      );
    }

    // Verify org exists
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          where: { role: 'OWNER' },
          take: 1,
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'Organization not found' } },
        { status: 404 }
      );
    }

    // Verify new owner is a member
    const newOwnerMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: id, userId: newOwnerId },
      },
      include: { user: { select: { email: true } } },
    });

    if (!newOwnerMembership) {
      return NextResponse.json(
        { error: { type: 'VALIDATION_ERROR', message: 'New owner must be an existing member' } },
        { status: 400 }
      );
    }

    const currentOwner = organization.members[0];

    // Transfer ownership in a transaction
    await prisma.$transaction([
      // Demote current owner to ADMIN
      prisma.organizationMember.update({
        where: {
          organizationId_userId: { organizationId: id, userId: currentOwner.userId },
        },
        data: { role: 'ADMIN' },
      }),
      // Promote new owner
      prisma.organizationMember.update({
        where: {
          organizationId_userId: { organizationId: id, userId: newOwnerId },
        },
        data: { role: 'OWNER' },
      }),
    ]);

    // Audit log
    const headersList = await headers();
    await logAuditEvent({
      action: 'ADMIN_ORG_OWNERSHIP_TRANSFER',
      category: 'admin',
      userId: user.id,
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined,
      metadata: {
        organizationId: id,
        organizationName: organization.name,
        previousOwnerId: currentOwner.userId,
        newOwnerId,
        newOwnerEmail: newOwnerMembership.user.email,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin organization transfer error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to transfer ownership' } },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });

    if (!organization) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'Organization not found' } },
        { status: 404 }
      );
    }

    // Delete organization (cascade deletes members, invitations)
    await prisma.$transaction([
      // Clear organizationId from users
      prisma.user.updateMany({
        where: { organizationId: id },
        data: { organizationId: null, organizationRole: null },
      }),
      // Delete members
      prisma.organizationMember.deleteMany({ where: { organizationId: id } }),
      // Delete invitations
      prisma.organizationInvitation.deleteMany({ where: { organizationId: id } }),
      // Delete organization
      prisma.organization.delete({ where: { id } }),
    ]);

    // Audit log
    const headersList = await headers();
    await logAuditEvent({
      action: 'ADMIN_ORG_DELETED',
      category: 'admin',
      userId: user.id,
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined,
      metadata: {
        organizationId: id,
        organizationName: organization.name,
        memberCount: organization._count.members,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin organization delete error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to delete organization' } },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/app/api/admin/organizations/[id]/route.ts`
Expected: No output (success)

**Step 3: Commit**

```bash
git add src/app/api/admin/organizations/[id]/route.ts
git commit -m "feat: add admin organization detail/transfer/delete API"
```

---

## Task 4: Create Remove Member API Endpoint

**Files:**
- Create: `src/app/api/admin/organizations/[id]/members/[userId]/route.ts`

**Step 1: Create the remove member endpoint**

Create directory and file:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { headers } from 'next/headers';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string; userId: string }>;
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id, userId } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    // Verify membership exists
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: id, userId },
      },
      include: {
        organization: { select: { name: true } },
        user: { select: { email: true } },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'Member not found' } },
        { status: 404 }
      );
    }

    // Cannot remove owner
    if (membership.role === 'OWNER') {
      return NextResponse.json(
        { error: { type: 'VALIDATION_ERROR', message: 'Cannot remove organization owner. Transfer ownership first.' } },
        { status: 400 }
      );
    }

    // Remove member
    await prisma.$transaction([
      prisma.organizationMember.delete({
        where: { organizationId_userId: { organizationId: id, userId } },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { organizationId: null, organizationRole: null },
      }),
    ]);

    // Audit log
    const headersList = await headers();
    await logAuditEvent({
      action: 'ADMIN_ORG_MEMBER_REMOVED',
      category: 'admin',
      userId: user.id,
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined,
      metadata: {
        organizationId: id,
        organizationName: membership.organization.name,
        removedUserId: userId,
        removedUserEmail: membership.user.email,
        removedUserRole: membership.role,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin remove member error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to remove member' } },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/app/api/admin/organizations/[id]/members/[userId]/route.ts`
Expected: No output (success)

**Step 3: Commit**

```bash
git add src/app/api/admin/organizations/[id]/members/[userId]/route.ts
git commit -m "feat: add admin remove organization member API"
```

---

## Task 5: Create Organization List Component

**Files:**
- Create: `src/components/admin/organization-list.tsx`

**Step 1: Create the list component**

Create `src/components/admin/organization-list.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users,
  ArrowUpDown,
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberCount: number;
  owner: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function OrganizationList() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrganizations();
  }, [pagination.page, sortBy, sortOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchOrganizations = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
      });
      if (search) params.set('search', search);

      const response = await fetch(`/api/admin/organizations?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }

      const data = await response.json();
      setOrganizations(data.organizations);
      setPagination(data.pagination);
    } catch {
      setError('Failed to load organizations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchOrganizations();
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateString));
  };

  const getOwnerName = (owner: Organization['owner']) => {
    if (!owner) return 'No owner';
    if (owner.firstName && owner.lastName) {
      return `${owner.firstName} ${owner.lastName}`;
    }
    return owner.email;
  };

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
        </div>
        <Button type="submit" disabled={isLoading}>
          <Search size={16} className="mr-2" />
          Search
        </Button>
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="cursor-pointer px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Organization
                    <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Slug
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Owner
                </th>
                <th
                  className="cursor-pointer px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase hover:bg-gray-100"
                  onClick={() => handleSort('memberCount')}
                >
                  <div className="flex items-center gap-1">
                    Members
                    <ArrowUpDown size={14} />
                  </div>
                </th>
                <th
                  className="cursor-pointer px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase hover:bg-gray-100"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center gap-1">
                    Created
                    <ArrowUpDown size={14} />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 animate-pulse rounded bg-gray-200" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 animate-pulse rounded bg-gray-200" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 animate-pulse rounded bg-gray-200" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 animate-pulse rounded bg-gray-200" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 animate-pulse rounded bg-gray-200" />
                    </td>
                  </tr>
                ))
              ) : organizations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <Building2 className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                    No organizations found
                  </td>
                </tr>
              ) : (
                organizations.map((org) => (
                  <tr
                    key={org.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/admin/organizations/${org.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building2 className="mr-3 h-5 w-5 text-gray-400" />
                        <span className="font-medium text-gray-900">{org.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                      {org.slug}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                      {getOwnerName(org.owner)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <Users className="mr-1 h-4 w-4" />
                        {org.memberCount}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                      {formatDate(org.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing page {pagination.page} of {pagination.totalPages} (
                  {pagination.total} total organizations)
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex -space-x-px rounded-md shadow-sm">
                  <Button
                    variant="ghost"
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <span className="relative inline-flex items-center border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-500">
                    {pagination.page}
                  </span>
                  <Button
                    variant="ghost"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/components/admin/organization-list.tsx`
Expected: No output (success)

**Step 3: Commit**

```bash
git add src/components/admin/organization-list.tsx
git commit -m "feat: add OrganizationList component for admin"
```

---

## Task 6: Create Organization Detail Component

**Files:**
- Create: `src/components/admin/organization-detail.tsx`

**Step 1: Create the detail component**

Create `src/components/admin/organization-detail.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Building2,
  Users,
  Crown,
  Shield,
  User,
  Trash2,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface Member {
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  };
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  members: Member[];
}

interface OrganizationDetailProps {
  organizationId: string;
}

export function OrganizationDetail({ organizationId }: OrganizationDetailProps) {
  const router = useRouter();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [transferTarget, setTransferTarget] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganization();
  }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchOrganization = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/organizations/${organizationId}`);

      if (!response.ok) {
        if (response.status === 404) {
          router.push('/admin/organizations');
          return;
        }
        throw new Error('Failed to fetch organization');
      }

      const data = await response.json();
      setOrganization(data.organization);
    } catch {
      setError('Failed to load organization');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!transferTarget) return;

    setIsTransferring(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/organizations/${organizationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newOwnerId: transferTarget }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to transfer ownership');
      }

      setSuccess('Ownership transferred successfully');
      setTransferTarget('');
      fetchOrganization();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer ownership');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member from the organization?')) {
      return;
    }

    setRemovingMemberId(userId);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `/api/admin/organizations/${organizationId}/members/${userId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to remove member');
      }

      setSuccess('Member removed successfully');
      fetchOrganization();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleDeleteOrganization = async () => {
    if (deleteConfirm !== organization?.name) return;

    setIsDeleting(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/organizations/${organizationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to delete organization');
      }

      router.push('/admin/organizations');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete organization');
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateString));
  };

  const getMemberName = (member: Member) => {
    if (member.user.firstName && member.user.lastName) {
      return `${member.user.firstName} ${member.user.lastName}`;
    }
    return member.user.username || member.user.email;
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'ADMIN':
        return <Shield className="h-4 w-4 text-blue-500" />;
      default:
        return <User className="h-4 w-4 text-gray-400" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'default' as const;
      case 'ADMIN':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!organization) {
    return null;
  }

  const currentOwner = organization.members.find((m) => m.role === 'OWNER');
  const nonOwnerMembers = organization.members.filter((m) => m.role !== 'OWNER');

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Button variant="ghost" onClick={() => router.push('/admin/organizations')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Organizations
      </Button>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {organization.name}
          </CardTitle>
          <CardDescription>Organization details and management</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm font-medium text-gray-500">Slug</div>
              <div className="text-gray-900">{organization.slug}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Created</div>
              <div className="text-gray-900">{formatDate(organization.createdAt)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Members</div>
              <div className="flex items-center text-gray-900">
                <Users className="mr-1 h-4 w-4" />
                {organization.members.length}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Owner</div>
              <div className="text-gray-900">
                {currentOwner ? getMemberName(currentOwner) : 'None'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members
          </CardTitle>
          <CardDescription>All members of this organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {organization.members.map((member) => (
                  <tr key={member.userId}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">
                          {getMemberName(member)}
                        </div>
                        <div className="text-sm text-gray-500">{member.user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(member.role)}
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                      {formatDate(member.joinedAt)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {member.role !== 'OWNER' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.userId)}
                          disabled={removingMemberId === member.userId}
                        >
                          {removingMemberId === member.userId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-red-500" />
                          )}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Transfer Ownership */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Transfer Ownership
          </CardTitle>
          <CardDescription>
            Transfer ownership to another member. The current owner will become an admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <select
              value={transferTarget}
              onChange={(e) => setTransferTarget(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2"
              disabled={isTransferring || nonOwnerMembers.length === 0}
            >
              <option value="">Select new owner...</option>
              {nonOwnerMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {getMemberName(member)} ({member.user.email})
                </option>
              ))}
            </select>
            <Button
              onClick={handleTransferOwnership}
              disabled={!transferTarget || isTransferring}
            >
              {isTransferring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transferring...
                </>
              ) : (
                'Transfer Ownership'
              )}
            </Button>
          </div>
          {nonOwnerMembers.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">
              No other members to transfer ownership to.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Permanently delete this organization. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              To delete this organization, type <strong>{organization.name}</strong> below:
            </p>
            <div className="flex gap-4">
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={`Type "${organization.name}" to confirm`}
                className="flex-1"
                disabled={isDeleting}
              />
              <Button
                variant="destructive"
                onClick={handleDeleteOrganization}
                disabled={deleteConfirm !== organization.name || isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Organization
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/components/admin/organization-detail.tsx`
Expected: No output (success)

**Step 3: Commit**

```bash
git add src/components/admin/organization-detail.tsx
git commit -m "feat: add OrganizationDetail component for admin"
```

---

## Task 7: Create Organizations List Page

**Files:**
- Create: `src/app/admin/organizations/page.tsx`

**Step 1: Create the list page**

Create `src/app/admin/organizations/page.tsx`:

```typescript
import { getCurrentUser, hasRequiredRole } from '@/lib/auth';
import { OrganizationList } from '@/components/admin/organization-list';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminOrganizationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?returnUrl=/admin/organizations');
  }

  if (user.role !== 'ADMIN') {
    redirect('/admin');
  }

  return (
    <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
          <p className="mt-2 text-gray-600">
            View and manage all organizations in the system.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Organizations</CardTitle>
            <CardDescription>
              Click on an organization to view details and manage members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationList />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export const metadata = {
  title: 'Organizations - Admin - SocleStack',
  description: 'Admin organization management',
};
```

**Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/app/admin/organizations/page.tsx`
Expected: No output (success)

**Step 3: Commit**

```bash
git add src/app/admin/organizations/page.tsx
git commit -m "feat: add admin organizations list page"
```

---

## Task 8: Create Organization Detail Page

**Files:**
- Create: `src/app/admin/organizations/[id]/page.tsx`

**Step 1: Create the detail page**

Create `src/app/admin/organizations/[id]/page.tsx`:

```typescript
import { getCurrentUser } from '@/lib/auth';
import { OrganizationDetail } from '@/components/admin/organization-detail';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminOrganizationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?returnUrl=/admin/organizations');
  }

  if (user.role !== 'ADMIN') {
    redirect('/admin');
  }

  return (
    <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <OrganizationDetail organizationId={id} />
      </div>
    </main>
  );
}

export const metadata = {
  title: 'Organization Details - Admin - SocleStack',
  description: 'Admin organization detail view',
};
```

**Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/app/admin/organizations/[id]/page.tsx`
Expected: No output (success)

**Step 3: Commit**

```bash
git add src/app/admin/organizations/[id]/page.tsx
git commit -m "feat: add admin organization detail page"
```

---

## Task 9: Update Admin Dashboard

**Files:**
- Modify: `src/app/admin/page.tsx`

**Step 1: Add organization count stat**

In `src/app/admin/page.tsx`, add to the imports:

```typescript
import { Building2 } from 'lucide-react';
```

**Step 2: Add organization count to stats query**

Add `totalOrganizations` to the Promise.all array (after `newUsers7d`):

```typescript
totalOrganizations,
] = await Promise.all([
  // ... existing queries ...
  prisma.user.count({ where: { createdAt: { gte: last7d } } }),
  prisma.organization.count(),
]);
```

**Step 3: Add Organizations stat to userStats array**

Add after the "Admins" stat:

```typescript
{
  title: 'Organizations',
  value: totalOrganizations,
  icon: Building2,
  color: 'text-indigo-600',
},
```

**Step 4: Add Organizations card to Admin Tools**

In the Admin Tools grid (after Audit Logs card), add:

```typescript
<Link href="/admin/organizations">
  <Card className="cursor-pointer transition-shadow hover:shadow-md">
    <CardContent className="p-6">
      <div className="flex items-center">
        <Building2 className="h-8 w-8 text-purple-600" />
        <div className="ml-4">
          <div className="font-medium text-gray-900">
            Organizations
          </div>
          <div className="text-sm text-gray-500">
            Manage organizations
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</Link>
```

**Step 5: Verify the file compiles**

Run: `npx tsc --noEmit src/app/admin/page.tsx`
Expected: No output (success)

**Step 6: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add Organizations card and stat to admin dashboard"
```

---

## Task 10: Add Organizations Link to Quick Actions Menu

**Files:**
- Modify: `src/components/navigation/quick-actions-menu.tsx`

**Step 1: Add Organizations item to adminItems**

In `src/components/navigation/quick-actions-menu.tsx`, add to the `adminItems` array's items (after "Audit Logs"):

```typescript
{ label: 'Organizations', href: '/admin/organizations', icon: Building2 },
```

Note: `Building2` is already imported in this file.

**Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/components/navigation/quick-actions-menu.tsx`
Expected: No output (success)

**Step 3: Commit**

```bash
git add src/components/navigation/quick-actions-menu.tsx
git commit -m "feat: add Organizations link to quick actions menu"
```

---

## Task 11: Run Full Build and Tests

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run linting**

Run: `npm run lint`
Expected: No errors (or only warnings)

**Step 3: Run unit tests**

Run: `npm run test:unit`
Expected: All tests pass

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any build/lint issues"
```

---

## Summary

This implementation adds:

1. **API Endpoints:**
   - `GET /api/admin/organizations` - List all organizations with pagination and search
   - `GET /api/admin/organizations/[id]` - Get organization details with members
   - `PATCH /api/admin/organizations/[id]` - Transfer ownership
   - `DELETE /api/admin/organizations/[id]` - Delete organization
   - `DELETE /api/admin/organizations/[id]/members/[userId]` - Remove member

2. **UI Components:**
   - `OrganizationList` - Searchable, sortable table of all organizations
   - `OrganizationDetail` - Full organization view with member management

3. **Pages:**
   - `/admin/organizations` - List view
   - `/admin/organizations/[id]` - Detail view

4. **Admin Dashboard Updates:**
   - Organizations stat card
   - Organizations tool card in Admin Tools

5. **Audit Events:**
   - `ADMIN_ORG_OWNERSHIP_TRANSFER`
   - `ADMIN_ORG_MEMBER_REMOVED`
   - `ADMIN_ORG_DELETED`
