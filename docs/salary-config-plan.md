# Implementation Plan — Salary Config + UI Patterns (v3 — Final)

## Goal

Hệ số lương derive 100% từ master data ngạch/bậc. Admin quản lý cấu hình. UI chuẩn hóa toàn dự án.

## Current State (schema reverted, clean baseline)

| Model                   | Fields                                                | Notes                    |
| ----------------------- | ----------------------------------------------------- | ------------------------ |
| `CivilServantRank`      | `minCoefficient Float?`, `maxCoefficient Float?`      | No steps relation        |
| `SalaryRecord`          | `coefficient Float`, no `rankStepId`, no `decisionNo` | No unique constraints    |
| `CreateSalaryRecordDto` | Includes `coefficient: number`                        | Client sends coefficient |
| `salary.service.ts`     | `dto.coefficient` at L149                             | No derive logic          |

---

## Phase A: Backend

### A1. Schema Migration (2 Prisma migrations)

#### Migration 1: `add_rank_steps_and_salary_fields`

**New model:**

```prisma
model CivilServantRankStep {
  id          String   @id @default(uuid())
  rankId      String
  level       Int
  coefficient Decimal  @db.Decimal(5, 2)
  isActive    Boolean  @default(true)

  rank          CivilServantRank @relation(fields: [rankId], references: [id])
  salaryRecords SalaryRecord[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([rankId, level])
  @@map("civil_servant_rank_steps")
}
```

**Modify `CivilServantRank`:**

```diff
+  steps CivilServantRankStep[]
```

(Keep `minCoefficient`/`maxCoefficient` as `Float?` — chuyển Decimal trong migration riêng sau.)

**Modify `SalaryRecord`:**

```diff
+  rankStepId  String?   // Nullable — existing data has no step reference
+  decisionNo  String?   // Số QĐ lương

+  rankStep CivilServantRankStep? @relation(fields: [rankStepId], references: [id])

+  @@unique([employeeId, effectiveFrom])
+  @@unique([employeeId, decisionNo])
```

> [!IMPORTANT]
> `rankStepId` là nullable. Bản ghi cũ sẽ có `rankStepId = null`.
> `coefficient` giữ `Float` trong migration 1 — chuyển Decimal trong migration 2.

#### Migration 2: `convert_coefficient_to_decimal`

```diff
-  coefficient Float
+  coefficient Decimal @db.Decimal(5, 2)

-  minCoefficient Float?
-  maxCoefficient Float?
+  minCoefficient Decimal? @db.Decimal(5, 2)
+  maxCoefficient Decimal? @db.Decimal(5, 2)
```

#### Decimal Normalization (service layer)

Prisma trả `Decimal` dạng `Prisma.Decimal` object. Normalize trước khi trả API:

```typescript
// src/modules/salary/salary.utils.ts
import { Prisma } from "@prisma/client";

export const toNumber = (d: Prisma.Decimal | number | null): number | null =>
  d === null ? null : typeof d === "number" ? d : d.toNumber();

export const normalizeRank = (rank: any) => ({
  ...rank,
  minCoefficient: toNumber(rank.minCoefficient),
  maxCoefficient: toNumber(rank.maxCoefficient),
});

export const normalizeStep = (step: any) => ({
  ...step,
  coefficient: toNumber(step.coefficient),
});

export const normalizeSalaryRecord = (record: any) => ({
  ...record,
  coefficient: toNumber(record.coefficient),
  civilServantRank: record.civilServantRank
    ? normalizeRank(record.civilServantRank)
    : null,
});
```

Áp dụng trong `salary.service.ts` trước mọi `return` → frontend nhận `number`.

#### Backfill Script (optional, chạy sau A2 seed)

```sql
UPDATE salary_records sr
SET rank_step_id = crs.id
FROM civil_servant_rank_steps crs
WHERE sr.civil_servant_rank_id = crs.rank_id
  AND sr.salary_level = crs.level
  AND sr.rank_step_id IS NULL;
```

---

### A2. Seed Steps (~200 records, idempotent)

#### [MODIFY] `prisma/seed.ts`

Seed `CivilServantRankStep` cho 29 ranks dùng `upsert` on `@@unique([rankId, level])`.

Ví dụ GV ĐH hạng III (V.07.01.03, A1): levels 1–9, coefficients 2.34–4.98.

---

### A3. Permission `salary:config_manage` (4 places)

#### [MODIFY] `src/common/constants/permissions.ts`

| Location                                         | Change                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| `PERMISSIONS`                                    | `SALARY_CONFIG_MANAGE: 'salary:config_manage'`                          |
| `DEFAULT_ROLE_PERMISSIONS`                       | Add to `HR_ADMIN` + `SUPER_ADMIN`                                       |
| `PERMISSION_METADATA`                            | `{ code, module: 'salary', description: 'Quản lý cấu hình ngạch/bậc' }` |
| Seed auto-applies via `PERMISSION_METADATA` loop | ✅                                                                      |

