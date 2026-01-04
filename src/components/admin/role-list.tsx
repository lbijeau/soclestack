'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, ChevronRight } from 'lucide-react';

export interface Role {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  parentName: string | null;
  isSystem: boolean;
  userCount: number;
}

export interface TreeNode extends Role {
  children: TreeNode[];
  depth: number;
}

/**
 * Build tree structure from flat role list
 */
export function buildTree(roles: Role[]): TreeNode[] {
  const roleMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Create nodes
  for (const role of roles) {
    roleMap.set(role.id, { ...role, children: [], depth: 0 });
  }

  // Build tree
  for (const role of roles) {
    const node = roleMap.get(role.id)!;
    if (role.parentId && roleMap.has(role.parentId)) {
      const parent = roleMap.get(role.parentId)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Calculate depths
  function setDepth(node: TreeNode, depth: number) {
    node.depth = depth;
    for (const child of node.children) {
      setDepth(child, depth + 1);
    }
  }

  for (const root of roots) {
    setDepth(root, 0);
  }

  return roots;
}

/**
 * Flatten tree for rendering while preserving depth
 */
export function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];

  function traverse(node: TreeNode) {
    result.push(node);
    for (const child of node.children) {
      traverse(child);
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return result;
}

export function RoleList() {
  const router = useRouter();
  const [roles, setRoles] = useState<TreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchRoles() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/admin/roles');

        if (!response.ok) {
          throw new Error('Failed to fetch roles');
        }

        const data = await response.json();
        const tree = buildTree(data.roles);
        const flattened = flattenTree(tree);
        setRoles(flattened);
      } catch {
        setError('Failed to load roles');
      } finally {
        setIsLoading(false);
      }
    }

    fetchRoles();
  }, []);

  if (error) {
    return <Alert variant="error">{error}</Alert>;
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <div className="divide-y divide-gray-200">
        {isLoading ? (
          // Loading skeleton
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center px-6 py-4">
              <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
              <div className="ml-3 h-4 w-32 animate-pulse rounded bg-gray-200" />
              <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-200" />
            </div>
          ))
        ) : roles.length === 0 ? (
          // Empty state
          <div className="px-6 py-12 text-center text-gray-500">
            <Shield className="mx-auto mb-2 h-8 w-8 text-gray-400" />
            No roles found
          </div>
        ) : (
          // Role list
          roles.map((role) => (
            <div
              key={role.id}
              role="button"
              tabIndex={0}
              className="group flex cursor-pointer items-center px-6 py-4 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              onClick={() => router.push(`/admin/roles/${role.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  router.push(`/admin/roles/${role.id}`);
                }
              }}
            >
              {/* Indentation and icon */}
              <div
                className="flex items-center"
                style={{ paddingLeft: `${role.depth * 24}px` }}
              >
                {role.depth > 0 && (
                  <span className="mr-2 text-gray-300">└─</span>
                )}
                <Shield className="h-5 w-5 text-gray-400" />
              </div>

              {/* Role name */}
              <span className="ml-3 font-medium text-gray-900">
                {role.name}
              </span>

              {/* System badge */}
              {role.isSystem && (
                <Badge variant="secondary" className="ml-2">
                  System
                </Badge>
              )}

              {/* Description (truncated) */}
              {role.description && (
                <span className="ml-4 hidden truncate text-sm text-gray-500 md:block md:max-w-xs">
                  {role.description}
                </span>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* User count */}
              <div className="flex items-center text-sm text-gray-500">
                <Users className="mr-1 h-4 w-4" />
                {role.userCount}
              </div>

              {/* Chevron */}
              <ChevronRight className="ml-4 h-5 w-5 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
