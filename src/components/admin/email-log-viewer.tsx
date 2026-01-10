'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCw,
  X,
} from 'lucide-react';

// Status labels and colors
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  PENDING: {
    label: 'Pending',
    color: 'text-yellow-800',
    bgColor: 'bg-yellow-100',
  },
  SENT: { label: 'Sent', color: 'text-green-800', bgColor: 'bg-green-100' },
  DELIVERED: {
    label: 'Delivered',
    color: 'text-green-800',
    bgColor: 'bg-green-100',
  },
  FAILED: { label: 'Failed', color: 'text-red-800', bgColor: 'bg-red-100' },
  BOUNCED: { label: 'Bounced', color: 'text-red-800', bgColor: 'bg-red-100' },
};

// Type labels
const TYPE_LABELS: Record<string, string> = {
  verification: 'Verification',
  password_reset: 'Password Reset',
  invite: 'Invite',
  welcome: 'Welcome',
  account_unlock: 'Account Unlock',
  new_device_alert: 'New Device',
  account_locked: 'Account Locked',
  password_changed: 'Password Changed',
  email_changed: 'Email Changed',
  '2fa_enabled': '2FA Enabled',
  '2fa_disabled': '2FA Disabled',
};

interface EmailLog {
  id: string;
  to: string;
  from: string;
  subject: string;
  type: string;
  status: string;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
  userId: string | null;
}

interface EmailLogDetail extends EmailLog {
  htmlBody: string;
  provider: string;
  providerId: string | null;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

interface EmailLogsResponse {
  emails: EmailLog[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface EmailPreviewModalProps {
  email: EmailLogDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onResend: (id: string) => Promise<void>;
  isResending: boolean;
}

function EmailPreviewModal({
  email,
  isOpen,
  onClose,
  onResend,
  isResending,
}: EmailPreviewModalProps) {
  if (!isOpen || !email) return null;

  const canResend = email.status === 'FAILED' || email.status === 'BOUNCED';
  const statusConfig = STATUS_CONFIG[email.status] || {
    label: email.status,
    color: 'text-gray-800',
    bgColor: 'bg-gray-100',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="email-preview-modal-overlay"
    >
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl"
        data-testid="email-preview-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold" data-testid="email-preview-title">
            Email Details
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100"
            data-testid="email-preview-close-button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div
          className="max-h-[calc(90vh-140px)] overflow-y-auto p-4"
          data-testid="email-preview-content"
        >
          {/* Email metadata */}
          <div
            className="mb-4 grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4"
            data-testid="email-preview-metadata"
          >
            <div>
              <span className="text-sm font-medium text-gray-600">To:</span>
              <p className="text-sm">{email.to}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">From:</span>
              <p className="text-sm">{email.from}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">Type:</span>
              <p className="text-sm">{TYPE_LABELS[email.type] || email.type}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">Status:</span>
              <span
                className={`ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
              >
                {statusConfig.label}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">
                Attempts:
              </span>
              <p className="text-sm">{email.attempts}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">Sent:</span>
              <p className="text-sm">{formatDate(email.sentAt)}</p>
            </div>
            {email.user && (
              <div className="col-span-2">
                <span className="text-sm font-medium text-gray-600">User:</span>
                <p className="text-sm">
                  {email.user.firstName || email.user.username || 'Unknown'} (
                  {email.user.email})
                </p>
              </div>
            )}
            {email.lastError && (
              <div className="col-span-2">
                <span className="text-sm font-medium text-gray-600">
                  Error:
                </span>
                <p className="mt-1 rounded bg-red-50 p-2 text-sm text-red-700">
                  {email.lastError}
                </p>
              </div>
            )}
          </div>

          {/* Subject */}
          <div className="mb-4">
            <span className="text-sm font-medium text-gray-600">Subject:</span>
            <p className="mt-1 rounded border bg-gray-50 p-3 text-sm font-medium">
              {email.subject}
            </p>
          </div>

          {/* HTML Body in sandboxed iframe */}
          <div>
            <span className="text-sm font-medium text-gray-600">Body:</span>
            <div className="mt-1 overflow-hidden rounded border">
              <iframe
                srcDoc={email.htmlBody}
                sandbox="allow-same-origin"
                className="h-96 w-full bg-white"
                title="Email preview"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 border-t p-4"
          data-testid="email-preview-footer"
        >
          {canResend && (
            <Button
              onClick={() => onResend(email.id)}
              disabled={isResending}
              variant="primary"
              data-testid="email-preview-resend-button"
            >
              <RotateCw
                className={`mr-2 h-4 w-4 ${isResending ? 'animate-spin' : ''}`}
              />
              {isResending ? 'Resending...' : 'Resend Email'}
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={onClose}
            data-testid="email-preview-close-action"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EmailLogViewer() {
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');

  // Modal state
  const [selectedEmail, setSelectedEmail] = useState<EmailLogDetail | null>(
    null
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const fetchEmails = useCallback(
    async (pageNum: number = 1) => {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      params.set('page', pageNum.toString());
      params.set('pageSize', pageSize.toString());
      if (status) params.set('status', status);
      if (type) params.set('type', type);
      if (search) params.set('search', search);

      try {
        const response = await fetch(`/api/admin/emails?${params}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || 'Failed to fetch emails');
        }

        const data: EmailLogsResponse = await response.json();
        setEmails(data.emails);
        setTotal(data.pagination.total);
        setPage(data.pagination.page);
        setTotalPages(data.pagination.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch emails');
      } finally {
        setLoading(false);
      }
    },
    [status, type, search, pageSize]
  );

