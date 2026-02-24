# Implementation Plan — Salary Form UX Optimization

## Goal

Tối ưu hóa UX cho Form "Tạo quyết định lương" trong component `salary-tab.tsx` tuân thủ tuyệt đối các quy định của `ui-patterns.md`. Chuyển đổi từ manual state/validation (dùng `useState` và `toast`) sang cấu trúc chuẩn dùng `react-hook-form`, `zod`, và shadcn/ui `<Form />`.

---

## 1. Vấn đề hiện tại

- Form đang dùng `useState` (`form`, `setForm`), không có inline error messages cho từng field.
- Báo lỗi required đang gộp chung thành một `toast.error` duy nhất (VD: "Vui long dien: Ngach, Bac...").
- Chưa có validation real-time ngay khi người dùng nhập sai (ví dụ `% Hưởng` nhập số âm).
- Chưa áp dụng triệt để `<FormMessage>`, `<FormDescription>` của thư viện UI chuẩn.

---

## 2. Các bước triển khai

### Bước 1: Khai báo Zod Schema cho Payload

Tạo schema chặt chẽ để encapsulate toàn bộ logic validation.

- `civilServantRankId`: required, message: "Vui lòng chọn ngạch/chức danh".
- `rankStepId`: required, message: "Vui lòng chọn bậc lương".
- `currentLevelDate`: required, message: "Vui lòng chọn ngày hưởng bậc hiện tại".
- `effectiveFrom`: required, message: "Vui lòng chọn ngày hiệu lực".
- `decisionNo`: optional.
- `percentEnjoy`: optional, number, `min(0)`, `max(100, "Không được quá 100%")`.
- `seniorityAllowance`, `positionAllowance`, `concurrentAllowance`, `otherAllowance`: optional, number, `min(0)`.

### Bước 2: Thay thế State bằng `useForm`

- Gỡ bỏ `const [form, setForm] = useState(EMPTY_FORM);`.
- Cài đặt `useForm` với `@hookform/resolvers/zod`.
- Khởi tạo giá trị mặc định cho form dựa trên Zod Schema.

### Bước 3: Cấu trúc lại giao diện Form theo tiêu chuẩn

Thay các `div.space-y-2` và `<Label>` thô bằng các block `<FormField>`:

```tsx
<FormField
  control={form.control}
  name="civilServantRankId"
  render={({ field }) => (
    <FormItem>
      <FormLabel>
        Ngạch/chức danh <span className="text-destructive">*</span>
      </FormLabel>
      <FormControl>{/* Select component */}</FormControl>
      <FormMessage /> {/* Hiển thị lỗi inline tại đây màu đỏ */}
    </FormItem>
  )}
/>
```

### Bước 4: Tối ưu Helper Texts (Data Contract Pattern)

- **Hệ số lương**: Field readonly `coefficient` phải được bọc trong `<FormItem>` và có `<FormDescription>Tính toán tự động theo nhóm và bậc lương đã chọn</FormDescription>`.
- **Dữ liệu mờ (Disabled State)**: Đảm bảo Select bậc lương hiển thị trạng thái disabled hợp lý với placeholder _"Đang tải bậc..."_ hoặc _"Chọn bậc lương"_.

### Bước 5: Cập nhật hàm Submit

- Gỡ bỏ check required bằng mảng thủ công `const missingFields = ...`.
- Nếu form qua được pass validation của Zod, thì handler sẽ nhận được dữ liệu an toàn. Định dạng lại payload (chuyển string thành number, xoá chuỗi rỗng thành undefined) trước khi mutate API.
- Đóng modal form và reset trạng thái an toàn.

---

## 3. Lợi ích mang lại

- **UX tốt hơn**: Lỗi inline màu đỏ rõ ràng tại đúng field nhập sai. Focus ngay vào field lỗi.
- **DX (Developer Experience)**: Code dễ bảo trì, dễ mở rộng, tách biệt rõ giữa logic chuẩn hoá dữ liệu (Zod) và giao diện.
- **Tính nhất quán**: Kế thừa đồng bộ `Form Pattern` đã định nghĩa trong `docs/ui-patterns.md`, làm chuẩn cho mọi Dialog crud sau này trong hệ thống.
