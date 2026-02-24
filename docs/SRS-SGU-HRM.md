# TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)

## DỰ ÁN: HỆ THỐNG QUẢN LÝ NHÂN SỰ (HRM) - TRƯỜNG ĐẠI HỌC SÀI GÒN

- **Phiên bản:** 1.8
- **Ngày cập nhật:** 09/02/2026
- **Kiến trúc:** Modular Monolith (NestJS)
- **Tác giả:** Pah2704

---

## I. TỔNG QUAN HỆ THỐNG

### 1. Mục tiêu

- **Số hóa:** Chuyển đổi toàn bộ hồ sơ giấy (theo mẫu chuẩn của Thông tư 06/2023/TT-BNV) sang dữ liệu số, loại bỏ quy trình lưu trữ thủ công.
- **Tự động hóa:** Giảm tải tác nghiệp cho HR qua việc tự động hóa quy trình xét nâng lương, đánh giá định kỳ, chấm công và tuyển dụng.
- **Tập trung:** Xây dựng cơ sở dữ liệu (CSDL) nhất quán, đảm bảo phân quyền chặt chẽ giữa các đơn vị (Khoa/Phòng/Ban).
- **Truyền thông:** Xây dựng Cổng thông tin điện tử chính thức của Phòng TCCB để công bố văn bản, thông báo và tin tức tuyển dụng.

### 2. Đối tượng người dùng (Actors)

| Actor                            | Vai trò & Mô tả                                                                                           |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| **HR Admin (Phòng TCCB)**        | Quản trị toàn hệ thống. Thực hiện nghiệp vụ lương, bổ nhiệm, in ấn quyết định, báo cáo nhân sự.           |
| **Content Admin (Ban biên tập)** | Quản lý nội dung website, đăng tải tin tức, văn bản pháp quy, biểu mẫu.                                   |
| **Lãnh đạo Đơn vị**              | Trưởng Khoa/Phòng/Ban. Quản lý hồ sơ nhân sự trực thuộc, duyệt đơn nghỉ phép, đánh giá viên chức định kỳ. |
| **Cấp ủy Chi bộ**                | Tham gia vào quy trình nhận xét, đánh giá Đảng viên cuối năm.                                             |
| **Nhân sự (Employee)**           | Xem hồ sơ cá nhân, nộp đơn nghỉ phép, tự đánh giá, cập nhật văn bằng/chứng chỉ mới.                       |
| **Guest (Ứng viên/Public)**      | Truy cập Portal tuyển dụng, xem tin tức, văn bản và tải biểu mẫu công khai.                               |

---

## II. CHI TIẾT CÁC PHÂN HỆ CHỨC NĂNG (MODULES)

### PHÂN HỆ 1: QUẢN LÝ HỒ SƠ NHÂN SỰ (CORE MODULE)

Đây là module trung tâm, cấu trúc dữ liệu được cập nhật chuẩn theo Mẫu Sơ yếu lý lịch (Thông tư 06/2023/TT-BNV).

#### 1.1. Cấu trúc dữ liệu (Data Schema Specification)

**A. THÔNG TIN CHUNG & ĐỊNH DANH (Mục 1-10)**

- `organization_name`: "Trường Đại học Sài Gòn" (Hardcode).
- `department_usage`: "Trường Đại học Sài Gòn" (Hardcode).
- `employee_code` (Số hiệu): `string` (Unique).
- `citizen_id` (Mã định danh/Số CCCD): `string` (Unique, Key).
- `avatar_url`: `string` (4x6cm).
- `full_name`: `string` (UPPERCASE).
- `alias_name`: `string` (Tên gọi khác).
- `dob`: `date` (Ngày sinh).
- `gender`: `enum` ('Nam', 'Nữ').
- `place_of_birth`: `jsonb { province, ward, detail }` (Nơi sinh).
- `hometown`: `jsonb { province, ward, detail }` (Quê quán).
- `ethnicity_id`: `relation` (Dân tộc).
- `religion_id`: `relation` (Tôn giáo).
- `citizen_card_date / place`: `date / string` (Ngày/Nơi cấp CCCD).
- `phone_number`: `string` (SĐT liên hệ).
- `social_insurance_no`: `string` (Số BHXH).
- `health_insurance_no`: `string` (Số thẻ BHYT).
- `current_address`: `jsonb { province, ward, detail }` (Nơi ở hiện nay).

**B. THÔNG TIN TUYỂN DỤNG & CÔNG TÁC (Mục 11-18)**

- `family_background`: `string` (Thành phần gia đình xuất thân).
- `job_before_recruitment`: `string` (Nghề nghiệp trước khi tuyển dụng).
- `initial_recruitment_date`: `date` (Ngày tuyển dụng lần đầu).
- `initial_recruitment_agency`: `string` (Cơ quan tuyển dụng lần đầu).
- `current_org_join_date`: `date` (Ngày vào cơ quan hiện tại).
- `party_join_date / party_official_date`: `date / date` (Ngày vào Đảng).
- `first_social_org_join_date`: `date` (Đoàn, Công đoàn...).
- `enlistment_date / demobilization_date`: `date` (Ngày nhập ngũ/xuất ngũ).
- `highest_military_rank`: `string` (Quân hàm cao nhất).
- `policy_category`: `string` (Đối tượng chính sách: Thương binh, con liệt sĩ...).

