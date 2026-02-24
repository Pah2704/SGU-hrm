# Implementation Plan — Salary Scale Refactor (v5 final)

## Tóm tắt

`CivilServantRankStep` chuyển từ `rankId` FK → `rankGroup` enum. Bảng bậc/hệ số dùng chung theo nhóm. Bỏ hẳn nhóm C.

**RankGroup enum:** `A0, A1, A2_1, A2_2, A3_1, A3_2, B` (7 values)

---

## 1. Schema

#### [MODIFY] [schema.prisma](file:///d:/projects/SGU-HRM/apps/api/prisma/schema.prisma)

```diff
 enum RankGroup {
-  A0  A1  A2  A3  B  C
+  A0  A1  A2_1  A2_2  A3_1  A3_2  B
 }

 model CivilServantRankStep {
-  rankId      String
+  rankGroup   RankGroup
   ...
-  rank  CivilServantRank @relation(...)
-  @@unique([rankId, level])
+  @@unique([rankGroup, level])
 }

 model CivilServantRank {
-  steps CivilServantRankStep[]
 }
```

---

## 2. Migration — New-Table + Enum Swap

> [!IMPORTANT]
> Cũ step table có duplicate `(rankGroup, level)` vì keyed by `rankId`.
> Prisma không hỗ trợ rename enum values. Dùng raw SQL migration.

### Phase 1: Enum swap (safe)

```sql
-- 1a: Tạo enum mới
CREATE TYPE "RankGroup_new" AS ENUM (
  'A0','A1','A2_1','A2_2','A3_1','A3_2','B'
);

-- 1b: Đổi cột CivilServantRank.rankGroup sang enum mới
ALTER TABLE "civil_servant_ranks"
  ALTER COLUMN "rankGroup" TYPE "RankGroup_new"
  USING CASE
    WHEN "rankGroup"::text = 'A2' THEN 'A2_1'::"RankGroup_new"
    WHEN "rankGroup"::text = 'A3' THEN 'A3_1'::"RankGroup_new"
    WHEN "rankGroup"::text = 'C'  THEN 'B'::"RankGroup_new"
    ELSE "rankGroup"::text::"RankGroup_new"
  END;

-- 1c: Drop + rename enum
DROP TYPE "RankGroup";
ALTER TYPE "RankGroup_new" RENAME TO "RankGroup";

-- 1d: GUARDRAIL — Cập nhật từng rank theo mapping chính xác
--     TRƯỚC KHI remap salary_records (Phase 2c)
UPDATE "civil_servant_ranks" SET "rankGroup" = 'A3_2' WHERE code = 'V.09.02.05';
UPDATE "civil_servant_ranks" SET "rankGroup" = 'A2_1' WHERE code = 'V.09.02.06';
UPDATE "civil_servant_ranks" SET "rankGroup" = 'A2_2' WHERE code IN ('V.07.02.24','V.07.03.27');
UPDATE "civil_servant_ranks" SET "rankGroup" = 'A0'   WHERE code IN ('V.09.02.04','V.09.02.08','01.004');
UPDATE "civil_servant_ranks" SET "rankGroup" = 'B'    WHERE code = '01.005';
-- (A2→A2_1 default và A3→A3_1 default đã đúng cho các ngạch còn lại)
```

> [!IMPORTANT]
> Bước 1d **bắt buộc trước** Phase 2c. Nếu không, remap sẽ join sai nhóm cho V.09.02.05 (sẽ match A3_1 thay vì A3_2).

### Phase 2: Step table rebuild