  useEffect(() => {
    fetchEmails(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Run only on mount
  }, []);

  const handleApplyFilters = () => {
    setPage(1);
    fetchEmails(1);
  };

  const handleClearFilters = () => {
    setStatus('');
    setType('');
    setSearch('');
    setPage(1);
    setTimeout(() => fetchEmails(1), 0);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      fetchEmails(newPage);
    }
  };

  const handleViewEmail = async (emailId: string) => {
    setLoadingDetail(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/emails/${emailId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to fetch email details');
      }

      const data = await response.json();
      setSelectedEmail(data.email);
      setModalOpen(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch email details'
      );
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleResend = async (emailId: string) => {
    setIsResending(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/emails/${emailId}/resend`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to resend email');
      }

      // Close modal and refresh list
      setModalOpen(false);
      setSelectedEmail(null);
      fetchEmails(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend email');
    } finally {
      setIsResending(false);
    }
  };

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
    <>
      <Card data-testid="email-log-viewer">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle data-testid="email-log-title">Email Logs</CardTitle>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchEmails(page)}
            disabled={loading}
            data-testid="email-log-refresh-button"
          >
            <RefreshCw
              className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="error" data-testid="email-log-error">
              {error}
            </Alert>
          )}

          {/* Filters */}
          <div
            className="flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 p-4"
            data-testid="email-log-filters"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
                data-testid="email-log-status-filter"
              >
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="SENT">Sent</option>
                <option value="DELIVERED">Delivered</option>
                <option value="FAILED">Failed</option>
                <option value="BOUNCED">Bounced</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-10 min-w-[180px] rounded-md border border-gray-200 bg-white px-3 text-sm"
                data-testid="email-log-type-filter"
              >
                <option value="">All types</option>
                <option value="verification">Verification</option>
                <option value="password_reset">Password Reset</option>
                <option value="invite">Invite</option>
                <option value="welcome">Welcome</option>
                <option value="account_unlock">Account Unlock</option>
                <option value="new_device_alert">New Device Alert</option>
                <option value="account_locked">Account Locked</option>
                <option value="password_changed">Password Changed</option>
                <option value="email_changed">Email Changed</option>
                <option value="2fa_enabled">2FA Enabled</option>
                <option value="2fa_disabled">2FA Disabled</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">
                Search
              </label>
              <Input
                type="text"
                placeholder="Email or subject..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56"
                data-testid="email-log-search-filter"
              />
            </div>

            <Button
              onClick={handleApplyFilters}
              disabled={loading}
              data-testid="email-log-apply-filters-button"
            >
              Apply
            </Button>
            <Button
              variant="ghost"
              onClick={handleClearFilters}
              disabled={loading}
              data-testid="email-log-clear-filters-button"
            >
              Clear
            </Button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto" data-testid="email-log-table-container">
            <table className="w-full text-sm" data-testid="email-log-table">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    To
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Subject
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Attempts
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Sent
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody data-testid="email-log-table-body">
                {loading ? (
                  // Skeleton rows
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b" data-testid="email-log-loading-row">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-gray-200" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : emails.length === 0 ? (
                  <tr data-testid="email-log-empty-state">
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No email logs found matching your filters.
                    </td>
                  </tr>
                ) : (
                  emails.map((email) => {
                    const statusConfig = STATUS_CONFIG[email.status] || {
                      label: email.status,
                      color: 'text-gray-800',
                      bgColor: 'bg-gray-100',
                    };
                    const canResend =
                      email.status === 'FAILED' || email.status === 'BOUNCED';

                    return (
                      <tr
                        key={email.id}
                        className="border-b hover:bg-gray-50"
                        data-testid="email-log-row"
                      >
                        <td
                          className="max-w-[200px] truncate px-4 py-3"
                          data-testid="email-log-to"
                        >
                          {email.to}
                        </td>
                        <td
                          className="max-w-[250px] truncate px-4 py-3"
                          data-testid="email-log-subject"
                        >
                          {email.subject}
                        </td>
                        <td className="px-4 py-3" data-testid="email-log-type">
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                            {TYPE_LABELS[email.type] || email.type}
                          </span>
                        </td>
                        <td className="px-4 py-3" data-testid="email-log-status">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                          >
                            {statusConfig.label}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3 text-center"
                          data-testid="email-log-attempts"
                        >
                          {email.attempts}
                        </td>
                        <td
                          className="px-4 py-3 whitespace-nowrap"
                          data-testid="email-log-sent"
                        >
                          {formatDate(email.sentAt)}
                        </td>
                        <td className="px-4 py-3" data-testid="email-log-actions">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewEmail(email.id)}
                              disabled={loadingDetail}
                              data-testid="email-log-view-button"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canResend && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResend(email.id)}
                                disabled={isResending}
                                title="Resend email"
                                data-testid="email-log-resend-button"
                              >
                                <RotateCw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 0 && (
            <div
              className="flex items-center justify-between border-t pt-4"
              data-testid="email-log-pagination"
            >
              <div
                className="text-sm text-gray-600"
                data-testid="email-log-pagination-info"
              >
                Showing {(page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, total)} of {total} results
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1 || loading}
                  data-testid="email-log-prev-page"
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
                      data-testid={`email-log-page-${p}`}
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
                  data-testid="email-log-next-page"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Preview Modal */}
      <EmailPreviewModal
        email={selectedEmail}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedEmail(null);
        }}
        onResend={handleResend}
        isResending={isResending}
      />
    </>
  );
}