**C. TRÌNH ĐỘ & CHỨC DANH (Mục 19-22)**

- `general_education`: `string` (GD Phổ thông: 12/12).
- `highest_degree`: `computed` (Trình độ CM cao nhất - lấy từ Phân hệ 6).
- `academic_rank`: `enum` (GS, PGS).
- `academic_rank_year`: `number` (Năm phong).
- `state_titles`: `string` (NGND, NGƯT...).

**D. CHỨC VỤ & CÔNG VIỆC (Mục 23-29)**

- `current_position`: `string` (Chức vụ hiện tại).
- `appoint_date`: `date` (Ngày bổ nhiệm).
- `re_appoint_date`: `date` (Ngày bổ nhiệm lại/Tiếp theo).
- `planning_titles`: `string` (Được quy hoạch chức danh).
- `concurrent_positions`: `string` (Chức vụ kiêm nhiệm).
- `party_position`: `string` (Chức vụ Đảng hiện tại).
- `concurrent_party_position`: `string` (Chức vụ Đảng kiêm nhiệm).
- `main_duty`: `string` (Công việc chính được giao).
- `strong_point`: `string` (Sở trường công tác).
- `longest_job`: `string` (Công việc làm lâu nhất).

**E. TIỀN LƯƠNG & PHỤ CẤP (Mục 30)**

- `salary_type`: `enum` ('Ngạch/Bậc', 'Vị trí việc làm').
- **Option 1 (Theo Ngạch/Bậc):**
  - `civil_servant_rank`: `relation` (Mã ngạch).
  - `salary_level`: `number` (Bậc).
  - `coefficient`: `float` (Hệ số).
  - `level_date`: `date` (Ngày hưởng).
  - `percent_enjoy`: `number` (% hưởng).
  - `seniority_allowance`: `number` (% TNVK).
- **Option 2 (Theo Vị trí việc làm):**
  - `job_position_code`: `string`.
  - `salary_amount`: `money` (Lương theo mức tiền).
- **Phụ cấp:** `position_allowance`, `concurrent_allowance`, `other_allowance`.

**F. SỨC KHỎE (Mục 31)**

- `health_status`, `height`, `weight`, `blood_type`.

**G. ĐẶC ĐIỂM LỊCH SỬ BẢN THÂN (Mục 34)**

- `historical_features`: `jsonb` (Bản thân, chế độ cũ, quan hệ nước ngoài).

**H. QUAN HỆ GIA ĐÌNH (Mục 36)**

- `relationships`: `relation` (Bảng riêng).
- `side`: `enum` ('Bản thân', 'Bên Vợ/Chồng').

**I. HOÀN CẢNH KINH TẾ (Mục 37)**

- `salary_history`, `other_income`, `assets` (Nhà, Đất).

#### 1.2. Chức năng & Logic nghiệp vụ

- **Quản lý vòng đời (Lifecycle):** Thêm mới -> Cập nhật -> Thôi việc (Soft Delete).
- **Cảnh báo dữ liệu (Validate):** Kiểm tra ràng buộc khi nghỉ việc.
- **Xuất trích ngang (Export):** Mẫu HS02-VC/BNV (Thông tư 06/2023) và Mẫu 2C/BNV.

---

### PHÂN HỆ 2: QUẢN LÝ TỔ CHỨC & ĐƠN VỊ

- **2.1. Dữ liệu:** `unit_name`, `parent_id` (Tree structure), `unit_type`, `status`.
- **2.2. Chức năng:** Hiển thị Tree View, Lưu lịch sử thay đổi (tách/nhập đơn vị).

---

### PHÂN HỆ 3: CẤU TRÚC ĐOÀN THỂ

- **Đảng (Chi bộ):** Danh sách chi bộ, bí thư.
- **Công đoàn:** Công đoàn bộ phận, chủ tịch.

---

### PHÂN HỆ 4: QUẢN LÝ HỢP ĐỒNG

- **4.1. Phân loại:** HĐLĐ/HĐLV xác định/không xác định thời hạn.
- **4.2. Quy trình:** Tạo mới -> Export .docx -> Ký offline -> Upload PDF. Quản lý phụ lục (Version control). Cảnh báo hết hạn (30, 60, 90 ngày).

---

### PHÂN HỆ 5: QUẢN LÝ TUYỂN DỤNG

- **Quy trình:** Đăng tin -> Ứng tuyển (Public Portal) -> HR duyệt "Trúng tuyển" -> Auto Convert sang Employee profile & Tạo account.

---

### PHÂN HỆ 6: ĐÀO TẠO & BỒI DƯỠNG

