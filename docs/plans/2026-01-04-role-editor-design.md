# Role Editor Component - Story 5.2 Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build role create/edit pages at `/admin/roles/new` and `/admin/roles/[id]` with shared form component.

**Architecture:** Server component pages pass roleId to client RoleEditor component. Single component handles both modes.

**Tech Stack:** Next.js 15, React, Tailwind CSS, lucide-react icons

---

## File Structure

```
src/app/admin/roles/
├── page.tsx              # List (done)
├── new/
│   └── page.tsx          # Create page - passes no roleId
└── [id]/
    └── page.tsx          # Edit page - passes roleId

src/components/admin/
└── role-editor.tsx       # Shared form component
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
  userCount?: number;
  childRoles?: { id: string; name: string }[];
}

interface RoleEditorProps {
  roleId?: string;  // undefined = create mode
}
```

## Form Fields

| Field | Create | Edit | System Role Edit |
|-------|--------|------|------------------|
| Name | Text input (required) | Readonly display | Readonly display |
| Description | Textarea (optional) | Textarea | Textarea |
| Parent Role | Dropdown (optional) | Dropdown | Readonly display |

## Parent Dropdown Logic

1. Fetch all roles from `/api/admin/roles`
2. Exclude self (in edit mode)
3. Exclude descendants (to prevent cycles)
4. Show "None (root role)" as first option
5. API validates cycles server-side as backup

## Validation

- **Name:** Required, must match `ROLE_[A-Z][A-Z0-9_]*`
- **Description:** Optional, max 500 chars
- Client-side validation before submit
- Server errors displayed inline

## UI States

### Loading
- Initial: Skeleton form fields
- Submitting: Button spinner, form disabled
- Deleting: Button spinner, modal disabled

### Errors
- Fetch error: Alert banner with retry
- Validation: Inline red text below field
- Submit error: Alert banner at top
- Delete error: Error in modal

### Success
- Create/Update/Delete: Redirect to `/admin/roles`

## Delete Confirmation

- Modal: "Delete role ROLE_NAME?"
- Warning about permanence
- Type role name to confirm
- Shows error if role has users or children

## API Endpoints

- `GET /api/admin/roles` - List for parent dropdown
- `POST /api/admin/roles` - Create role
- `GET /api/admin/roles/[id]` - Get role details
- `PATCH /api/admin/roles/[id]` - Update role
- `DELETE /api/admin/roles/[id]` - Delete role

## Implementation Tasks

### Task 1: Create RoleEditor component
- Create `src/components/admin/role-editor.tsx`
- Implement props interface and state
- Add fetch logic for role and allRoles
- Handle loading/error states

### Task 2: Implement form UI
- Add form fields (name, description, parent dropdown)
- Handle readonly states for edit/system roles
- Add client-side validation
- Style with existing UI patterns

### Task 3: Implement save functionality
- POST for create, PATCH for edit
- Handle success redirect
- Display server errors inline

### Task 4: Implement delete functionality
- Add delete button (non-system only)
- Add confirmation modal with name typing
- Handle delete API call
- Display errors in modal

### Task 5: Create page components
- Create `src/app/admin/roles/new/page.tsx`
- Create `src/app/admin/roles/[id]/page.tsx`
- Add auth checks, metadata

### Task 6: Add tests
- Unit tests for validation logic
- Unit tests for parent filtering logic
