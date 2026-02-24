# Implementation Plan v3.1 (Final) — Server-Side Rank Sector Filtering

> Bản chốt cuối. Đã fix: index trùng, normalize read-path, unconditional backfill.

---

## Quyết định thiết kế đã chốt

| #   | Quyết định                                                 | Lý do                                              |
| --- | ---------------------------------------------------------- | -------------------------------------------------- |
| 1   | `@map("sector_group")`                                     | camelCase code, snake_case DB                      |
| 2   | Server **luôn derive** từ `category`                       | Single source of truth, DTO không có `sectorGroup` |
| 3   | Prisma-generated migration + append SQL backfill           | 1 file, 1 lần alter                                |
| 4   | `String?` + whitelist validate + normalize                 | Linh hoạt, guardrail chặt                          |
| 5   | **Không** manual `CREATE INDEX` — Prisma sinh từ `@@index` | Tránh duplicate index                              |
| 6   | Backfill **unconditional** (không `WHERE IS NULL`)         | Fix cả dữ liệu sai lẫn null                        |

---

## Bước 1 — Schema + Migration

### [MODIFY] `prisma/schema.prisma`

```diff
 model CivilServantRank {
   ...
   category       String?
+  sectorGroup    String?   @map("sector_group")
   rankGroup      RankGroup
   ...
+  @@index([sectorGroup])
 }
```

### Migration

```bash
npx prisma migrate dev --name add_sector_group --create-only
```

Prisma sinh `ADD COLUMN` + `CREATE INDEX`. Mở file migration, **append chỉ SQL backfill** (không thêm `CREATE INDEX`):

```sql
-- === MANUAL APPEND: Unconditional backfill ===
UPDATE "civil_servant_ranks" SET "sector_group" = CASE
  WHEN "category" = 'GV_DAI_HOC'       THEN 'GIANG_VIEN'
  WHEN "category" IN ('GV_MAM_NON','GV_TIEU_HOC','GV_THCS','GV_THPT')
                                        THEN 'GIAO_VIEN_PHO_THONG'
  WHEN "category" IN ('GIANG_VIEN_GDNN','GIAO_VIEN_GDNN')
                                        THEN 'GIAO_VIEN_NGHE_NGHIEP'
  WHEN "category" = 'Y_TE'             THEN 'Y_TE'
  WHEN "category" = 'HANH_CHINH'       THEN 'HANH_CHINH'
  WHEN "category" IN ('HO_TRO_DAO_TAO','TU_VAN_HOC_SINH','HO_TRO_GD_DAC_THU','THIET_BI_THI_NGHIEM')
                                        THEN 'HO_TRO_DAO_TAO'
  ELSE 'KHAC'
END;
```

> Không có `WHERE` — ghi đè toàn bộ để fix cả giá trị sai đã tồn tại.

Sau đó: `npx prisma migrate dev`

---

## Bước 2 — Seed

### [MODIFY] `prisma/seed.ts`

```ts
sectorGroup: deriveSectorGroup(rank.category),
```

---

## Bước 3 — Backend

### [NEW] `src/common/constants/sector-groups.ts`

```ts
export const VALID_SECTOR_GROUPS = [
  "GIANG_VIEN",
  "GIAO_VIEN_PHO_THONG",
  "GIAO_VIEN_NGHE_NGHIEP",
  "Y_TE",
  "HANH_CHINH",
  "HO_TRO_DAO_TAO",
  "KHAC",
] as const;

export type SectorGroup = (typeof VALID_SECTOR_GROUPS)[number];

const CATEGORY_TO_SECTOR: Record<string, SectorGroup> = {
  /* mapping */
};

export function deriveSectorGroup(
  category: string | null | undefined,
): SectorGroup {
  if (!category) return "KHAC";
  return CATEGORY_TO_SECTOR[category.trim().toUpperCase()] ?? "KHAC";
}

export function normalizeSectorGroup(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidSectorGroup(value: string): value is SectorGroup {
  return VALID_SECTOR_GROUPS.includes(value as SectorGroup);
}
```

### [MODIFY] `salary.service.ts`

**Write-path** (server-only derive):

