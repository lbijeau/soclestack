# Admin Panel Page

## Purpose
Administrative dashboard that provides comprehensive user management capabilities and system statistics. Restricted to moderators and administrators with full user management interface.

## Contents

### `page.tsx`
**Purpose**: Main administrative interface with user management and system overview
- **Features**:
  - Role-based access control (MODERATOR+ required)
  - Real-time user statistics dashboard
  - Comprehensive user management interface
  - Responsive layout with navigation
  - Database statistics and insights
  - Security-focused administrative tools

## Page Structure

### Authentication & Authorization
- **Authentication Check**: Verifies user is logged in
- **Role Verification**: Requires MODERATOR or ADMIN role
- **Automatic Redirects**: Redirects unauthorized users appropriately
- **Return URL Handling**: Maintains intended destination after login

### Dashboard Sections
- **Statistics Overview**: Key metrics displayed in cards
- **User Management**: Full user administration interface
- **Navigation Integration**: Includes main application navigation

## Key Features

### Access Control
```typescript
const user = await getCurrentUser()

if (!user) {
  redirect('/login?returnUrl=/admin')
}

if (!hasRequiredRole(user.role, 'MODERATOR')) {
  redirect('/dashboard')
}
```

### Statistics Dashboard
- **Total Users**: Complete user count across system
- **Active Users**: Currently active user accounts
- **Inactive Users**: Deactivated user accounts
- **Administrator Count**: Number of admin-level users

### User Management Interface
- **Complete User Control**: View, edit, and manage all users
- **Role Management**: Change user roles with proper authorization
- **Status Management**: Activate/deactivate user accounts
- **Search & Filtering**: Advanced user search and filtering
- **Bulk Operations**: Perform actions on multiple users

## Technical Implementation

### Server-Side Data Fetching
```typescript
const [totalUsers, activeUsers, inactiveUsers, adminUsers] = await Promise.all([
  prisma.user.count(),
  prisma.user.count({ where: { isActive: true } }),
  prisma.user.count({ where: { isActive: false } }),
  prisma.user.count({ where: { role: 'ADMIN' } }),
])
```

### Statistics Display
```typescript
const stats = [
  {
    title: 'Total Users',
    value: totalUsers,
    icon: Users,
    color: 'text-blue-600',
  },
  {
    title: 'Active Users',
    value: activeUsers,
    icon: Activity,
    color: 'text-green-600',
  },
  // ... more statistics
]
```

### Dynamic Rendering
```typescript
export const dynamic = 'force-dynamic'
```

## Dependencies

### Authentication
- **@/lib/auth**: `getCurrentUser`, `hasRequiredRole` for access control
- **@/lib/db**: Prisma client for database statistics

### Components
- **@/components/navigation/navbar**: Main application navigation
- **@/components/admin/user-management**: Complete user management interface
- **@/components/ui/card**: Statistics display containers

### External Libraries
- **lucide-react**: Icons for statistics display (Users, Shield, Activity, AlertTriangle)
- **Next.js**: Server-side rendering and navigation

## Security Features

### Role-Based Access
- **Moderator Access**: Minimum MODERATOR role required
- **Admin Privileges**: Full administrative capabilities
- **Hierarchical Permissions**: Respects role hierarchy

### Route Protection
- **Authentication Required**: Must be logged in to access
- **Authorization Enforcement**: Role verification on every request
- **Secure Redirects**: Proper redirect handling for unauthorized access

### Data Security
- **Server-Side Verification**: All access checks on server
- **Database Security**: Secure database queries with proper filtering
- **Audit Trail**: Administrative actions logged for security

## Performance Considerations

### Database Optimization
```typescript
// Parallel database queries for efficiency
const [totalUsers, activeUsers, inactiveUsers, adminUsers] = await Promise.all([
  prisma.user.count(),
  prisma.user.count({ where: { isActive: true } }),
  prisma.user.count({ where: { isActive: false } }),
  prisma.user.count({ where: { role: 'ADMIN' } }),
])
```

### Rendering Strategy
- **Dynamic Rendering**: `force-dynamic` for real-time data
- **Server-Side Data**: Statistics fetched on server for performance
- **Component Optimization**: Efficient user management component

## Layout Design

### Header Section
- **Page Title**: "Admin Panel" with description
- **Breadcrumb**: Clear navigation context
- **Action Buttons**: Administrative actions

### Statistics Grid
- **Responsive Grid**: Adapts from 1 to 4 columns based on screen size
- **Icon Integration**: Visual indicators for each statistic
- **Color Coding**: Status-based color scheme

### User Management Section
- **Card Container**: Clean separation of functionality
- **Full-Width Interface**: Maximum space for user management
- **Integrated Search**: Built-in search and filtering

## Usage Examples

### Direct Admin Access
```typescript
// URL: /admin
// Required: MODERATOR or ADMIN role
// Features: Full administrative interface
```

### From Protected Routes
```typescript
// Middleware redirects unauthorized users
// Maintains return URL for proper flow
// Ensures secure access to administrative features
```

### Navigation Integration
```typescript
// Accessible via navigation menu for authorized users
// Role-based menu items show/hide admin links
// Consistent navigation experience
```

## Statistics Displayed

### User Metrics
- **Total Users**: Complete count of all registered users
- **Active Users**: Users with `isActive: true`
- **Inactive Users**: Users with `isActive: false`
- **Administrators**: Users with `role: 'ADMIN'`

### Visual Indicators
- **Icons**: Lucide React icons for visual clarity
- **Colors**: Status-based color coding
- **Layout**: Responsive grid for optimal display

## Integration Points

### User Management System
- **Direct Integration**: Uses UserManagement component
- **Real-time Updates**: Statistics reflect current database state
- **Action Feedback**: Administrative actions update interface

### Authentication System
- **Session Verification**: Continuous authentication checking
- **Role Enforcement**: Hierarchical permission system
- **Security Logging**: Administrative action tracking

### Navigation System
- **Navbar Integration**: Consistent site navigation
- **Role-based Menus**: Adaptive navigation based on permissions
- **Breadcrumb Support**: Clear navigation context

## SEO & Metadata
- **Page Title**: "Admin Panel - SocleStack"
- **Description**: "Admin panel for user management"
- **Robots**: Should be excluded from search engines (noindex)
- **Security**: No sensitive data in metadata