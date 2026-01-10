'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import {
  Loader2,
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Clock,
  Edit2,
} from 'lucide-react';
import { ApiKeyPermission } from '@prisma/client';
import { apiPost, apiPatch, apiDelete } from '@/lib/api-client';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permission: ApiKeyPermission;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ApiKeysResponse {
  keys: ApiKey[];
  count: number;
  limit: number;
}

interface CreateKeyResponse extends ApiKey {
  key: string;
  count: number;
  limit: number;
}

export function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [count, setCount] = useState(0);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPermission, setCreatePermission] =
    useState<ApiKeyPermission>('READ_ONLY');
  const [createExpiry, setCreateExpiry] = useState<'never' | 'custom'>('never');
  const [createExpiryDate, setCreateExpiryDate] = useState('');
  const [creating, setCreating] = useState(false);

  // New key modal state
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [copyConfirmed, setCopyConfirmed] = useState(false);

  // Edit modal state
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [editName, setEditName] = useState('');
  const [editPermission, setEditPermission] =
    useState<ApiKeyPermission>('READ_ONLY');
  const [editExpiry, setEditExpiry] = useState<'never' | 'custom'>('never');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [updating, setUpdating] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/keys');
      if (!res.ok) throw new Error('Failed to fetch API keys');
      const data: ApiKeysResponse = await res.json();
      setKeys(data.keys);
      setCount(data.count);
      setLimit(data.limit);
    } catch {
      setError('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      setError('Name is required');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const res = await apiPost('/api/keys', {
        name: createName.trim(),
        permission: createPermission,
        expiresAt:
          createExpiry === 'custom' && createExpiryDate
            ? new Date(createExpiryDate).toISOString()
            : null,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to create API key');
      }

      const data: CreateKeyResponse = await res.json();

      // Show the new key
      setNewKey(data.key);
      setKeyCopied(false);
      setCopyConfirmed(false);

      // Update the list
      setKeys((prev) => [
        {
          id: data.id,
          name: data.name,
          keyPrefix: data.keyPrefix,
          permission: data.permission,
          expiresAt: data.expiresAt,
          lastUsedAt: null,
          createdAt: data.createdAt,
        },
        ...prev,
      ]);
      setCount(data.count);

      // Reset create modal
      setShowCreateModal(false);
      setCreateName('');
      setCreatePermission('READ_ONLY');
      setCreateExpiry('never');
      setCreateExpiryDate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyKey = async () => {
    if (newKey) {
      await navigator.clipboard.writeText(newKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }
  };

  const handleCloseNewKeyModal = () => {
    if (!copyConfirmed) {
      if (
        !confirm('Are you sure? You will not be able to see this key again.')
      ) {
        return;
      }
    }
    setNewKey(null);
    setSuccess('API key created successfully');
  };

  const handleEdit = (key: ApiKey) => {
    setEditingKey(key);
    setEditName(key.name);
    setEditPermission(key.permission);
    if (key.expiresAt) {
      setEditExpiry('custom');
      setEditExpiryDate(key.expiresAt.split('T')[0]);
    } else {
      setEditExpiry('never');
      setEditExpiryDate('');
    }
  };

  const handleUpdate = async () => {
    if (!editingKey || !editName.trim()) {
      setError('Name is required');
      return;
    }

    setUpdating(true);
    setError('');

    try {
      const res = await apiPatch(`/api/keys/${editingKey.id}`, {
        name: editName.trim(),
        permission: editPermission,
        expiresAt:
          editExpiry === 'custom' && editExpiryDate
            ? new Date(editExpiryDate).toISOString()
            : null,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to update API key');
      }

      const updatedKey: ApiKey = await res.json();
      setKeys((prev) =>
        prev.map((k) => (k.id === updatedKey.id ? updatedKey : k))
      );
      setEditingKey(null);
      setSuccess('API key updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update API key');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (key: ApiKey) => {
    if (
      !confirm(
        `Are you sure you want to revoke "${key.name}"? Any applications using this key will stop working.`
      )
    ) {
      return;
    }

    setDeletingId(key.id);
    setError('');

    try {
      const res = await apiDelete(`/api/keys/${key.id}`);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to revoke API key');
      }

      setKeys((prev) => prev.filter((k) => k.id !== key.id));
      setCount((prev) => prev - 1);
      setSuccess('API key revoked successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRelativeDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never used';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return formatDate(dateStr);
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const isExpiringSoon = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    const expires = new Date(expiresAt);
    const now = new Date();
    const daysUntil =
      (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntil > 0 && daysUntil <= 7;
  };

  const getMinExpiryDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Manage your API keys for programmatic access ({count} of {limit}{' '}
                used)
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              disabled={count >= limit}
              size="sm"
              data-testid="create-api-key-button"
            >
              <Plus className="mr-1 h-4 w-4" />
              Create Key
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}

          {keys.length === 0 ? (
            <div className="py-8 text-center text-gray-500" data-testid="empty-keys-message">
              <Key className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p>No API keys yet</p>
              <p className="text-sm">
                Create your first API key to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="api-keys-list">
              {keys.map((key) => (
                <div
                  key={key.id}
                  data-testid={`api-key-item-${key.id}`}
                  data-key-name={key.name}
                  className={`flex items-center justify-between rounded-lg border p-4 ${
                    isExpired(key.expiresAt)
                      ? 'border-red-200 bg-red-50'
                      : isExpiringSoon(key.expiresAt)
                        ? 'border-yellow-200 bg-yellow-50'
                        : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium" data-testid="api-key-name">{key.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          key.permission === 'READ_WRITE'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {key.permission === 'READ_WRITE'
                          ? 'Read-Write'
                          : 'Read-Only'}
                      </span>
                      {isExpired(key.expiresAt) && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                          Expired
                        </span>
                      )}
                      {isExpiringSoon(key.expiresAt) &&
                        !isExpired(key.expiresAt) && (
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                            Expires soon
                          </span>
                        )}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      <code className="rounded bg-gray-100 px-1 text-xs">
                        {key.keyPrefix}...
                      </code>{' '}
                      &middot;{' '}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeDate(key.lastUsedAt)}
                      </span>
                      {key.expiresAt && (
                        <> &middot; Expires {formatDate(key.expiresAt)}</>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(key)}
                      data-testid="edit-api-key-button"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(key)}
                      disabled={deletingId === key.id}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      data-testid="delete-api-key-button"
                    >
                      {deletingId === key.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {count >= limit && (
            <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                You have reached the maximum number of API keys ({limit}).
                Revoke unused keys to create new ones.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="create-key-modal">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold">Create API Key</h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Name</label>
                <Input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g., CI/CD Pipeline"
                  maxLength={50}
                  data-testid="api-key-name-input"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Permission
                </label>
                <select
                  value={createPermission}
                  onChange={(e) =>
                    setCreatePermission(e.target.value as ApiKeyPermission)
                  }
                  className="w-full rounded-md border px-3 py-2"
                  data-testid="api-key-permission-select"
                >
                  <option value="READ_ONLY">
                    Read-Only (GET requests only)
                  </option>
                  <option value="READ_WRITE">Read-Write (All requests)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Expiration
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateExpiry('never')}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                      createExpiry === 'never'
                        ? 'border-blue-600 bg-blue-50 text-blue-600'
                        : 'border-gray-300'
                    }`}
                  >
                    Never
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateExpiry('custom')}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                      createExpiry === 'custom'
                        ? 'border-blue-600 bg-blue-50 text-blue-600'
                        : 'border-gray-300'
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {createExpiry === 'custom' && (
                  <Input
                    type="date"
                    value={createExpiryDate}
                    onChange={(e) => setCreateExpiryDate(e.target.value)}
                    min={getMinExpiryDate()}
                    className="mt-2"
                  />
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="flex-1"
                data-testid="cancel-create-key-button"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !createName.trim()}
                className="flex-1"
                data-testid="confirm-create-key-button"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Create Key'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New Key Display Modal */}
      {newKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="new-key-modal">
          <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6">
            <h3 className="mb-2 text-lg font-semibold">Your New API Key</h3>
            <p className="mb-4 text-sm text-gray-600">
              Make sure to copy your API key now. You won&apos;t be able to see
              it again!
            </p>

            <div className="rounded-lg bg-gray-100 p-4 font-mono text-sm break-all" data-testid="new-api-key-value">
              {newKey}
            </div>

            <Button
              onClick={handleCopyKey}
              variant="outline"
              className="mt-3 w-full"
              data-testid="copy-api-key-button"
            >
              {keyCopied ? (
                <>
                  <Check className="mr-2 h-4 w-4 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy to Clipboard
                </>
              )}
            </Button>

            <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-yellow-800">
                <input
                  type="checkbox"
                  checked={copyConfirmed}
                  onChange={(e) => setCopyConfirmed(e.target.checked)}
                  className="rounded"
                  data-testid="copy-confirmed-checkbox"
                />
                I have copied my API key to a safe place
              </label>
            </div>

            <Button onClick={handleCloseNewKeyModal} className="mt-4 w-full" data-testid="close-new-key-modal-button">
              Done
            </Button>
          </div>
        </div>
      )}

      {/* Edit Key Modal */}
      {editingKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold">Edit API Key</h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Name</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g., CI/CD Pipeline"
                  maxLength={50}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Permission
                </label>
                <select
                  value={editPermission}
                  onChange={(e) =>
                    setEditPermission(e.target.value as ApiKeyPermission)
                  }
                  className="w-full rounded-md border px-3 py-2"
                >
                  <option value="READ_ONLY">
                    Read-Only (GET requests only)
                  </option>
                  <option value="READ_WRITE">Read-Write (All requests)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Expiration
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditExpiry('never')}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                      editExpiry === 'never'
                        ? 'border-blue-600 bg-blue-50 text-blue-600'
                        : 'border-gray-300'
                    }`}
                  >
                    Never
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditExpiry('custom')}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                      editExpiry === 'custom'
                        ? 'border-blue-600 bg-blue-50 text-blue-600'
                        : 'border-gray-300'
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {editExpiry === 'custom' && (
                  <Input
                    type="date"
                    value={editExpiryDate}
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                    min={getMinExpiryDate()}
                    className="mt-2"
                  />
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setEditingKey(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={updating || !editName.trim()}
                className="flex-1"
              >
                {updating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