```ts
// createRank: derive, không nhận từ client
const sectorGroup = deriveSectorGroup(dto.category);

// updateRank: re-derive khi category thay đổi
if (dto.category !== undefined) {
  updateData.sectorGroup = deriveSectorGroup(dto.category);
}
```

**Read-path** (normalize trước validate):

```ts
if (query?.sectorGroup) {
  const normalized = normalizeSectorGroup(query.sectorGroup);
  if (!isValidSectorGroup(normalized)) {
    throw new BadRequestException(...);
  }
  where.sectorGroup = normalized;
}
```

### [MODIFY] `salary.controller.ts`

Thêm `@Query('sectorGroup') sectorGroup?: string` vào `listRanks()`.

### [NEW] `GET /civil-servant-ranks/sectors` (khai báo trước `:id`)

```ts
async findDistinctSectors(): Promise<string[]> {
  const results = await this.prisma.civilServantRank.findMany({
    where: { sectorGroup: { in: [...VALID_SECTOR_GROUPS] } },
    distinct: ['sectorGroup'],
    select: { sectorGroup: true },
    orderBy: { sectorGroup: 'asc' },
  });
  return results.map((r) => r.sectorGroup!);
}
```

---

## Bước 4 — Frontend

- `salary.service.ts`: thêm `sectorGroup` param + `getSectors()` method.
- `salary-tab.tsx`: xoá `resolveRankSector()`, dùng `useDebounce(300ms)`, query đủ 3 params (`sectorGroup`, `search`, `active`).
- `types/salary.ts`: thêm `sectorGroup: string | null`.

---

## Bước 5 — E2E (8 cases)

| #   | Case                                 | Assert                                |
| --- | ------------------------------------ | ------------------------------------- |
| 1   | `?sectorGroup=GIANG_VIEN`            | Tất cả `sectorGroup === 'GIANG_VIEN'` |
| 2   | `?sectorGroup=INVALID`               | `400`                                 |
| 3   | `?sectorGroup=Y_TE&active=true`      | Intersection                          |
| 4   | `?sectorGroup=GIANG_VIEN&search=cao` | Intersection                          |
| 5   | `/sectors`                           | Chỉ whitelist values                  |
| 6   | `POST` với `category=GV_DAI_HOC`     | `sectorGroup === 'GIANG_VIEN'`        |
| 7   | `PATCH` đổi `category`               | `sectorGroup` re-derived              |
| 8   | Backfill                             | 0 rows `sector_group IS NULL`         |

---

## Verification Checklist

- [ ] Migration + backfill: 0 rows NULL, 0 rows mismatch.
- [ ] Write-path: create/update auto-derive, client không override.
- [ ] Read-path: `y_te` normalize → `Y_TE`, `INVALID` → 400.
- [ ] `/sectors` chỉ trả whitelist.
- [ ] Frontend đủ 3 params + debounce.
- [ ] Lint + build pass. E2E 8 cases pass.

### SQL check sau migration (bắt buộc)

```sql
-- 1) Không còn NULL
SELECT COUNT(*) AS null_count
FROM civil_servant_ranks
WHERE sector_group IS NULL;

-- 2) Không mismatch mapping
SELECT id, code, category, sector_group
FROM civil_servant_ranks
WHERE sector_group IS DISTINCT FROM CASE
  WHEN category = 'GV_DAI_HOC' THEN 'GIANG_VIEN'
  WHEN category IN ('GV_MAM_NON','GV_TIEU_HOC','GV_THCS','GV_THPT') THEN 'GIAO_VIEN_PHO_THONG'
  WHEN category IN ('GIANG_VIEN_GDNN','GIAO_VIEN_GDNN') THEN 'GIAO_VIEN_NGHE_NGHIEP'
  WHEN category = 'Y_TE' THEN 'Y_TE'
  WHEN category = 'HANH_CHINH' THEN 'HANH_CHINH'
  WHEN category IN ('HO_TRO_DAO_TAO','TU_VAN_HOC_SINH','HO_TRO_GD_DAC_THU','THIET_BI_THI_NGHIEM') THEN 'HO_TRO_DAO_TAO'
  ELSE 'KHAC'
END;
```