- **6.1. Dữ liệu:** Văn bằng (Degrees), Chứng chỉ (Certificates).
- **6.2. Quy trình:** User tự upload -> HR duyệt -> Auto Update Hồ sơ gốc & `highest_degree`.

---

### PHÂN HỆ 7: CHỨC VỤ & BỔ NHIỆM

- **Dữ liệu:** Loại chức vụ, nhiệm kỳ, trạng thái.
- **Logic:** 1 nhân sự có thể giữ nhiều chức vụ (1 chính, n kiêm nhiệm). Lưu lịch sử công tác.

---

### PHÂN HỆ 8: ĐÁNH GIÁ, KHEN THƯỞNG & KỶ LUẬT

- **8.1. Đánh giá:** Quý (Đơn vị), Năm (Hội đồng trường).
- **8.2. Khen thưởng/Kỷ luật:** Lưu số quyết định, file scan.
- **Lưu ý:** Kỷ luật sẽ block quy trình nâng lương (Phân hệ 10).

---

### PHÂN HỆ 9: QUẢN LÝ NGHỈ PHÉP & CHẤM CÔNG

- **9.1. Loại nghỉ:** Hưởng lương trường, BHXH, Không lương.
- **9.2. Quy trình:** User tạo đơn -> Trưởng đơn vị duyệt -> HR xác nhận -> Auto Timekeeping.
- **Trigger:** Nghỉ không lương -> Event sang Phân hệ 10 để tính lùi ngày nâng lương.

---

### PHÂN HỆ 10: QUẢN LÝ LƯƠNG (SALARY)

#### 10.1. Hồ sơ Lương

- `civil_servant_rank`, `rank_type`, `salary_level`, `coefficient`, `current_level_date`.
- `expected_raise_date`:
  - Nhóm A0-A3_2: 36 tháng.
  - Nhóm B: 24 tháng.
- `warning_flag`: Bật nếu có Kỷ luật hoặc Nghỉ không lương.

#### 10.2. Quy trình Nâng lương Thường xuyên (Auto-Scan)

- **Cronjob hàng tháng:** Quét `expected_raise_date`.
- **Check Kéo dài:**
  - Khiển trách: +03 tháng.
  - Cảnh cáo: +06 tháng.
  - Cách chức: +12 tháng.
- **Check Nghỉ không lương:** Trừ lùi thời gian tương ứng.

#### 10.3. Quy trình Nâng lương Trước thời hạn

- **Trường hợp 1:** Lập thành tích xuất sắc (Điều kiện: Hoàn thành nhiệm vụ, Không kỷ luật, Thời gian còn thiếu <= 12 tháng).
- **Trường hợp 2:** Đã có thông báo nghỉ hưu (Thời gian còn thiếu <= 12 tháng).

---

### PHÂN HỆ 13: PHÂN QUYỀN (RBAC)

- **Super Admin:** IT/Dev (Full access).
- **HR Admin:** Full nghiệp vụ.
- **Manager:** Quản lý đơn vị (Read hồ sơ, Duyệt đơn).
- **Employee:** Cá nhân (Xem hồ sơ, nộp đơn, upload văn bằng).

---

### PHÂN HỆ 14: CMS & CỔNG THÔNG TIN

- **14.1. Public:** Tin tức, giới thiệu, sơ đồ tổ chức, tra cứu văn bản, tin tuyển dụng, biểu mẫu hành chính.
- **14.2. Admin:** Quản lý bài viết (CKEditor), văn bản PDF, Banner, Hỏi đáp.

---

## III. QUY TRÌNH NGHIỆP VỤ CHUNG (DECISION FLOW)

1. **Draft:** HR nhập liệu.
2. **Offline:** In ấn, trình ký giấy.
3. **Finalize:** HR scan & upload PDF đã ký -> Bấm "Ban hành".
4. **Sync:** Hệ thống tự động update dữ liệu liên quan & Email thông báo.

---

## IV. KIẾN TRÚC KỸ THUẬT (TECHNICAL STACK)

1. **Backend (API):**
   - **Framework:** NestJS (Node.js).
   - **Architecture:** Modular Monolith.
   - **Background Job:** BullMQ (Export, Mass Email, Scan lương).
2. **Database & Storage:**
   - **DB:** PostgreSQL + Prisma ORM.
   - **File Storage:** MinIO.
   - **Cache:** Redis.
3. **Frontend:**
   - **Framework:** Next.js (App Portal & Web Portal).
   - **UI Library:** Tailwind CSS + ShadcnUI/AntDesign.
4. **Deployment:** Docker + Nginx.

---

## CẬP NHẬT & GHI CHÚ CHO DEV

- **User/Employee Isolation:** Tách biệt bảng `users` và `employees` (1-1 match).
- **Enum Management:** Sử dụng file định nghĩa tập trung (constants.ts).
- **Unit Test:** Tập trung vào logic tính `expected_raise_date` (Nâng lương).

