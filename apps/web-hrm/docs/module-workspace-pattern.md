# Module-Workspace Pattern Guide

How to add a new module to SGU-HRM using the config-driven architecture.

## Architecture Overview

```
registry.ts          ← Single source of truth (routes, permissions, sidebar)
policy.ts            ← Shared access logic (route lookup, fallback, menu filtering)
  ↓
sidebar.tsx          ← Renders menu from registry
authz.ts             ← canAccessPath() reads registry
auth-guard.tsx       ← Workspace redirect notice reads policy
workspaces.ts        ← Delegates to policy for path checks
```

**Key principle:** Adding a new module = adding config entries, NOT editing component logic.

---

## Step-by-Step: Adding a New Module

### 1. Define Route Access Rules in `registry.ts`

Add entries to `ROUTE_ACCESS_RULES`. Each entry defines one route surface.

```typescript
// Self surface (Employee workspace)
{
  id: 'salary-self',
  moduleKey: 'salary',
  mode: 'self',
  pathPrefix: '/salary',
  allowedWorkspaces: ['employee_self'],
  requiredAnyPermissions: ['salary:read_own'],
},
// Management surface (HRM workspace)
{
  id: 'salary-management',
  moduleKey: 'salary',
  mode: 'management',
  pathPrefix: '/salary/manage',
  allowedWorkspaces: ['hrm_admin'],
  requiredAnyPermissions: ['salary:read', 'salary:write'],
},
```

> **IMPORTANT:** Place more specific prefixes (e.g. `/salary/manage`) BEFORE less specific ones (`/salary`). The policy uses `find()` — first match wins.

### 2. Add Sidebar Menu Items in `registry.ts`

Add entries to `SIDEBAR_MENU_ITEMS` for each workspace where the module should appear.

```typescript
{
  id: 'employee-salary',
  workspace: 'employee_self',
  label: 'Luong',
  href: '/salary',
  iconKey: 'file-spreadsheet',
  requiredAnyPermissions: ['salary:read_own'],
},
{
  id: 'hrm-salary-management',
  workspace: 'hrm_admin',
  label: 'Quan ly luong',
  href: '/salary/manage',
  iconKey: 'file-spreadsheet',
  requiredAnyPermissions: ['salary:read', 'salary:write'],
  activeIncludePrefixes: ['/salary/manage'],
},
```

**Available `iconKey` values:** See `SidebarIconKey` type in `registry.ts`. To add a new icon, update the type AND the `ICON_MAP` in `sidebar.tsx`.

### 3. Create Page Files

| Surface    | Path                                     | Description                |
| ---------- | ---------------------------------------- | -------------------------- |
| Self       | `app/(dashboard)/salary/page.tsx`        | Employee's own salary view |
| Management | `app/(dashboard)/salary/manage/page.tsx` | HR admin salary management |

**For management pages**, use `ManagementModuleShell`:

```tsx
import { ManagementModuleShell } from "@/components/modules/management-module-shell";

export default function SalaryManagePage() {
  const tabs = [
    { value: "list", label: "Danh sach", content: <SalaryList /> },
    {
      value: "create",
      label: "Tao moi",
      content: <SalaryCreate />,
      hidden: !canWrite,
    },
  ];

  return (
    <ManagementModuleShell
      title="Quan ly luong"
      description="Xem va cap nhat bac luong nhan su."
      defaultTab="list"
      tabs={tabs}
    />
  );
}
```

### 4. Handle Legacy Routes (if migrating)

If an old route exists (e.g. `/salary` was previously used for management), add a redirect page:

```tsx
// app/(dashboard)/salary/page.tsx (if this was previously management)
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SalaryLegacyRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/salary/manage");
  }, [router]);
  return null;
}
```

Also add a legacy rule in `ROUTE_ACCESS_RULES` to ensure the guard doesn't block the redirect.

### 5. Add Backend Permissions

In `apps/api/src/common/constants/permissions.ts`, add the permission constants and assign them to roles in `DEFAULT_ROLE_PERMISSIONS`.

---

## Naming Conventions

| Item               | Pattern                | Example                            |
| ------------------ | ---------------------- | ---------------------------------- |
| Route (Self)       | `/{module}`            | `/salary`, `/education`            |
| Route (Management) | `/{module}/manage`     | `/salary/manage`                   |
| Route Rule ID      | `{module}-{mode}`      | `salary-self`, `salary-management` |
| Module Key         | lowercase singular     | `salary`, `education`              |
| Sidebar Item ID    | `{workspace}-{module}` | `hrm-salary-management`            |
| Permission         | `{module}:{action}`    | `salary:read_own`, `salary:write`  |

---

## Checklist for PR

- [ ] Added `RouteAccessRule` entries (Self + Management) to `registry.ts`
- [ ] Added `SidebarMenuItemConfig` entries to `registry.ts`
- [ ] Created `page.tsx` for Self route (if applicable)
- [ ] Created `page.tsx` for Management route using `ManagementModuleShell`
- [ ] Legacy route redirects in place (if migrating)
- [ ] Backend permissions added and seeded
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] Test matrix: Employee sees Self only, Manager sees Management, HR Admin sees all actions
