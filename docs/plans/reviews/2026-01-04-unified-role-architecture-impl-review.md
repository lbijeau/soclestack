# Review: Unified Dynamic Role Architecture - Implementation Plan

**Target Document:** `docs/plans/2026-01-04-unified-role-architecture-impl.md`
**Review Date:** 2026-01-04
**Status:** Review Complete

## Summary
The implementation plan provides a comprehensive and detailed roadmap for unifying the platform and organization roles into a single context-aware RBAC system. It aligns well with the design document (`docs/plans/2026-01-04-unified-role-architecture-design.md`) and effectively utilizes the Symfony-style voter pattern.

## Strengths
1.  **Granularity:** The breakdown into phases and atomic tasks is excellent. Each step has clear file targets and code snippets.
2.  **Test-Driven Development:** The plan explicitly includes steps to write failing tests before implementing logic (e.g., Task 1.3, Task 2.1), which ensures robust implementation.
3.  **Context Handling:** The logic for `isGranted` and `hasRole` to handle `organizationId` (specifically the `null` case for platform-wide roles) is well-thought-out and correctly implemented in the snippets.
4.  **Migration Strategy:** The plan correctly identifies the need for a database reset and provides a new seed script, which is appropriate for the current project stage.

## Findings & Recommendations

### 1. Missing `NextAuth` Configuration Updates (Critical)
**Issue:** Phase 3 (UI Components) updates `navbar.tsx` to access `session.user.userRoles`. However, the default NextAuth session object does not include `userRoles`.
**Recommendation:**
*   Add a task to update `src/types/next-auth.d.ts` to extend the `Session` and `User` types.
*   Add a task to update the `session` callback in `src/lib/auth/config.ts` (or wherever `authOptions` is defined) to include `userRoles` in the session token/object. Without this, `session.user.userRoles` will be undefined in the client.

### 2. `getCurrentUser` Implementation
**Issue:** The API routes rely on `getCurrentUser()`. The plan implies this function will return a user with roles loaded.
**Recommendation:**
*   Verify that `getCurrentUser` (likely in `src/lib/session.ts` or `src/lib/auth.ts`) includes the `userRoles` relation in its Prisma query. If it currently selects specific fields or doesn't include relations, the RBAC checks will fail.
*   Explicitly add a step to verify or update `getCurrentUser` to ensure `include: { userRoles: { include: { role: true } } }` is present.

### 3. API Route Context Parsing
**Observation:** Task 2.3 handles `organizationId` from query params, explicitly checking for the string `'null'`.
**Recommendation:** Ensure this pattern is consistent. If `organizationId` is passed as a JSON body field (in POST requests), it will likely be a real `null` or `string`. If passed as a query param (in DELETE requests), it will be a string. The implementation in Task 2.3 handles this, but ensuring consistency across all endpoints is key.

### 4. Role Hierarchy Caching
**Observation:** Task 1.3 mentions `module.clearRoleHierarchyCache()` in tests but doesn't explicitly detail the caching mechanism in the implementation steps.
**Recommendation:** Ensure the `resolveHierarchy` function has a mechanism to invalidate cache if roles are updated (though roles are updated rarely). This is a minor point for now but important for a robust system.

### 5. Frontend "OrgAdminLink" Component
**Observation:** The `OrgAdminLink` component logic in Task 3.2 duplicates some logic from the backend (checking specific role names like 'ROLE_ADMIN' and 'ROLE_OWNER').
**Recommendation:** While inevitable in the frontend, try to keep the role names as constants shared between frontend and backend if possible, or ensure strict parity. The logic `ur.organizationId === organizationId || ur.organizationId === null` is correct for bubbling permissions.

## Proposed Action Items
1.  **Add Task 1.6:** Update NextAuth types and configuration to persist `userRoles` in the session.
2.  **Update Task 2.1:** Verify `getCurrentUser` utility fetches necessary relations.
3.  **Proceed:** With these additions, the plan is ready for execution.
