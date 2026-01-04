# Admin Roles UI - Story 5.1 Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the role list page at `/admin/roles` with hierarchy tree visualization.

**Architecture:** Server component page with client component list. Fetch roles from existing API, build tree client-side, render with depth-based indentation.

**Tech Stack:** Next.js 15, React, Tailwind CSS, lucide-react icons

---

## File Structure

```
src/app/admin/roles/
└── page.tsx              # Server component, auth check

src/components/admin/
└── role-list.tsx         # Client component with tree view
```

## Data Types

```typescript
interface Role {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  parentName: string | null;
  isSystem: boolean;
  userCount: number;
}

interface TreeNode extends Role {
  children: TreeNode[];
  depth: number;
}
```

## Tree Building Algorithm

1. Fetch flat list from `/api/admin/roles`
2. Find root roles (`parentId === null`)
3. Recursively attach children to each node
4. Flatten tree back to list with `depth` property for rendering
5. Render with depth-based padding (`pl-${depth * 6}`)

## Page Component

**File:** `src/app/admin/roles/page.tsx`

- Server component with `force-dynamic`
- Auth check: redirect to login if not authenticated
- Admin check: redirect to `/admin` if not ROLE_ADMIN
- Render header with title, description, "+ New Role" button
- Render Card with RoleList component

## RoleList Component

**File:** `src/components/admin/role-list.tsx`

### States
- Loading: Skeleton rows (4 placeholders)
- Error: Alert component with error message
- Empty: Icon + "No roles found" message
- Success: Tree list with clickable rows

### Row Display
```
[indent] [icon] ROLE_NAME [system badge?] [user count] [chevron]
```

- Indentation: CSS padding based on depth
- Icon: Shield icon for roles
- System badge: Gray pill "System" for `isSystem: true`
- User count: Users icon + number
- Chevron: Right arrow, visible on hover
- Click: Navigate to `/admin/roles/[id]`

### Visual Hierarchy
```
ROLE_USER (system)                    45 users  →
  └─ ROLE_MODERATOR (system)           5 users  →
      └─ ROLE_ADMIN (system)           2 users  →
ROLE_SUPPORT                           3 users  →
  └─ ROLE_SUPPORT_LEAD                 1 user   →
```

Tree connectors rendered via CSS borders/pseudo-elements.

## Implementation Tasks

### Task 1: Create page component
- Create `src/app/admin/roles/page.tsx`
- Add auth/admin checks with redirects
- Add page header with title and "+ New Role" button
- Add Card wrapper for RoleList
- Add metadata export

### Task 2: Create RoleList component
- Create `src/components/admin/role-list.tsx`
- Implement fetch from `/api/admin/roles`
- Add loading, error, empty states
- Build tree structure from flat list

### Task 3: Implement tree rendering
- Add depth-based indentation
- Add tree connector styling
- Add system badge for isSystem roles
- Add user count display
- Add click handler for navigation

### Task 4: Add to admin navigation
- Update navbar to include Roles link under Admin section

## Testing

- Manual testing of hierarchy display
- Verify click navigation works
- Verify loading/error states
- Verify system badge display
