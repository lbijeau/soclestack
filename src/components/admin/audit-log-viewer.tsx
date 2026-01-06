'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

// Action labels for human-readable display
const ACTION_LABELS: Record<string, string> = {
  AUTH_LOGIN_SUCCESS: 'Login Success',
  AUTH_LOGIN_FAILURE: 'Login Failure',
  AUTH_LOGOUT: 'Logout',
  AUTH_REMEMBER_ME_CREATED: 'Remember Me Created',
  AUTH_REMEMBER_ME_USED: 'Remember Me Used',
  AUTH_REMEMBER_ME_REVOKED: 'Remember Me Revoked',
  AUTH_REMEMBER_ME_THEFT_DETECTED: 'Token Theft Detected',
  SECURITY_ACCOUNT_LOCKED: 'Account Locked',
  SECURITY_ACCOUNT_UNLOCKED: 'Account Unlocked',
  SECURITY_PASSWORD_CHANGED: 'Password Changed',
  SECURITY_ALL_SESSIONS_REVOKED: 'All Sessions Revoked',
  AUTH_2FA_ENABLED: '2FA Enabled',
  AUTH_2FA_DISABLED: '2FA Disabled',
  AUTH_2FA_SUCCESS: '2FA Success',
  AUTH_2FA_FAILURE: '2FA Failure',
  AUTH_2FA_BACKUP_USED: '2FA Backup Used',
  ADMIN_2FA_RESET: '2FA Reset by Admin',
  ADMIN_IMPERSONATION_START: 'Impersonation Started',
  ADMIN_IMPERSONATION_END: 'Impersonation Ended',
  ADMIN_IMPERSONATION_EXPIRED: 'Impersonation Expired',
};

// Action color mapping
const ACTION_COLORS: Record<string, string> = {
  // Green - success
  AUTH_LOGIN_SUCCESS: 'bg-green-100 text-green-800',
  AUTH_2FA_SUCCESS: 'bg-green-100 text-green-800',
  AUTH_2FA_ENABLED: 'bg-green-100 text-green-800',
  // Red - failure/security concern
  AUTH_LOGIN_FAILURE: 'bg-red-100 text-red-800',
  AUTH_2FA_FAILURE: 'bg-red-100 text-red-800',
  SECURITY_ACCOUNT_LOCKED: 'bg-red-100 text-red-800',
  AUTH_REMEMBER_ME_THEFT_DETECTED: 'bg-red-100 text-red-800',
  // Amber - warning/notable
  SECURITY_ACCOUNT_UNLOCKED: 'bg-amber-100 text-amber-800',
  AUTH_2FA_DISABLED: 'bg-amber-100 text-amber-800',
  ADMIN_IMPERSONATION_START: 'bg-amber-100 text-amber-800',
  ADMIN_IMPERSONATION_END: 'bg-amber-100 text-amber-800',
  ADMIN_IMPERSONATION_EXPIRED: 'bg-amber-100 text-amber-800',
  ADMIN_2FA_RESET: 'bg-amber-100 text-amber-800',
  // Blue - info
  AUTH_LOGOUT: 'bg-blue-100 text-blue-800',
  AUTH_REMEMBER_ME_CREATED: 'bg-blue-100 text-blue-800',
  AUTH_REMEMBER_ME_USED: 'bg-blue-100 text-blue-800',
  AUTH_REMEMBER_ME_REVOKED: 'bg-blue-100 text-blue-800',
  SECURITY_PASSWORD_CHANGED: 'bg-blue-100 text-blue-800',
  SECURITY_ALL_SESSIONS_REVOKED: 'bg-blue-100 text-blue-800',
  AUTH_2FA_BACKUP_USED: 'bg-blue-100 text-blue-800',
};

// Actions grouped by category for dropdown
const ACTIONS_BY_CATEGORY = {
  authentication: [
    'AUTH_LOGIN_SUCCESS',
    'AUTH_LOGIN_FAILURE',
    'AUTH_LOGOUT',
    'AUTH_REMEMBER_ME_CREATED',
    'AUTH_REMEMBER_ME_USED',
    'AUTH_REMEMBER_ME_REVOKED',
    'AUTH_REMEMBER_ME_THEFT_DETECTED',
    'AUTH_2FA_ENABLED',
    'AUTH_2FA_DISABLED',
    'AUTH_2FA_SUCCESS',
    'AUTH_2FA_FAILURE',
    'AUTH_2FA_BACKUP_USED',
  ],
  security: [
    'SECURITY_ACCOUNT_LOCKED',
    'SECURITY_ACCOUNT_UNLOCKED',
    'SECURITY_PASSWORD_CHANGED',
    'SECURITY_ALL_SESSIONS_REVOKED',
  ],
  admin: [
    'ADMIN_2FA_RESET',
    'ADMIN_IMPERSONATION_START',
    'ADMIN_IMPERSONATION_END',
    'ADMIN_IMPERSONATION_EXPIRED',
  ],
};

interface AuditLog {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  category: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getDefaultFromDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString().split('T')[0];
}

function getDefaultToDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  // Filters
  const [category, setCategory] = useState('');
  const [action, setAction] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [fromDate, setFromDate] = useState(getDefaultFromDate());
  const [toDate, setToDate] = useState(getDefaultToDate());

  // Expanded rows for metadata
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(
    async (pageNum: number = 1) => {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      params.set('page', pageNum.toString());
      params.set('limit', '50');
      if (category) params.set('category', category);
      if (action) params.set('action', action);
      if (userEmail) params.set('userEmail', userEmail);
      if (fromDate) params.set('from', new Date(fromDate).toISOString());
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        params.set('to', to.toISOString());
      }

      try {
        const response = await fetch(`/api/admin/audit-logs?${params}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || 'Failed to fetch logs');
        }

        const data: AuditLogsResponse = await response.json();
        setLogs(data.logs);
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(data.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      } finally {
        setLoading(false);
      }
    },
    [category, action, userEmail, fromDate, toDate]
  );

  useEffect(() => {
    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally run only on mount; filter changes are applied via handleApplyFilters button
  }, []);

  const handleApplyFilters = () => {
    setPage(1);
    fetchLogs(1);
  };

  const handleClearFilters = () => {
    setCategory('');
    setAction('');
    setUserEmail('');
    setFromDate(getDefaultFromDate());
    setToDate(getDefaultToDate());
    setPage(1);
    // Fetch will happen on next render
    setTimeout(() => fetchLogs(1), 0);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      fetchLogs(newPage);
    }
  };

  const toggleRowExpanded = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    setError('');

    const params = new URLSearchParams();
    params.set('format', format);
    if (category) params.set('category', category);
    if (action) params.set('action', action);
    if (userEmail) params.set('userEmail', userEmail);
    if (fromDate) params.set('from', new Date(fromDate).toISOString());
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      params.set('to', to.toISOString());
    }

    try {
      const response = await fetch(`/api/admin/audit-logs/export?${params}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to export logs');
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      // Download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export logs');
    } finally {
      setExporting(false);
    }
  };

  // Get available actions based on selected category
  const availableActions = category
    ? ACTIONS_BY_CATEGORY[category as keyof typeof ACTIONS_BY_CATEGORY] || []
    : Object.values(ACTIONS_BY_CATEGORY).flat();

  // Pagination numbers
  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(
          1,
          '...',
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages
        );
      } else {
        pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Audit Logs</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchLogs(page)}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleExport('csv')}
            disabled={exporting || loading}
          >
            <Download className="mr-1 h-4 w-4" />
            {exporting ? 'Exporting...' : 'CSV'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleExport('json')}
            disabled={exporting || loading}
          >
            <Download className="mr-1 h-4 w-4" />
            JSON
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setAction(''); // Reset action when category changes
              }}
              className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="">All categories</option>
              <option value="authentication">Authentication</option>
              <option value="security">Security</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="h-10 min-w-[180px] rounded-md border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="">All actions</option>
              {availableActions.map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABELS[a] || a}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">
              User Email
            </label>
            <Input
              type="text"
              placeholder="Search email..."
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="w-48"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">From</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-40"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">To</label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-40"
            />
          </div>

          <Button onClick={handleApplyFilters} disabled={loading}>
            Apply
          </Button>
          <Button
            variant="ghost"
            onClick={handleClearFilters}
            disabled={loading}
          >
            Clear
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  User
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Action
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Category
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  IP Address
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Skeleton rows
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-gray-200" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No audit logs found matching your filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <Fragment key={log.id}>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {log.userEmail || (
                          <span className="text-gray-400">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            ACTION_COLORS[log.action] ||
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize">{log.category}</td>
                      <td className="px-4 py-3">
                        {log.ipAddress || (
                          <span className="text-gray-400">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.metadata ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRowExpanded(log.id)}
                            className="text-xs"
                          >
                            {expandedRows.has(log.id) ? 'Hide' : 'Show'}
                          </Button>
                        ) : (
                          <span className="text-gray-400">&mdash;</span>
                        )}
                      </td>
                    </tr>
                    {expandedRows.has(log.id) && log.metadata && (
                      <tr key={`${log.id}-metadata`} className="bg-gray-50">
                        <td colSpan={6} className="px-4 py-3">
                          <pre className="overflow-x-auto rounded bg-gray-100 p-3 text-xs">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 0 && (
          <div className="flex items-center justify-between border-t pt-4">
            <div className="text-sm text-gray-600">
              Showing {(page - 1) * 50 + 1}-{Math.min(page * 50, total)} of{' '}
              {total} results
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              {getPageNumbers().map((p, i) =>
                typeof p === 'number' ? (
                  <Button
                    key={i}
                    variant={p === page ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => handlePageChange(p)}
                    disabled={loading}
                    className="min-w-[36px]"
                  >
                    {p}
                  </Button>
                ) : (
                  <span key={i} className="px-2 text-gray-400">
                    {p}
                  </span>
                )
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages || loading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