```sql
-- 2a: UUID extension (nếu chưa có)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2b: Tạo bảng step mới (rỗng)
CREATE TABLE "civil_servant_rank_steps_new" (
  "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "rankGroup"   "RankGroup" NOT NULL,
  "level"       INT NOT NULL,
  "coefficient" DECIMAL(5,2) NOT NULL,
  "isActive"    BOOLEAN DEFAULT true,
  "createdAt"   TIMESTAMPTZ DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ DEFAULT now(),
  UNIQUE("rankGroup", "level")
);

-- 2c: Seed 59 records vào bảng mới (từ seed.ts)

-- 2d: Remap salary_records.rankStepId (rank mappings đã đúng từ Phase 1d)
UPDATE "salary_records" sr
SET "rankStepId" = sn.id
FROM "civil_servant_rank_steps" old
JOIN "civil_servant_ranks" r ON old."rankId" = r.id
JOIN "civil_servant_rank_steps_new" sn
  ON sn."rankGroup" = r."rankGroup" AND sn."level" = old."level"
WHERE sr."rankStepId" = old.id;

-- 2e: Drop FK, swap tables
ALTER TABLE "salary_records" DROP CONSTRAINT IF EXISTS "salary_records_rankStepId_fkey";
DROP TABLE "civil_servant_rank_steps";
ALTER TABLE "civil_servant_rank_steps_new" RENAME TO "civil_servant_rank_steps";
ALTER TABLE "salary_records"
  ADD CONSTRAINT "salary_records_rankStepId_fkey"
  FOREIGN KEY ("rankStepId") REFERENCES "civil_servant_rank_steps"("id");
```

> [!WARNING]
> Nếu chưa có salary_records data → bỏ bước 2c, chỉ cần drop + tạo mới.
> Sau migration chạy `prisma db pull` + `prisma generate` để sync schema.

---

## 3. Rank → Group Mapping (chốt)

| Code       | Ngạch                   | Cũ  | **Mới**  |
| ---------- | ----------------------- | --- | -------- |
| V.07.01.01 | GV cao cấp ĐH (I)       | A3  | **A3_1** |
| V.09.02.01 | GV GDNN cao cấp (I)     | A3  | **A3_1** |
| V.09.02.05 | Giáo viên GDNN CC (I)   | A3  | **A3_2** |
| V.07.01.02 | GV chính ĐH (II)        | A2  | **A2_1** |
| V.07.04.30 | GV THCS I               | A2  | **A2_1** |
| V.07.05.13 | GV THPT I               | A2  | **A2_1** |
| V.09.02.02 | GV GDNN chính (II)      | A2  | **A2_1** |
| V.09.02.06 | GV GDNN chính (II)      | A2  | **A2_1** |
| V.07.02.24 | GV MN I                 | A2  | **A2_2** |
| V.07.03.27 | GV TH I                 | A2  | **A2_2** |
| V.09.02.04 | GV GDNN thực hành (III) | A1  | **A0**   |
| V.09.02.08 | GV GDNN thực hành (III) | A1  | **A0**   |
| 01.004     | Cán sự                  | B   | **A0**   |
| 01.005     | Nhân viên               | C   | **B**    |

---

## 4. min/maxCoefficient sync

Ranks đổi nhóm → cập nhật min/max tương ứng:

| Code       | Cũ (min–max) |    **Mới**    | Căn cứ            |
| ---------- | :----------: | :-----------: | ----------------- |
| V.09.02.05 |  6.20–8.00   | **5.75–7.55** | A3_2 range        |
| V.09.02.06 |  4.40–6.78   | **4.40–6.78** | A2_1 (giữ nguyên) |
| 01.004     |  1.86–4.06   | **2.10–4.89** | A0 range          |
| 01.005     |  1.65–3.63   | **1.86–4.06** | B range           |
| V.09.02.04 |  2.34–4.98   | **2.10–4.89** | A0 range          |
| V.09.02.08 |  2.34–4.98   | **2.10–4.89** | A0 range          |

---

## 5. Seed — 59 records

| rankGroup | Bậc  | Hệ số                                                                  |
| --------- | ---- | ---------------------------------------------------------------------- |
| **A3_1**  | 1–6  | 6.20, 6.56, 6.92, 7.28, 7.64, 8.00                                     |
| **A3_2**  | 1–6  | 5.75, 6.11, 6.47, 6.83, 7.19, 7.55                                     |
| **A2_1**  | 1–8  | 4.40, 4.74, 5.08, 5.42, 5.76, 6.10, 6.44, 6.78                         |
| **A2_2**  | 1–8  | 4.00, 4.34, 4.68, 5.02, 5.36, 5.70, 6.04, 6.38                         |
| **A1**    | 1–9  | 2.34, 2.67, 3.00, 3.33, 3.66, 3.99, 4.32, 4.65, 4.98                   |
| **A0**    | 1–10 | 2.10, 2.41, 2.72, 3.03, 3.34, 3.65, 3.96, 4.27, 4.58, 4.89             |
| **B**     | 1–12 | 1.86, 2.06, 2.26, 2.46, 2.66, 2.86, 3.06, 3.26, 3.46, 3.66, 3.86, 4.06 |

