# Audit Log Viewer Design

**Date:** 2025-11-30
**Status:** Ready for implementation

## Overview

Admin page to view, filter, and export security audit events.

- **Location:** `/admin/audit-logs`
- **Access:** ADMIN role only
- **Features:** Filter by category/action/user/date, pagination, CSV export

## Filter UI

Horizontal filter bar:

```
[Category ▾] [Action ▾] [User search...] [From date] [To date] [Apply] [Clear]
```

**Category Dropdown:**
- All categories (default)
- Authentication
- Security
- Admin

**Action Dropdown:**
- Grouped by category
- Human-readable labels (e.g., "Login Success" not "AUTH_LOGIN_SUCCESS")

**User Search:**
- Text input for email search (partial match)

**Date Range:**
- Two date pickers (from/to)
- Defaults to "Last 7 days"

## Table Display

| Timestamp | User | Action | Category | IP Address | Details |
|-----------|------|--------|----------|------------|---------|

**Column Details:**
- **Timestamp** - "Nov 30, 2025 14:32:05" format, sorted desc by default
- **User** - Email or "System" if no userId
- **Action** - Human-readable with color-coded badge
- **Category** - Authentication, Security, Admin
- **IP Address** - Raw IP or "—"
- **Details** - Expandable/tooltip for metadata JSON

**Action Badge Colors:**
- 🟢 Green: LOGIN_SUCCESS, 2FA_SUCCESS, 2FA_ENABLED
- 🔴 Red: LOGIN_FAILURE, 2FA_FAILURE, ACCOUNT_LOCKED, THEFT_DETECTED
- 🟡 Amber: ACCOUNT_UNLOCKED, 2FA_DISABLED, IMPERSONATION_*
- 🔵 Blue: LOGOUT, REMEMBER_ME_*, PASSWORD_CHANGED, SESSION_REVOKED

## Pagination

```
Showing 1-50 of 1,234 results    [← Prev] [1] [2] [3] ... [25] [Next →]
```

- 50 items per page (fixed)
- Page numbers with ellipsis for large sets

## Export

- Button: `[↓ Export CSV]` (top right)
- Client-side generation from filtered results
- Fetches up to 10,000 records
- Filename: `audit-logs-YYYY-MM-DD.csv`

## API Endpoint

`GET /api/admin/audit-logs`

**Query Parameters:**
- `category` - Filter by category (optional)
- `action` - Filter by action type (optional)
- `userEmail` - Partial email search (optional)
- `from` - ISO date string (optional)
- `to` - ISO date string (optional)
- `page` - Page number, default 1
- `limit` - Items per page, default 50 (max 100, or 10000 for export)

**Response:**
```json
{
  "logs": [...],
  "total": 1234,
  "page": 1,
  "pageSize": 50,
  "totalPages": 25
}
```

## File Structure

```
src/
├── app/
│   ├── admin/
│   │   ├── audit-logs/
│   │   │   └── page.tsx          # Server component, auth check
│   │   └── page.tsx              # Add link to audit logs
│   └── api/
│       └── admin/
│           └── audit-logs/
│               └── route.ts      # GET endpoint with filters
├── components/
│   └── admin/
│       └── audit-log-viewer.tsx  # Client component
└── lib/
    └── audit.ts                  # Extend for email search + count
```

## Backend Changes

Extend `getAuditLogs()` in `src/lib/audit.ts`:
- Add `userEmail` parameter for partial email search (join with User table)
- Return total count for pagination

## Middleware

Add `/admin/audit-logs` to protected routes.
