# Slice 2: Organizations + Unit Tree - Technical Design

## 1. Plan

### 1.1 Endpoints

| Method | Endpoint               | Description                       | RBAC                                                |
| ------ | ---------------------- | --------------------------------- | --------------------------------------------------- |
| GET    | `/units`               | Return org tree structure         | `organizations:read`                                |
| GET    | `/units/:id`           | Get single unit detail            | `organizations:read`                                |
| POST   | `/units`               | Create unit (set parent, path)    | `organizations:write`                               |
| PATCH  | `/units/:id`           | Update unit + path recalculation  | `organizations:write`                               |
| DELETE | `/units/:id`           | Soft-delete (set INACTIVE status) | `organizations:write` + `SUPER_ADMIN` or `HR_ADMIN` |
| GET    | `/units/:id/employees` | List employees in unit            | `organizations:read`                                |

### 1.2 DB Representation

The `Unit` model (already in Prisma schema) uses a **self-referencing tree** with materialized path:

```
Unit
├── parentId (FK → Unit)   ← parent pointer
├── path     (String)      ← materialized path ("sgu.khoa_cntt.bomon_httt")
├── level    (Int)         ← depth in tree (0 = root)
├── unitType (Enum)        ← TRUONG | KHOA | PHONG | BAN | TRUNG_TAM | TO_BO_MON
├── status   (Enum)        ← ACTIVE | INACTIVE | MERGED
```

**Tree construction**: `GET /units` fetches all ACTIVE units as flat list from DB, then builds an in-memory tree (parent→children nesting) before returning JSON.

**Path recalculation**: On create/update, the `path` field is computed as `parent.path + '.' + slugify(code)`. On parent change, all descendants' paths are updated.

### 1.3 Permissions (Already defined)

- `PERMISSIONS.ORGANIZATIONS_READ` = `'organizations:read'`
- `PERMISSIONS.ORGANIZATIONS_WRITE` = `'organizations:write'`

Roles with org permissions: SUPER_ADMIN (all), HR_ADMIN (read+write), MANAGER (read only), EMPLOYEE (read only).

---

## 2. Design

### 2.1 Backend Module Structure

Following existing layout convention (modules at `src/` level, not `src/modules/`):

```
src/organizations/
├── organizations.module.ts
├── organizations.controller.ts
├── organizations.service.ts
├── dto/
│   ├── create-unit.dto.ts
│   ├── update-unit.dto.ts
│   └── index.ts
└── index.ts                    # barrel export
```

### 2.2 DTOs

**CreateUnitDto:**

```typescript
{
  code: string;        // required, unique
  name: string;        // required
  shortName?: string;
  parentId?: string;   // UUID of parent (null = root)
  unitType: UnitType;  // TRUONG | KHOA | PHONG | BAN | TRUNG_TAM | TO_BO_MON
  sortOrder?: number;
}
```

**UpdateUnitDto:**

```typescript
{
  name?: string;
  shortName?: string;
  parentId?: string;   // changing parent triggers path recalc
  unitType?: UnitType;
  status?: UnitStatus; // ACTIVE | INACTIVE | MERGED
  sortOrder?: number;
}
```

**Tree response shape** (nested):

```typescript
interface TreeUnitDto {
  id: string;
  code: string;
  name: string;
  shortName?: string;
  unitType: string;
  status: string;
  level: number;
  sortOrder: number;
  employeeCount?: number; // optional count
  children: TreeUnitDto[];
}
```

### 2.3 Tree Build Strategy

```typescript
// 1. Fetch flat list from DB (all ACTIVE units, ordered by level, sortOrder)
// 2. Build a map: id → node (with empty children[])
// 3. Iterate: push each node into its parent's children[]
// 4. Return roots (nodes with parentId = null)
```

### 2.4 Frontend Structure

New Next.js HRM app at `apps/web-hrm`:

```
apps/web-hrm/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── login/page.tsx
│   │   └── settings/
│   │       └── organizations/page.tsx    ← Unit management page
│   ├── components/
│   │   └── organizations/
│   │       ├── UnitTree.tsx              ← Collapsible tree
│   │       └── UnitFormModal.tsx         ← Create/Edit modal
│   └── lib/
│       ├── api.ts                       ← Fetch wrapper with auth
│       └── auth.ts                      ← Auth context
```

