'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ArrowLeft,
  Shield,
  Loader2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { isPlatformRole } from '@/lib/security';

/**
 * Validation styling constants for form inputs
 * Used to maintain consistent validation states across form fields
 */
const VALIDATION_CLASSES = {
  valid: 'border-green-500 focus:border-green-500 focus:ring-green-500',
  invalid: 'border-red-500 focus:border-red-500 focus:ring-red-500',
  indicator: 'h-5 w-5',
  validText: 'text-green-500',
  invalidText: 'text-red-500',
} as const;

interface Role {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  parentName: string | null;
  isSystem: boolean;
  userCount?: number;
  childRoles?: { id: string; name: string }[];
}

interface RoleEditorProps {
  roleId?: string;
}

/**
 * Check if targetId is a descendant of roleId
 */
export function isDescendantOf(
  targetId: string,
  roleId: string,
  roles: Role[]
): boolean {
  const roleMap = new Map(roles.map((r) => [r.id, r]));
  const visited = new Set<string>();
  let currentId: string | null = targetId;

  while (currentId && !visited.has(currentId)) {
    const role = roleMap.get(currentId);
    if (!role) break;

    if (role.parentId === roleId) {
      return true;
    }

    visited.add(currentId);
    currentId = role.parentId;
  }

  return false;
}

/**
 * Validate role name format using the runtime type guard
 * Pattern: ROLE_[A-Z][A-Z0-9_]+ (minimum 2 characters after ROLE_ prefix)
 */
export function validateRoleName(name: string): string | null {
  if (!name.trim()) {
    return 'Name is required';
  }
  if (!isPlatformRole(name)) {
    return 'Role name must follow pattern ROLE_[A-Z][A-Z0-9_]+ (minimum 2 characters after ROLE_ prefix)';
  }
  return null;
}

