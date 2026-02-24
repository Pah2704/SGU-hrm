# Implementation Plan — Salary Pipeline & UX Optimization

## Goal

1. Tích hợp E2E test vào Local CI gate.
2. Đảm bảo backward compatibility cho endpoint legacy bằng E2E test.
3. Tối ưu UX/UI cho `SalaryTab` tuân thủ nghiêm ngặt `ui-patterns.md`.

---

## 1. CI Pipeline Integration

### [MODIFY] `apps/api/package.json`

- **Mục tiêu:** Chạy E2E tests tự động khi gọi các lệnh CI nội bộ.
- **Tại:** object `"scripts"`
- **Đổi:** Sửa script `"gate:local"` và `"gate:local:cov"` (hoặc các command CI tương tự) để bao gồm `npm run test:e2e` (hoặc kiểm tra chắc chắn nó đã có).
  - _Note:_ File script đã có cấu hình `npm run test:e2e`, cần check lại `api-quality-gate.yml` workflow đảm bảo Github Action chạy qua.

### [MODIFY] `.github/workflows/api-quality-gate.yml`

- **Mục tiêu:** Bảo đảm seed database và môi trường E2E chạy trơn tru trong workflow.
- Chắc chắn step test e2e có kèm flag `--runInBand` (vì DB E2E dùng chung).

---

## 2. Legacy Endpoint E2E Testing

### [MODIFY] `apps/api/test/salary.e2e-spec.ts`

- **Mục tiêu:** Viết E2E test cover endpoint `/civil-servant-ranks/:rankId/steps`
- **Case:**
  1. Login bằng quyền `salary:read` hoặc `salary:config_manage`.
  2. Lấy `rankId` của một ngạch hợp lệ từ DB.
  3. Gửi `GET /civil-servant-ranks/:rankId/steps`.
  4. Assert Response Code: `200`.
  5. Assert Body: array của steps khớp với `rankGroup` của ngạch.
  6. Assert Headers: Chứa `deprecation: true` và có thẻ `Link` trỏ về API mới.

---

## 3. Salary Tab UX Optimization (`ui-patterns.md`)

Áp dụng chuẩn **Form Pattern** số 1 và **Data Contract** số 7.

### [MODIFY] `apps/web-hrm/src/components/employees/salary-tab.tsx`

**a) Cấu trúc Form Fields:**

- Thay đổi các input field để sử dụng component `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>` từ Design System thay vì label raw. Hoặc nếu dùng standard `<Label>`, phải đảm bảo error text red có mặt dưới mỗi input nếu nhập thiếu/sai.
- **Required marker (`*`):** Đảm bảo tất cả currentLevelDate, effectiveFrom, rank, step đều có `*` rõ ràng.
- **Numeric fields:** `% Hưởng` cần giới hạn validation cứng client-side `min={0} max={100}` (giúp user nhận feedback trước cả submit).

**b) Empty State / Error State:**

- Refactor Loading/Empty state trong bảng "Lịch sử lương" dùng pattern ở mục 3:
  - Empty: _Chưa có quyết định lương nào._ (Đã có, xác nhận lại UI)
  - Error: In-card alert block màu đỏ.

**c) Helper Text cho Coefficient:**

- Field hệ số lương (Readonly) đã disable, thêm _help text / tooltip_ để ghi: "Tính toán tự động theo nhóm và bậc lương đã chọn", đáp ứng chuẩn _Data Contract Pattern_ (rõ ràng báo user là data này derived block).

**d) Validation Toast Cleanup:**

- Khi submit mà rớt required, hiện list `toast.error` dài cần được rã ra thành in-line error (Field Errors) sẽ thân thiện hơn, hoặc giữ toast nhưng group message rõ ràng.

---

## 4. Execution Plan

1. Update E2E test file.
2. Verify package.json/CI config.
3. Refactor JSX markup trong `SalaryTab.tsx`.
4. Run Linter & Tests.
