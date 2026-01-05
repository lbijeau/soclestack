# Review: Unified Dynamic Role Architecture - Implementation Plan (Additional Feedback)

**Target Document:** `docs/plans/2026-01-04-unified-role-architecture-impl.md`
**Review Date:** 2026-01-04
**Status:** Review Complete

## Summary
Additional feedback focusing on data integrity, authorization safety, and migration risks.

## Findings & Recommendations

### 1. Unique Constraint With NULL `organizationId` (High)
**Issue:** The plan adds `@@unique([userId, roleId, organizationId])`. In Postgres, `NULL` values are not considered equal for UNIQUE constraints, so multiple platform-wide assignments (org=null) could be inserted for the same user/role.
**Recommendation:** Add a partial unique index to enforce uniqueness when `organizationId` is null (or switch to a composite unique with a sentinel value). Example for Postgres:
```sql
CREATE UNIQUE INDEX user_roles_user_role_platform_unique
ON user_roles (user_id, role_id)
WHERE organization_id IS NULL;
```
Ensure the migration includes this constraint if platform-wide roles must be unique per user/role.

### 2. Avoid `undefined` Context in Authorization (High)
**Issue:** `hasRole` treats `organizationId === undefined` as "any context". This is useful for some utilities, but it can be dangerous if used in request authorization because it might grant access based on roles from unrelated orgs.
**Recommendation:** For API routes, require explicit `organizationId` or `null` and avoid passing `undefined` to authorization helpers. Consider failing fast in route-level helpers if org context is missing when it should be scoped.

### 3. Migration Strategy for Existing Data (Medium)
**Issue:** The plan assumes a DB reset and seed. If any environment has existing data, deleting `organizationRole` and `organizationId` on `User` without a data migration would lose org membership information.
**Recommendation:** Add a migration step or a data backfill script that maps current `User.organizationRole` + `User.organizationId` into `UserRole` rows before removing fields. If this is truly greenfield, explicitly state that data loss is acceptable.

### 4. Role Hierarchy Assumptions for Custom Roles (Medium)
**Issue:** `OrganizationVoter` uses `hasRole(user, 'ROLE_USER', orgId)` to permit org view. This assumes every org role inherits from `ROLE_USER`.
**Recommendation:** Enforce this invariant in role creation (API validation) or update the voter to accept any role assignment in the org rather than requiring ROLE_USER specifically.

### 5. Consistency for Role Name Constants (Low)
**Issue:** The plan references role name strings in multiple locations (frontend, voters, tests). Divergence is a maintenance risk.
**Recommendation:** Introduce a shared constants module (if not already present) and use it in both frontend and backend to avoid typos and drift.

## Proposed Action Items
1. Add a migration or index change for platform-wide uniqueness with `organizationId IS NULL`.
2. Update authorization helpers or route guards to reject `undefined` context where org scoping is required.
3. Clarify migration/data preservation strategy for environments with existing users.
4. Ensure custom roles always inherit from `ROLE_USER`, or adjust voter logic to not rely on that invariant.
5. Centralize role name constants across frontend/backend usage.