#### [MODIFY] `src/rbac/permission-groups.ts`

```typescript
export const SALARY_CONFIG_PERMISSIONS = createPermissionGroup(
  PERMISSIONS.SALARY_CONFIG_MANAGE,
);
```

---

### A4. Config API (CRUD ranks/steps)

#### [NEW] DTOs: `create-rank.dto.ts`, `update-rank.dto.ts`, `create-rank-step.dto.ts`, `update-rank-step.dto.ts`

#### [MODIFY] `salary.controller.ts` — 6 new endpoints

| Method | Route                                | Guard                                                | Mô tả      |
| ------ | ------------------------------------ | ---------------------------------------------------- | ---------- |
| GET    | `/civil-servant-ranks`               | `@RequireAnyPermissions(...SALARY_READ_PERMISSIONS)` | List (giữ) |
| POST   | `/civil-servant-ranks`               | `@RequirePermissions(SALARY_CONFIG_MANAGE)`          | Tạo ngạch  |
| PATCH  | `/civil-servant-ranks/:id`           | `@RequirePermissions(SALARY_CONFIG_MANAGE)`          | Sửa ngạch  |
| GET    | `/civil-servant-ranks/:rankId/steps` | `@RequireAnyPermissions(...SALARY_READ_PERMISSIONS)` | List bậc   |
| POST   | `/civil-servant-ranks/:rankId/steps` | `@RequirePermissions(SALARY_CONFIG_MANAGE)`          | Tạo bậc    |
| PATCH  | `/civil-servant-rank-steps/:id`      | `@RequirePermissions(SALARY_CONFIG_MANAGE)`          | Sửa bậc    |

**Deactivate warning response** (chuẩn envelope hiện có):

```json
{
  "statusCode": 200,
  "message": "Cập nhật thành công",
  "data": { "id": "...", "isActive": false },
  "meta": { "warnings": ["Có 3 QĐ lương đang hiệu lực tham chiếu ngạch này"] }
}
```

---

### A5. Refactor Create Salary Record

#### [MODIFY] `create-salary-record.dto.ts`

```diff
- @IsNumber()
- @Min(0)
- coefficient: number;

+ @IsOptional()
+ @IsString()
+ decisionNo?: string;
```

#### [MODIFY] `salary.service.ts` — `createRecord()`

```
1. Validate rank.isActive === true → BadRequestException
2. Find step = findUnique({ rankId, level }) → NotFoundException
3. Validate step.isActive === true → BadRequestException
4. coefficient = toNumber(step.coefficient) — DERIVE
5. expectedRaiseDate = currentLevelDate + raiseCycle(rankGroup)
6. Close previous active record
7. Create { rankStepId: step.id, coefficient, decisionNo, ... }
8. Catch PrismaClientKnownRequestError P2002:
   - [employeeId, effectiveFrom] → "Đã tồn tại QĐ lương ngày [date]"
   - [employeeId, decisionNo] → "Số QĐ [no] đã được sử dụng"
9. Apply normalizeSalaryRecord() before return
```

---

## Phase B: Frontend

### B3. SalaryTab Cascading (ngay sau A5)

#### [MODIFY] `salary-tab.tsx`, `salary.service.ts`, `salary.ts`

- Bỏ `coefficient` khỏi form + payload
- Thêm `getRankSteps(rankId)` API call
- Cascading: Ngạch → fetch steps → Bậc select → coefficient readonly
- `currentLevelDate` default = today, overridable
- Thêm `decisionNo` input (optional)

### B2. Admin `/salary-config` page

- Table ngạch + drill-down bậc
- CRUD modal, isActive toggle with warning
- Only if `salary:config_manage`

### B1+B4. `ui-patterns.md` + apply across modules

- Form/modal/badge/table/confirm patterns
- Apply dần cho Leaves → Education → Recruitment

---

## Phase C: E2E Tests

| #   | Case                                         | Expected         |
| --- | -------------------------------------------- | ---------------- |
| 1   | POST rank with `config_manage`               | 201              |
| 2   | POST rank with `salary:write` only           | 403              |
| 3   | POST step                                    | 201              |
| 4   | PATCH rank `isActive=false` with active refs | 200 + warning    |
| 5   | POST salary-record inactive rank             | 400              |
| 6   | POST salary-record inactive step             | 400              |
| 7   | Coefficient === step.coefficient             | Match            |
| 8   | Duplicate employeeId+effectiveFrom           | 400 + domain msg |
| 9   | Duplicate employeeId+decisionNo              | 400 + domain msg |

---

## Execution Order

```
A1 (2 migrations) → A2 (seed) → A3 (permission) → A4 (config API) → A5 (refactor create)
    ↓ checkpoint: API stable
B3 (SalaryTab) → B2 (admin page) → B1+B4 (ui-patterns)
    ↓ checkpoint: UI complete
C (e2e)
```