export function RoleEditor({ roleId }: RoleEditorProps) {
  const router = useRouter();
  const isEditMode = !!roleId;

  // Data state
  const [role, setRole] = useState<Role | null>(null);
  const [allRoles, setAllRoles] = useState<Role[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string>('');

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Refs
  const deleteInputRef = useRef<HTMLInputElement>(null);

  // Track initial values for dirty state
  const [initialValues, setInitialValues] = useState({
    description: '',
    parentId: '',
  });

  // Check if form has unsaved changes
  const isDirty =
    (!isEditMode && name.trim() !== '') ||
    description !== initialValues.description ||
    parentId !== initialValues.parentId;

  // Navigate back with unsaved changes confirmation
  const handleNavigateBack = useCallback(() => {
    if (isDirty && !window.confirm('You have unsaved changes. Leave anyway?')) {
      return;
    }
    router.push('/admin/roles');
  }, [isDirty, router]);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');

      // Fetch all roles for parent dropdown
      const rolesResponse = await fetch('/api/admin/roles');
      if (!rolesResponse.ok) {
        throw new Error('Failed to fetch roles');
      }
      const rolesData = await rolesResponse.json();
      setAllRoles(rolesData.roles);

      // In edit mode, fetch specific role
      if (roleId) {
        const roleResponse = await fetch(`/api/admin/roles/${roleId}`);
        if (!roleResponse.ok) {
          if (roleResponse.status === 404) {
            router.push('/admin/roles');
            return;
          }
          throw new Error('Failed to fetch role');
        }
        const roleData = await roleResponse.json();
        setRole(roleData.role);
        setName(roleData.role.name);
        setDescription(roleData.role.description || '');
        setParentId(roleData.role.parentId || '');
        setInitialValues({
          description: roleData.role.description || '',
          parentId: roleData.role.parentId || '',
        });
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [roleId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Focus delete input when modal opens
  useEffect(() => {
    if (showDeleteModal) {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        deleteInputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [showDeleteModal]);

  // Warn user about unsaved changes when navigating away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Filter available parents (exclude self and descendants)
  const availableParents = allRoles.filter((r) => {
    if (roleId && r.id === roleId) return false;
    if (roleId && isDescendantOf(r.id, roleId, allRoles)) return false;
    return true;
  });

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!isEditMode) {
      const nameError = validateRoleName(name);
      if (nameError) {
        errors.name = nameError;
      }
    }

    if (description && description.length > 500) {
      errors.description = 'Description must be 500 characters or less';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    setError('');

    try {
      const url = isEditMode
        ? `/api/admin/roles/${roleId}`
        : '/api/admin/roles';
      const method = isEditMode ? 'PATCH' : 'POST';

      const body: Record<string, unknown> = {
        description: description || null,
        parentId: parentId || null,
      };

      if (!isEditMode) {
        body.name = name;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.error?.details) {
          setFieldErrors(
            Object.fromEntries(
              Object.entries(data.error.details).map(([k, v]) => [
                k,
                Array.isArray(v) ? v[0] : v,
              ])
            ) as Record<string, string>
          );
        } else {
          setError(data.error?.message || 'Failed to save role');
        }
        return;
      }

      router.push('/admin/roles');
    } catch {
      setError('Failed to save role');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (deleteConfirmName !== role?.name) {
      setDeleteError('Role name does not match');
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      const response = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        setDeleteError(data.error?.message || 'Failed to delete role');
        return;
      }

      router.push('/admin/roles');
    } catch {
      setDeleteError('Failed to delete role');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-64 animate-pulse rounded bg-gray-200" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-24 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
        </CardContent>
      </Card>
    );
  }

  if (error && !role && isEditMode) {
    return (
      <Alert variant="error">
        {error}
        <Button variant="ghost" size="sm" onClick={fetchData} className="ml-2">
          Retry
        </Button>
      </Alert>
    );
  }

  const isSystem = role?.isSystem ?? false;

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNavigateBack}
            aria-label="Go back to roles list"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditMode ? role?.name : 'New Role'}
            </h1>
            <p className="text-sm text-gray-500">
              {isEditMode ? 'Edit role properties' : 'Create a new role'}
            </p>
          </div>
        </div>
        {isEditMode && isSystem && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800">
            <Shield className="mr-1 h-4 w-4" />
            System Role
          </span>
        )}
      </div>

      {error && (
        <Alert variant="error" className="mb-4" aria-live="polite">
          {error}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Role Details</CardTitle>
          <CardDescription>
            {isSystem
              ? 'System roles have limited editing capabilities'
              : 'Configure the role name, description, and hierarchy'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name field */}
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Name
            </label>
            {isEditMode ? (
              <div className="flex h-10 items-center rounded-md border bg-gray-50 px-3 text-gray-600">
                {role?.name}
              </div>
            ) : (
              <>
                <div className="relative">
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => {
                      const value = e.target.value.trim().toUpperCase();
                      setName(value);
                      // Real-time validation (always validate, even for empty)
                      const error = validateRoleName(value);
                      setFieldErrors((prev) => ({
                        ...prev,
                        name: error || '',
                      }));
                    }}
                    placeholder="ROLE_CUSTOM_NAME"
                    className={
                      name && !fieldErrors.name
                        ? `${VALIDATION_CLASSES.valid} pr-10`
                        : fieldErrors.name
                          ? `${VALIDATION_CLASSES.invalid} pr-10`
                          : ''
                    }
                    aria-describedby={
                      fieldErrors.name ? 'name-error' : 'name-help'
                    }
                    aria-invalid={!!fieldErrors.name}
                  />
                  {/* Validation indicator */}
                  {name && (
                    <div className="absolute top-1/2 right-3 -translate-y-1/2">
                      {fieldErrors.name ? (
                        <XCircle
                          className={`${VALIDATION_CLASSES.indicator} ${VALIDATION_CLASSES.invalidText}`}
                          aria-label="Invalid role name"
                        />
                      ) : (
                        <CheckCircle2
                          className={`${VALIDATION_CLASSES.indicator} ${VALIDATION_CLASSES.validText}`}
                          aria-label="Valid role name"
                        />
                      )}
                    </div>
                  )}
                </div>
                {fieldErrors.name && (
                  <p
                    id="name-error"
                    className="mt-1 text-sm text-red-600"
                    aria-live="polite"
                  >
                    {fieldErrors.name}
                  </p>
                )}
                <div
                  id="name-help"
                  className="mt-1 space-y-1 text-xs text-gray-500"
                >
                  <p>
                    Must follow pattern: ROLE_[A-Z][A-Z0-9_]+ (starts with
                    letter, minimum 2 characters after ROLE_ prefix)
                  </p>
                  <p className="text-gray-400">
                    ✓ Valid: ROLE_USER, ROLE_BILLING_ADMIN, ROLE_SUPPORT_TIER_1
                  </p>
                  <p className="text-gray-400">
                    ✗ Invalid: ROLE_A (too short), ROLE_admin (lowercase),
                    ROLE-ADMIN (hyphen)
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Description field */}
          <div>
            <label
              htmlFor="description"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Description
            </label>
            {isSystem ? (
              <div className="min-h-[4.5rem] rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-600">
                {role?.description || 'No description'}
              </div>
            ) : (
              <>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, description: '' }));
                  }}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  placeholder="Optional description of this role's purpose"
                  aria-describedby={
                    fieldErrors.description ? 'description-error' : undefined
                  }
                  aria-invalid={!!fieldErrors.description}
                />
                {fieldErrors.description && (
                  <p
                    id="description-error"
                    className="mt-1 text-sm text-red-600"
                    aria-live="polite"
                  >
                    {fieldErrors.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {description.length}/500 characters
                </p>
              </>
            )}
          </div>

          {/* Parent field */}
          <div>
            <label
              htmlFor="parent"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Parent Role
            </label>
            {isSystem ? (
              <div className="flex h-10 items-center rounded-md border bg-gray-50 px-3 text-gray-600">
                {role?.parentName || 'None (root role)'}
              </div>
            ) : (
              <>
                <select
                  id="parent"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">None (root role)</option>
                  {availableParents.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Child roles inherit permissions from their parent
                </p>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t pt-6">
            <div>
              {isEditMode && !isSystem && (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteModal(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Role
                </Button>
              )}
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" onClick={handleNavigateBack}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  isSaving ||
                  (!isEditMode && !!fieldErrors.name) ||
                  !!fieldErrors.description
                }
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Save Changes' : 'Create Role'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowDeleteModal(false);
              setDeleteConfirmName('');
              setDeleteError('');
            }
          }}
        >
          <div
            className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <div className="mb-4 flex items-center text-red-600">
              <AlertTriangle className="mr-2 h-6 w-6" />
              <h2 id="delete-modal-title" className="text-lg font-semibold">
                Delete Role
              </h2>
            </div>

            <p className="mb-4 text-gray-600">
              This action cannot be undone. This will permanently delete the
              role <strong>{role?.name}</strong>.
            </p>

            <p className="mb-2 text-sm text-gray-600">
              Type <strong>{role?.name}</strong> to confirm:
            </p>

            <Input
              ref={deleteInputRef}
              value={deleteConfirmName}
              onChange={(e) => {
                setDeleteConfirmName(e.target.value);
                setDeleteError('');
              }}
              placeholder={role?.name}
              className="mb-4"
              aria-label="Type role name to confirm deletion"
            />

            {deleteError && (
              <Alert variant="error" className="mb-4" aria-live="polite">
                {deleteError}
              </Alert>
            )}

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmName('');
                  setDeleteError('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting || deleteConfirmName !== role?.name}
              >
                {isDeleting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Delete Role
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
