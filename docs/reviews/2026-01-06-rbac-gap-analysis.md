# RBAC / Authorization Gap Analysis

**Date:** 2026-01-06
**Scope:** SocleStack
**Reference Models:** Symfony Security, ScienceLogic Access Hooks, Enterprise RBAC

---

## Overall Alignment

**Classification: `hybrid_rbac`**

The system implements a hybrid role + voter model following Symfony patterns:
- Roles for broad access levels (ROLE_ADMIN, ROLE_USER, etc.)
- Voters for contextual permission checks (organization.edit, user.delete)
- Organization-scoped role assignments supported

---

## Section Scores

| Section | Status | Coverage |
|---------|--------|----------|
| Authorization Model | ✅ Implemented | 4/5 |
| Permission Definition | ⚠️ Partial | 2/4 |
| Assignment | ✅ Implemented | 5/5 |
| Evaluation Logic | ✅ Implemented | 4/4 |
| Resource Awareness | ✅ Implemented | 3/3 |
| Hierarchy | ✅ Implemented | 4/4 |
| Multi-Tenancy | ✅ Implemented | 3/3 |
| Admin UI | ⚠️ Partial | 4/5 |
| Docs Sync | ⚠️ Partial | 2/4 |
| Extensibility | ⚠️ Partial | 2/4 |
| Security | ✅ Implemented | 3/4 |

---

## Gap List

| check_id | severity | status | description |
|----------|----------|--------|-------------|
| `permission_identifiers` | medium | partial | Voters use string literals (`organization.edit`), not explicit permission identifiers. No canonical Permission enum/type. |
| `static_definitions` | medium | partial | Role names defined in `ROLE_NAMES` constant but voter attributes are inline strings. |
| `canonical_list` | high | missing | No single canonical list of all permissions. Voter attributes scattered across voter files. |
| `typo_protection` | high | partial | Role names use constants; voter attributes use raw strings - typos possible. |
| `version_controlled` | low | implemented | Roles are DB-backed but not refactor-safe (string-based lookups). |
| `permission_group_ui` | medium | missing | No UI to manage permission groups or voter attributes. Only role management exists. |
| `safeguards` | medium | partial | `isSystem` flag protects roles from deletion but no protection for critical permission removal from users. |
| `undocumented_features` | low | partial | UserVoter has TODO comment for #183 but #183 is closed - comment outdated. |
| `missing_features` | medium | partial | Docs describe unified architecture but don't document voter permissions. |
| `example_accuracy` | low | partial | Design doc examples accurate but no API permission reference documentation. |
| `roadmap_clarity` | low | partial | TODO comments exist but reference closed issues. |
| `new_permissions` | medium | partial | New roles easy to add; new voter attributes require code changes. |
| `group_extension` | medium | missing | No permission group concept - only role hierarchy. |
| `external_integration` | medium | partial | Voter pattern compatible with Symfony; no JWT role claim validation against DB state. |
| `enterprise_ready` | low | partial | Good foundation but lacks fine-grained permission management. |
| `jwt_validation` | high | missing | No JWT role claim validation against server-side role assignments. |

---

## Doc-Code Mismatches

| Location | Issue |
|----------|-------|
| `src/lib/security/voters/user-voter.ts:10-13` | TODO references #183 which is now closed |
| `docs/plans/*-design.md` | Design docs don't document voter permission attributes |
| `ROLE_OWNER`, `ROLE_EDITOR` | Defined in constants but no matching roles in seed data |

---

## Top Recommendations

### 1. Create Canonical Permission Registry (High Priority)

```typescript
// src/lib/security/permissions.ts
export const PERMISSIONS = {
  ORGANIZATION: {
    VIEW: 'organization.view',
    EDIT: 'organization.edit',
    DELETE: 'organization.delete',
    // ...
  },
  USER: {
    VIEW: 'user.view',
    EDIT: 'user.edit',
    // ...
  },
} as const;
```

Refactor voters to use these constants instead of string literals.

### 2. Add JWT Role Claim Validation (High Priority)

Server should validate that roles in JWT claims match current DB state:
- On login: embed roles in JWT
- On each request: optionally verify JWT roles against DB (or use short token expiry)
- On role change: invalidate affected sessions

### 3. Document Permission Attributes (Medium Priority)

Create `docs/PERMISSIONS.md` listing all voter attributes with:
- Attribute name
- Required context (subject type)
- Required role(s)
- Example usage

### 4. Clean Up Stale TODOs (Low Priority)

