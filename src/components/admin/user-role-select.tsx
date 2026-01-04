'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { X, Loader2, Shield, Info } from 'lucide-react';
import { apiPut } from '@/lib/api-client';

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface UserRolesResponse {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  directRoles: Role[];
  inheritedRoles: Role[];
}

interface AllRolesResponse {
  roles: Array<{
    id: string;
    name: string;
    description: string | null;
    isSystem: boolean;
  }>;
}

interface UserRoleSelectProps {
  userId: string;
  userEmail: string;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Check if a role is inherited (comes from role hierarchy).
 * Inherited roles are granted through parent-child relationships.
 */
export function isRoleInherited(
  roleId: string,
  inheritedRoles: Role[]
): boolean {
  return inheritedRoles.some((r) => r.id === roleId);
}

export function UserRoleSelect({
  userId,
  userEmail,
  currentUserId,
  isOpen,
  onClose,
  onSaved,
}: UserRoleSelectProps) {
  const [allRoles, setAllRoles] = useState<AllRolesResponse['roles']>([]);
  const [directRoleIds, setDirectRoleIds] = useState<Set<string>>(new Set());
  const [inheritedRoles, setInheritedRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [originalRoleIds, setOriginalRoleIds] = useState<Set<string>>(
    new Set()
  );

  const isEditingSelf = userId === currentUserId;
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      // Fetch all roles and user's current roles in parallel
      const [allRolesRes, userRolesRes] = await Promise.all([
        fetch('/api/admin/roles'),
        fetch(`/api/admin/users/${userId}/roles`),
      ]);

      if (!allRolesRes.ok) {
        throw new Error('Failed to fetch roles');
      }

      if (!userRolesRes.ok) {
        throw new Error('Failed to fetch user roles');
      }

      const allRolesData: AllRolesResponse = await allRolesRes.json();
      const userRolesData: UserRolesResponse = await userRolesRes.json();

      setAllRoles(allRolesData.roles);
      const directIds = new Set(userRolesData.directRoles.map((r) => r.id));
      setDirectRoleIds(directIds);
      setOriginalRoleIds(new Set(directIds));
      setInheritedRoles(userRolesData.inheritedRoles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Calculate hasChanges early so it can be used in handleClose
  const hasChanges =
    directRoleIds.size !== originalRoleIds.size ||
    Array.from(directRoleIds).some((id) => !originalRoleIds.has(id));

  // Close handler with unsaved changes confirmation
  const handleClose = useCallback(() => {
    if (hasChanges && !window.confirm('You have unsaved changes. Discard them?')) {
      return;
    }
    onClose();
  }, [hasChanges, onClose]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  // Focus management and body scroll lock
  useEffect(() => {
    if (isOpen) {
      // Store current active element to restore later
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Prevent body scroll
      document.body.style.overflow = 'hidden';

      // Focus the modal container
      setTimeout(() => {
        modalRef.current?.focus();
      }, 0);
    }

    return () => {
      // Restore body scroll
      document.body.style.overflow = '';

      // Restore focus to previous element
      previousActiveElement.current?.focus();
    };
  }, [isOpen]);

  // Handle keyboard events for modal (Escape and focus trap)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      // Focus trap: Tab key cycles through modal elements
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose]);

  const handleRoleToggle = (roleId: string) => {
    const newSet = new Set(directRoleIds);
    if (newSet.has(roleId)) {
      newSet.delete(roleId);
    } else {
      newSet.add(roleId);
    }
    setDirectRoleIds(newSet);
  };

  const handleSave = async () => {
    if (directRoleIds.size === 0) {
      setError('At least one role is required');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const response = await apiPut(`/api/admin/users/${userId}/roles`, {
        roleIds: Array.from(directRoleIds),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to update user roles');
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save roles');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // Find admin role for self-protection
  const adminRole = allRoles.find((r) => r.name === 'ROLE_ADMIN');
  const isRemovingOwnAdminRole =
    isEditingSelf &&
    adminRole &&
    originalRoleIds.has(adminRole.id) &&
    !directRoleIds.has(adminRole.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-select-title"
      aria-describedby={isEditingSelf ? 'self-edit-warning' : undefined}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="mx-4 w-full max-w-lg rounded-lg bg-white shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2
              id="role-select-title"
              className="text-lg font-semibold text-gray-900"
            >
              Manage Roles
            </h2>
            <p className="mt-1 text-sm text-gray-500">{userEmail}</p>
          </div>
          <button
            onClick={handleClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <Alert variant="error" aria-live="polite">
              {error}
            </Alert>
          ) : (
            <div className="space-y-4">
              {isEditingSelf && (
                <div id="self-edit-warning">
                  <Alert variant="warning">
                    <Info size={16} className="mr-2 inline" />
                    You are editing your own roles. Be careful not to lock
                    yourself out.
                  </Alert>
                </div>
              )}

              {/* Roles list */}
              <fieldset>
                <legend className="mb-3 text-sm font-medium text-gray-700">
                  Direct Roles
                </legend>
                <div className="space-y-2">
                  {allRoles.map((role) => {
                    const isInherited = isRoleInherited(
                      role.id,
                      inheritedRoles
                    );
                    const isSelected = directRoleIds.has(role.id);
                    const isAdminRole = role.name === 'ROLE_ADMIN';

                    // Disable admin checkbox if editing self and would remove admin role
                    const isDisabledByProtection =
                      isEditingSelf &&
                      isAdminRole &&
                      originalRoleIds.has(role.id);

                    return (
                      <label
                        key={role.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                          isInherited
                            ? 'cursor-not-allowed border-gray-200 bg-gray-50'
                            : isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected || isInherited}
                          onChange={() => handleRoleToggle(role.id)}
                          disabled={isInherited || isDisabledByProtection}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-medium ${isInherited ? 'text-gray-400' : 'text-gray-900'}`}
                            >
                              {role.name.replace('ROLE_', '')}
                            </span>
                            {isInherited && (
                              <Badge variant="secondary" className="text-xs">
                                Inherited
                              </Badge>
                            )}
                            {role.isSystem && (
                              <Badge variant="outline" className="text-xs">
                                <Shield size={10} className="mr-1" />
                                System
                              </Badge>
                            )}
                            {isDisabledByProtection && (
                              <Badge variant="destructive" className="text-xs">
                                Protected
                              </Badge>
                            )}
                          </div>
                          {role.description && (
                            <p
                              className={`mt-1 text-sm ${isInherited ? 'text-gray-400' : 'text-gray-500'}`}
                            >
                              {role.description}
                            </p>
                          )}
                          {isInherited && (
                            <p className="mt-1 text-xs text-gray-400">
                              This role is inherited from a child role
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {isRemovingOwnAdminRole && (
                <Alert variant="error" aria-live="polite">
                  You cannot remove your own admin role. This action is blocked
                  to prevent locking yourself out.
                </Alert>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          <Button variant="ghost" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              isLoading ||
              isSaving ||
              !hasChanges ||
              directRoleIds.size === 0 ||
              isRemovingOwnAdminRole
            }
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
