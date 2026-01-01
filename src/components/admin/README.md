# Admin Components

## Purpose

Administrative interface components for user management and system administration. These components provide comprehensive tools for moderators and administrators to manage users, roles, and system settings.

## Contents

### `user-management.tsx`

**Purpose**: Comprehensive user management interface for administrators

- **Features**:
  - User listing with pagination and search
  - Role management (USER, MODERATOR, ADMIN)
  - Account status management (active/inactive)
  - Bulk operations for multiple users
  - Real-time search and filtering
  - User profile quick view
  - Action confirmations and feedback

## Key Features

### User Listing & Search

- **Paginated Display**: Efficient handling of large user lists
- **Real-time Search**: Instant search across email, username, and names
- **Advanced Filtering**: Filter by role, status, and registration date
- **Sorting Options**: Sort by various user attributes
- **Responsive Table**: Mobile-friendly user list display

### User Management Operations

- **Role Updates**: Change user roles with proper authorization
- **Status Management**: Activate/deactivate user accounts
- **Profile Viewing**: Quick access to user profile information
- **Session Management**: View and manage user sessions
- **Bulk Actions**: Perform operations on multiple users

### Security & Authorization

- **Admin-Only Access**: Restricted to administrators and moderators
- **Action Confirmations**: Confirm destructive operations
- **Audit Trail**: Track administrative actions
- **Self-Protection**: Prevent admins from modifying their own accounts

## Component Architecture

### Data Management

```typescript
interface UserManagementProps {
  initialUsers?: User[];
  currentUser: User;
  onUserUpdate?: (user: User) => void;
}

interface UserTableState {
  users: User[];
  loading: boolean;
  selectedUsers: string[];
  searchTerm: string;
  filters: UserFilters;
  pagination: PaginationState;
}
```

### API Integration

- **User List API**: `/api/users` for user listing with filters
- **User Update API**: `/api/users/[id]` for individual user operations
- **Real-time Updates**: Optimistic UI updates with error rollback
- **Error Handling**: Comprehensive error states and user feedback

### User Interface Elements

- **Search Bar**: Real-time search with debouncing
- **Filter Dropdowns**: Role and status filtering
- **Action Buttons**: Role change and status toggle buttons
- **Confirmation Modals**: Safety confirmations for critical actions
- **Loading States**: Skeleton loading and spinner states

## Usage Examples

### Basic Implementation

```typescript
import { UserManagement } from '@/components/admin/user-management'

export default function AdminPage() {
  const currentUser = await getCurrentUser()

  if (!hasRequiredRole(currentUser.role, 'MODERATOR')) {
    redirect('/unauthorized')
  }

  return (
    <div className="admin-container">
      <h1>User Management</h1>
      <UserManagement currentUser={currentUser} />
    </div>
  )
}
```

### With Custom Event Handlers

```typescript
function AdminDashboard() {
  const handleUserUpdate = (updatedUser: User) => {
    // Custom logic after user update
    toast.success(`User ${updatedUser.email} updated successfully`)
    // Refresh analytics, send notifications, etc.
  }

  return (
    <UserManagement
      currentUser={currentUser}
      onUserUpdate={handleUserUpdate}
    />
  )
}
```

### Integration with Layout

```typescript
function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        {children}
      </main>
    </div>
  )
}

export default function UserManagementPage() {
  return (
    <AdminLayout>
      <UserManagement currentUser={currentUser} />
    </AdminLayout>
  )
}
```

## Dependencies

### UI Components

- **@/components/ui/button**: Action buttons and controls
- **@/components/ui/input**: Search and filter inputs
- **@/components/ui/card**: User information display
- **@/components/ui/badge**: Role and status indicators
- **@/components/ui/alert**: Success and error messages

### Data & API

- **@/lib/auth**: Authentication and authorization utilities
- **@/types/auth**: TypeScript type definitions
- **@/types/user**: User-related type definitions

### External Libraries

- **React**: State management and component lifecycle
- **Next.js**: Navigation and router hooks
- **clsx**: Conditional styling utility

## Features Implementation

### Search & Filtering

```typescript
const [filters, setFilters] = useState({
  search: '',
  role: '',
  status: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
});

const filteredUsers = useMemo(() => {
  return users.filter((user) => {
    const matchesSearch =
      !filters.search ||
      user.email.includes(filters.search) ||
      user.username?.includes(filters.search);

    const matchesRole = !filters.role || user.role === filters.role;
    const matchesStatus =
      !filters.status ||
      (filters.status === 'active' ? user.isActive : !user.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });
}, [users, filters]);
```

### Role Management

```typescript
const handleRoleChange = async (userId: string, newRole: string) => {
  try {
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });

    if (response.ok) {
      const { user } = await response.json();
      updateUserInState(user);
      toast.success('User role updated successfully');
    }
  } catch (error) {
    toast.error('Failed to update user role');
  }
};
```

### Bulk Operations

```typescript
const handleBulkAction = async (action: string, userIds: string[]) => {
  const confirmationMessage = `Are you sure you want to ${action} ${userIds.length} users?`;

  if (!confirm(confirmationMessage)) return;

  try {
    await Promise.all(
      userIds.map((id) =>
        fetch(`/api/users/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isActive: action === 'activate',
          }),
        })
      )
    );

    // Refresh user list
    await refreshUsers();
    toast.success(`${userIds.length} users ${action}d successfully`);
  } catch (error) {
    toast.error(`Failed to ${action} users`);
  }
};
```

## Security Considerations

- **Authorization Checks**: Verify admin permissions before rendering
- **Action Confirmations**: Require confirmation for destructive actions
- **Self-Protection**: Prevent administrators from modifying their own accounts
- **Audit Logging**: Track all administrative actions for security

## Performance Optimizations

- **Virtualized Lists**: Handle large user lists efficiently
- **Debounced Search**: Prevent excessive API calls during search
- **Optimistic Updates**: Immediate UI feedback with error rollback
- **Pagination**: Server-side pagination for large datasets

## Integration Points

- **Admin Dashboard**: Primary component for user management interface
- **User Profile Pages**: Link to individual user profile management
- **Audit Logs**: Integration with system audit logging
- **Analytics**: User management statistics and reports