Remove or update TODO comments referencing completed issues (#183).

### 5. Add Permission Group Concept (Future)

If enterprise customers need fine-grained control, consider:
- Permission groups that map to sets of voter attributes
- UI to assign permission groups to roles
- This is NOT blocking - current role-based model is sufficient for most use cases

---

## Unsupported Features

| Feature | Status | Notes |
|---------|--------|-------|
| Explicit permission identifiers | Not implemented | Uses string-based voter attributes |
| Permission groups | Not implemented | Only role hierarchy exists |
| JWT claim validation | Not implemented | No DB verification of JWT roles |
| Permission management UI | Not implemented | Only role management UI exists |
| Dynamic voter registration | Not implemented | Voters are hardcoded in registry |

---

## Detailed Section Analysis

### Authorization Model Fundamentals

| Check | Status | Notes |
|-------|--------|-------|
| role_vs_permission | ✅ Implemented | Hybrid: roles + voter permissions |
| permission_identifiers | ⚠️ Partial | String literals, no canonical type |
| separation_of_concerns | ✅ Implemented | Clear separation: Role, UserRole, Voter |
| composability | ✅ Implemented | Role hierarchy + org-scoped assignments |
| doc_alignment | ✅ Implemented | Code matches unified architecture design |

### Permission Definition & Source of Truth

| Check | Status | Notes |
|-------|--------|-------|
| static_definitions | ⚠️ Partial | ROLE_NAMES constant exists; voter attrs are inline |
| canonical_list | ❌ Missing | Permissions scattered across voter files |
| version_controlled | ✅ Implemented | Roles in DB, versioned via migrations |
| typo_protection | ⚠️ Partial | Role constants prevent typos; voter attrs don't |

### Role / Permission Assignment

| Check | Status | Notes |
|-------|--------|-------|
| db_backed | ✅ Implemented | Role, UserRole tables |
| multi_assignment | ✅ Implemented | Users can have multiple roles per org |
| dynamic_changes | ✅ Implemented | No redeploy needed for role changes |
| auditability | ✅ Implemented | ADMIN_USER_ROLE_* audit events |
| defaults | ✅ Implemented | ROLE_USER assigned on registration |

### Authorization Evaluation Logic

| Check | Status | Notes |
|-------|--------|-------|
| centralized_api | ✅ Implemented | `isGranted()` is the central check |
| consistency | ✅ Implemented | All routes use isGranted or requireAdmin |
| enforcement_layers | ✅ Implemented | Middleware + API + UI (via client.ts) |
| denial_behavior | ✅ Implemented | "No voter granted - deny by default" |

### Resource / Context-Aware Authorization

| Check | Status | Notes |
|-------|--------|-------|
| resource_checks | ✅ Implemented | Voters receive subject parameter |
| ownership | ✅ Implemented | UserVoter handles self-access |
| org_scoping | ✅ Implemented | hasRole accepts organizationId context |

### Role Hierarchy & Inheritance

| Check | Status | Notes |
|-------|--------|-------|
| hierarchy_supported | ✅ Implemented | Parent-child role relationships |
| inheritance_logic | ✅ Implemented | resolveHierarchy() walks up tree |
| configurability | ✅ Implemented | Hierarchy stored in DB |
| hierarchy_docs | ✅ Implemented | Design doc describes hierarchy |

### Multi-Tenant / Organization Support

| Check | Status | Notes |
|-------|--------|-------|
| org_membership | ✅ Implemented | UserRole.organizationId scoping |
| per_org_roles | ✅ Implemented | Different roles per organization |
| tenant_isolation | ✅ Implemented | OrganizationVoter enforces boundaries |

### Admin & Management UI

| Check | Status | Notes |
|-------|--------|-------|
| role_management_ui | ✅ Implemented | /admin/roles with create/edit |
| permission_group_ui | ❌ Missing | No permission group management |
| assignment_ui | ✅ Implemented | User role assignment UI exists |
| runtime_reflection | ✅ Implemented | UI queries actual role data |
| safeguards | ⚠️ Partial | isSystem protects deletion, no removal safeguards |

### Documentation vs Code Sync

| Check | Status | Notes |
|-------|--------|-------|
| undocumented_features | ⚠️ Partial | Voter permissions undocumented |
| missing_features | ⚠️ Partial | Design complete, implementation matches |
| example_accuracy | ⚠️ Partial | Examples accurate but incomplete |
| roadmap_clarity | ⚠️ Partial | Stale TODO comments |

### Extensibility & Future-Proofing

| Check | Status | Notes |
|-------|--------|-------|
| new_permissions | ⚠️ Partial | Requires code changes for voter attrs |
| group_extension | ❌ Missing | No permission group concept |
| external_integration | ⚠️ Partial | Voter pattern compatible, no IdP integration |
| enterprise_ready | ⚠️ Partial | Good foundation, needs permission registry |

### Security & Failure Modes

| Check | Status | Notes |
|-------|--------|-------|
| fail_closed | ✅ Implemented | "deny by default" in isGranted |
| missing_permissions | ✅ Implemented | Unknown attrs return false |
| server_side | ✅ Implemented | All enforcement server-side |
| jwt_validation | ❌ Missing | No JWT claim validation against DB |

---

## Summary

**Strengths:**
- Solid Symfony-style voter pattern
- Clean role hierarchy with DB-backed storage
- Proper org-scoped role assignments
- Centralized `isGranted()` API
- Fail-closed security model

**Gaps:**
- No canonical permission registry (typo risk)
- No JWT claim validation
- Voter permissions undocumented
- No permission group concept

**Risk Level:** Low-Medium

The current implementation is production-ready for a role-based system. The gaps primarily affect enterprise extensibility and developer experience, not security.
