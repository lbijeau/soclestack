# Users API Route (List)

## Purpose

Provides user listing functionality with search, filtering, sorting, and pagination. Restricted to moderators and administrators for user management purposes.

## Contents

### `route.ts`

**HTTP Method**: GET
**Purpose**: List users with advanced filtering and pagination

## API Specification

### Request

```typescript
GET /api/users?page=1&limit=10&search=john&role=USER&isActive=true&sortBy=createdAt&sortOrder=desc
```

### Query Parameters

- **page**: Page number (default: 1)
- **limit**: Items per page (default: 10, max: 100)
- **search**: Search term (searches email, username, firstName, lastName)
- **role**: Filter by role (USER, MODERATOR, ADMIN)
- **isActive**: Filter by account status (true/false)
- **sortBy**: Sort field (createdAt, email, username, firstName, lastName, lastLoginAt)
- **sortOrder**: Sort direction (asc, desc)

### Response (Success - 200)

```typescript
{
  "users": [
    {
      "id": "user-id",
      "email": "user@example.com",
      "username": "username",
      "firstName": "John",
      "lastName": "Doe",
      "role": "USER",
      "isActive": true,
      "emailVerified": true,
      "lastLoginAt": "2024-01-01T12:00:00Z",
      "createdAt": "2024-01-01T12:00:00Z",
      "updatedAt": "2024-01-01T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalUsers": 25,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Error Responses

#### Not Authenticated (401)

```typescript
{
  "error": {
    "type": "AUTHENTICATION_ERROR",
    "message": "Not authenticated"
  }
}
```

#### Insufficient Permissions (403)

```typescript
{
  "error": {
    "type": "AUTHORIZATION_ERROR",
    "message": "Insufficient permissions"
  }
}
```

#### Invalid Parameters (400)

```typescript
{
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": {
      "page": ["Must be a positive integer"],
      "limit": ["Must be between 1 and 100"]
    }
  }
}
```

## Security & Authorization

### Access Control

- **Required Role**: MODERATOR or ADMIN
- **Authentication**: Must have valid session
- **Permissions**: Uses hierarchical role system

### Data Protection

- **Excluded Fields**: Password and sensitive tokens not returned
- **Safe Selection**: Only returns necessary user profile fields
- **No Data Leakage**: Unauthorized users cannot access any user data

## Features

### Search Functionality

- **Multi-field Search**: Searches across email, username, firstName, lastName
- **Partial Matching**: Uses case-insensitive contains search
- **OR Logic**: Matches any of the searched fields

### Filtering

- **Role Filter**: Filter users by specific role
- **Status Filter**: Filter by active/inactive status
- **Combined Filters**: Multiple filters can be applied simultaneously

### Pagination

- **Efficient**: Uses skip/take for database efficiency
- **Complete Metadata**: Returns pagination information for UI
- **Configurable**: Adjustable page size with reasonable limits

### Sorting

- **Multiple Fields**: Sort by various user attributes
- **Flexible Direction**: Ascending or descending order
- **Default Sorting**: Falls back to creation date if not specified

## Business Logic

### Query Processing

1. **Authentication Check**: Verify user is logged in
2. **Authorization Check**: Verify user has moderator+ permissions
3. **Parameter Validation**: Validate all query parameters
4. **Query Building**: Build Prisma where clause from filters
5. **Data Fetching**: Get count and paginated results
6. **Response Building**: Format response with pagination metadata

### Performance Considerations

- **Count Query**: Separate count query for accurate pagination
- **Field Selection**: Only select necessary fields to reduce payload
- **Index Optimization**: Queries designed to use database indexes

## Dependencies

- **@/lib/auth**: `getCurrentUser`, `hasRequiredRole` for authentication
- **@/lib/validations**: `userListParamsSchema` for parameter validation
- **@/lib/db**: Prisma client for database operations
- **@/types/auth**: `AuthError` type definition

## Usage Examples

### Basic User Listing

```typescript
async function getUsers(page = 1, limit = 10) {
  const response = await fetch(`/api/users?page=${page}&limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch users');
  return response.json();
}
```

### Search Users

```typescript
async function searchUsers(searchTerm: string) {
  const params = new URLSearchParams({
    search: searchTerm,
    page: '1',
    limit: '20',
  });

  const response = await fetch(`/api/users?${params}`);
  return response.json();
}
```

### Filter by Role and Status

```typescript
async function getActiveAdmins() {
  const params = new URLSearchParams({
    role: 'ADMIN',
    isActive: 'true',
    sortBy: 'lastLoginAt',
    sortOrder: 'desc',
  });

  const response = await fetch(`/api/users?${params}`);
  return response.json();
}
```

### Admin Dashboard Integration

```typescript
function UserManagementTable() {
  const [users, setUsers] = useState([])
  const [pagination, setPagination] = useState(null)
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    role: '',
    isActive: null
  })

  useEffect(() => {
    const fetchUsers = async () => {
      const params = new URLSearchParams(
        Object.entries(filters)
          .filter(([_, value]) => value !== '' && value !== null)
          .map(([key, value]) => [key, String(value)])
      )

      const response = await fetch(`/api/users?${params}`)
      const data = await response.json()

      setUsers(data.users)
      setPagination(data.pagination)
    }

    fetchUsers()
  }, [filters])

  return (
    // User management table UI
  )
}
```

## Integration Points

- **Admin Dashboard**: Primary data source for user management interfaces
- **User Search**: Used by admin user search functionality
- **Reports**: Data source for user analytics and reporting
- **Moderation Tools**: Used by moderators for user oversight

## Performance Notes

- **Database Indexes**: Ensure indexes on email, username, role, isActive, createdAt
- **Pagination**: Efficient skip/take implementation
- **Field Selection**: Minimal data transfer with select queries
- **Caching**: Consider implementing Redis caching for frequently accessed data

## Related Documentation

- [User Detail API Route](./[id]/README.md) - Individual user operations
- [User Profile API Route](./profile/README.md) - User profile management
- [Admin Components](../../../components/admin/README.md) - User management UI
- [Auth Library](../../../lib/README.md) - Authentication utilities
- [API Examples](../../../../docs/API_EXAMPLES.md) - API usage patterns
- [Technical Architecture](../../../../docs/TECHNICAL_ARCHITECTURE.md) - System design