---

## 6. Complete File Sync List

### Backend (api)

| File                                                                                                     | What changes                                                                            |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [schema.prisma](file:///d:/projects/SGU-HRM/apps/api/prisma/schema.prisma#L357)                          | Enum + CivilServantRankStep model + bỏ relation                                         |
| [seed.ts](file:///d:/projects/SGU-HRM/apps/api/prisma/seed.ts#L544)                                      | Rank mappings + step seed (rankGroup-based, 59 records) + min/max updates               |
| [enums.ts](file:///d:/projects/SGU-HRM/apps/api/src/common/constants/enums.ts#L113)                      | `RANK_RAISE_MONTHS` keys → 7 groups                                                     |
| [salary.service.ts](file:///d:/projects/SGU-HRM/apps/api/src/modules/salary/salary.service.ts)           | Derive coeff via `rank.rankGroup + level`. Step CRUD by group. `RAISE_CYCLE` ref if any |
| [salary.controller.ts](file:///d:/projects/SGU-HRM/apps/api/src/modules/salary/salary.controller.ts#L83) | Route `GET/POST /salary-scale/:rankGroup/steps` + **giữ old endpoint alias** (xem dưới) |
| DTOs (create-rank-step.dto.ts)                                                                           | Remove rankId context, add rankGroup param validation                                   |

### Frontend (web-hrm)

| File                                                                                                  | What changes                                                           |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [salary.ts](file:///d:/projects/SGU-HRM/apps/web-hrm/src/types/salary.ts#L7)                          | `CivilServantRankStep.rankId` → `rankGroup`. `RAISE_CYCLE_MONTHS` keys |
| [salary.service.ts](file:///d:/projects/SGU-HRM/apps/web-hrm/src/services/salary.service.ts#L43)      | `getRankSteps(rankGroup)` endpoint                                     |
| [salary-tab.tsx](file:///d:/projects/SGU-HRM/apps/web-hrm/src/components/employees/salary-tab.tsx)    | Fetch steps via `selectedRank.rankGroup`                               |
| [page.tsx](<file:///d:/projects/SGU-HRM/apps/web-hrm/src/app/(dashboard)/salary-config/page.tsx#L81>) | Panel bậc chọn nhóm (7 options) thay vì ngạch                          |

### Docs

| File                                                                   | What changes                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------ |
| [SRS-SGU-HRM.md](file:///d:/projects/SGU-HRM/docs/SRS-SGU-HRM.md#L200) | "Nhóm A0–A3_2: 36 tháng. Nhóm B: 24 tháng." Bỏ C |

---

## 7. Backward-Compatible Endpoint

Giữ old endpoint 1 phiên bản để tránh gãy client/test:

```typescript
// salary.controller.ts — deprecated alias
@Get('civil-servant-ranks/:rankId/steps')
@RequirePermissions(PERMISSIONS.SALARY_READ)
async listRankStepsLegacy(@Param('rankId', ParseUUIDPipe) rankId: string, ...) {
  // Lookup rank → derive rankGroup → forward
  const rank = await this.salaryService.findRankById(rankId);
  return this.salaryService.findRankSteps(rank.rankGroup, ...);
}
```

Ở header response thêm `Deprecation: true` + `Sunset: <date>`. Xóa sau khi frontend đã chuyển hết.

---

## 8. Verification

1. Migration pass (enum swap + rank mapping + table rebuild + FK remap)
2. `prisma db seed` → 59 step records + corrected rank mappings
3. `GET /salary-scale/A1/steps` → 9 records
4. `GET /civil-servant-ranks/:rankId/steps` (legacy) → same result
5. `POST salary-records` ngạch A1 + bậc 3 → coefficient = 3.00
6. `npm run build` cả api + web-hrm pass