---

## 3. Code Skeletons

### 3.1 organizations.controller.ts

```typescript
@Controller("units")
export class OrganizationsController {
  constructor(private orgService: OrganizationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_READ)
  getTree() {
    // TODO: return nested tree of all ACTIVE units
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_READ)
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    // TODO: return single unit with children count
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_WRITE)
  @Roles(ROLES.HR_ADMIN, ROLES.SUPER_ADMIN)
  create(@Body() dto: CreateUnitDto) {
    // TODO: create unit, compute path/level from parent
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_WRITE)
  @Roles(ROLES.HR_ADMIN, ROLES.SUPER_ADMIN)
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateUnitDto) {
    // TODO: update unit, recalc path if parent changed
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_WRITE)
  @Roles(ROLES.SUPER_ADMIN)
  remove(@Param("id", ParseUUIDPipe) id: string) {
    // TODO: soft-delete (set status = INACTIVE)
  }

  @Get(":id/employees")
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_READ)
  getEmployees(@Param("id", ParseUUIDPipe) id: string) {
    // TODO: list employees in this unit (empty until Employee module)
  }
}
```

### 3.2 organizations.service.ts (key methods)

```typescript
@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async getTree(): Promise<TreeUnitDto[]> {
    // 1. Fetch all units ordered by level, sortOrder
    // 2. Build id→node map
    // 3. Nest children into parents
    // 4. Return roots
  }

  async create(dto: CreateUnitDto): Promise<Unit> {
    // 1. If parentId, fetch parent to compute path and level
    // 2. path = parent ? `${parent.path}.${code}` : code
    // 3. level = parent ? parent.level + 1 : 0
    // 4. prisma.unit.create(...)
  }

  async update(id: string, dto: UpdateUnitDto): Promise<Unit> {
    // 1. If parentId changed → recalculate path for this unit + all descendants
    // 2. prisma.unit.update(...)
  }

  async remove(id: string): Promise<Unit> {
    // Soft-delete: set status = INACTIVE
    // Do NOT delete if unit has active employees
  }

  async getEmployees(unitId: string) {
    // Return employees in this unit (placeholder until Slice 3)
  }
}
```

### 3.3 UnitTree.tsx (React component)

```tsx
// Recursive collapsible tree node
function TreeNode({ node }: { node: TreeUnitDto }) {
  const [open, setOpen] = useState(node.level < 2);
  return (
    <div style={{ marginLeft: node.level * 20 }}>
      <div onClick={() => setOpen(!open)}>
        {node.children.length > 0 && (open ? "▼" : "▶")}
        {node.name} ({node.code})
      </div>
      {open &&
        node.children.map((child) => <TreeNode key={child.id} node={child} />)}
    </div>
  );
}

export function UnitTree({ tree }: { tree: TreeUnitDto[] }) {
  return (
    <div>
      {tree.map((root) => (
        <TreeNode key={root.id} node={root} />
      ))}
    </div>
  );
}
```

### 3.4 UnitManagementPage (/settings/organizations)

```tsx
export default function OrganizationsPage() {
  // 1. Fetch tree from GET /units (with auth token)
  // 2. Display UnitTree component
  // 3. "Add Unit" button → opens UnitFormModal
  // 4. Click tree node → opens edit modal
  // 5. Form fields: name, code, parent (dropdown), unitType (select), status
  // 6. Submit → POST/PATCH /units → refetch tree
}
```

---

## 4. Implementation Order

1. **OrganizationsModule** — Service with tree build + CRUD (backend)
2. **Controller** — Wire endpoints with RBAC decorators
3. **E2E tests** — Create unit, get tree, update parent, soft-delete
4. **Next.js scaffold** — Create `apps/web-hrm` with routing and auth
5. **Frontend components** — UnitTree + UnitFormModal + management page

## Update Note (Sort Order Policy)

For current implementation details of `sortOrder` (auto-generate + manual override), see:

- `docs/organizations-sort-order-policy.md`
