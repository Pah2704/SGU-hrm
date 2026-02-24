# SGU HRM — Design Standards

Tài liệu quy chuẩn thiết kế cho dự án SGU HRM. Mọi component, page, và module mới **phải tuân thủ** các quy chuẩn này.

> **Cập nhật:** 23/02/2026 — Light mode chuyển sang nền trắng thuần. Toàn bộ hardcoded Tailwind colors đã được thay bằng design tokens.

---

## 1. Brand Colors

### Bảng màu chính (oklch)

| Token          | oklch                  | Hex       | Vai trò                                       |
| -------------- | ---------------------- | --------- | --------------------------------------------- |
| `--brand-navy` | `oklch(0.28 0.08 260)` | `#1B3464` | Dominant — Sidebar, headings, primary buttons |
| `--brand-cyan` | `oklch(0.70 0.14 220)` | `#4BB8D4` | Accent — Active states, focus rings, links    |
| `--brand-sky`  | `oklch(0.88 0.06 220)` | `#B4DFF0` | Soft — Hover backgrounds, light badges        |

### Quy tắc áp dụng

```
Dominant (70%) → Navy  : Sidebar bg, card headings, primary buttons
Accent   (20%) → Cyan  : Active nav items, focus rings, links, toggles
Neutral  (10%) → Grays : Borders, muted text, separators
```

**KHÔNG được:**

- Mix thêm màu brand ngoài 3 màu trên.
- Dùng Tailwind preset colors (`blue-500`, `indigo-600`) cho brand elements.
- Dùng hardcoded hex/rgb — luôn dùng CSS variables.

---

## 2. Semantic Status Colors

| Token               | oklch                  | Hex       | Dùng cho                     |
| ------------------- | ---------------------- | --------- | ---------------------------- |
| `--status-pending`  | `oklch(0.80 0.16 85)`  | `#EAB308` | Badge "Chờ duyệt", warning   |
| `--status-approved` | `oklch(0.72 0.17 155)` | `#22C55E` | Badge "Đã duyệt", success    |
| `--status-rejected` | `oklch(0.65 0.22 25)`  | `#EF4444` | Badge "Từ chối", destructive |

### Quy tắc badge

```tsx
// ✅ Đúng — dùng semantic token
<span className="bg-[var(--status-pending)] text-white">Chờ duyệt</span>

// ❌ Sai — dùng hardcoded Tailwind color
<span className="bg-amber-100 text-amber-800">Chờ duyệt</span>
```

---

## 3. Typography

### Font Stack

| Vai trò      | Font           | Weights  | Lý do chọn                                          |
| ------------ | -------------- | -------- | --------------------------------------------------- |
| **Headings** | Outfit         | 600, 700 | Geometric, distinctive, modern — tránh Inter/Roboto |
| **Body**     | Work Sans      | 400, 500 | Readable ở cỡ nhỏ, cùng geometric family với Outfit |
| **Code**     | JetBrains Mono | 400      | Monospace cho employee codes, IDs                   |

### Type Scale

| Token       | Size | Dùng cho                                |
| ----------- | ---- | --------------------------------------- |
| `text-xs`   | 12px | Badges, metadata, footer                |
| `text-sm`   | 14px | Table cells, descriptions, labels       |
| `text-base` | 16px | Body text, form inputs (mobile minimum) |
| `text-lg`   | 18px | Card titles, section labels             |
| `text-xl`   | 20px | Page subtitles                          |
| `text-2xl`  | 24px | Page titles (h1)                        |

### Quy tắc

- Body text tối thiểu **16px trên mobile** (WCAG).
- Line height body: **1.5–1.75**.
- Max width cho đoạn văn: **65–75 ký tự** (max-w-prose).

---

## 4. Dark Mode

### Dark A: "Midnight Navy" (Mặc định)

| Token          | Light                   | Dark A                 |
| -------------- | ----------------------- | ---------------------- |
| `--background` | `oklch(0.98 0.005 240)` | `oklch(0.15 0.03 260)` |
| `--foreground` | `oklch(0.28 0.08 260)`  | `oklch(0.98 0 0)`      |
| `--card`       | `oklch(1 0 0)`          | `oklch(0.18 0.03 260)` |
| `--primary`    | `oklch(0.28 0.08 260)`  | `oklch(0.70 0.14 220)` |
| `--sidebar`    | `oklch(0.28 0.08 260)`  | `oklch(0.12 0.03 260)` |
| `--border`     | `oklch(0.90 0.02 260)`  | `oklch(0.22 0.03 260)` |

### Dark B: "True Dark" (Chuẩn bị sẵn, chưa kích hoạt)

| Token          | Dark B                 |
| -------------- | ---------------------- |
| `--background` | `oklch(0.08 0.01 260)` |
| `--card`       | `oklch(0.10 0.01 260)` |

### Quy tắc dark mode

- **LUÔN** dùng CSS variables, không hardcode.
- Kiểm tra contrast tối thiểu **4.5:1** cho body text.
- Border phải visible ở cả hai modes.

---

## 5. Spacing & Layout

### Rhythm: 4px base

```
4px  → gap-1   (micro spacing)
8px  → gap-2   (between related elements)
12px → gap-3   (form fields)
16px → gap-4   (section padding)
24px → gap-6   (between sections)
32px → gap-8   (major sections)
```

### Z-Index Scale

| Level    | Value | Dùng cho            |
| -------- | ----- | ------------------- |
| Base     | 0     | Normal flow         |
| Dropdown | 10    | Dropdowns, selects  |
| Sidebar  | 20    | Sidebar overlay     |
| Modal    | 30    | Dialog, sheet       |
| Toast    | 50    | Toast notifications |

---

## 6. Component Standards

### Buttons

- Touch target tối thiểu: **44x44px**.
- Disabled state: `opacity-50 cursor-not-allowed`.
- Loading state: Disable + hiển thị spinner/text.

### Cards

- Dùng `bg-card text-card-foreground`.
- Border: `border border-border`.
- Radius: `rounded-lg` (--radius).

### Tables

- Stripe alternate rows với `bg-muted/50`.
- Header: `text-muted-foreground text-xs uppercase`.

### Forms

- Mỗi input **phải** có `<Label>` với `htmlFor`.
- Error messages nằm **ngay dưới** input liên quan.
- Placeholder không thay thế label.

---

## 7. Accessibility Checklist

| Hạng mục | Yêu cầu                                            |
| -------- | -------------------------------------------------- |
| Contrast | ≥ 4.5:1 cho text thường, ≥ 3:1 cho text lớn        |
| Focus    | Visible focus ring trên mọi interactive element    |
| Keyboard | Tab order khớp visual order                        |
| ALT text | Mọi image có nghĩa phải có alt text                |
| ARIA     | Icon-only buttons phải có `aria-label`             |
| Motion   | Respect `prefers-reduced-motion`                   |
| Color    | Màu không phải indicator duy nhất (thêm icon/text) |

---

## 8. Logo Usage

| Thuộc tính         | Giá trị                                |
| ------------------ | -------------------------------------- |
| File               | `/logo-sgu.png`                        |
| Kích thước sidebar | 32×32px (trong container 36×36px)      |
| Kích thước login   | 64×64px                                |
| Background         | Trắng (logo có nền xanh nhạt tự nhiên) |
| Format             | PNG with transparency                  |

---

## 9. File Structure

```
globals.css          ← Tất cả CSS variables (brand, semantic, dark mode)
layout.tsx           ← Font loading (Outfit, Work Sans, JetBrains Mono)
sidebar.tsx          ← Logo image + dynamic menu
header.tsx           ← Theme toggle + user menu
login/page.tsx       ← Logo + branded login form
```

---

## 10. Anti-patterns (KHÔNG làm)

```tsx
// ❌ Hardcoded Tailwind preset colors
<h1 className="text-slate-900 dark:text-slate-100">...</h1>
<span className="bg-amber-100 text-amber-800">Chờ duyệt</span>
<div className="bg-slate-50">...</div>

// ✅ Design tokens
<h1 className="text-foreground">...</h1>
<span className="bg-[var(--status-pending)]/15 text-[var(--status-pending)]">Chờ duyệt</span>
<div className="bg-background">...</div>
```

| ❌ Không dùng                        | ✅ Thay bằng                                                   |
| ------------------------------------ | -------------------------------------------------------------- |
| `text-slate-900 dark:text-slate-100` | `text-foreground`                                              |
| `text-slate-700 dark:text-slate-300` | `text-muted-foreground`                                        |
| `bg-slate-50` / `bg-slate-100`       | `bg-background` / `bg-muted`                                   |
| `border-slate-200`                   | `border-border`                                                |
| `bg-amber-100 text-amber-800`        | `bg-[var(--status-pending)]/15 text-[var(--status-pending)]`   |
| `bg-emerald-100 text-emerald-700`    | `bg-[var(--status-approved)]/15 text-[var(--status-approved)]` |
| `bg-rose-100 text-rose-700`          | `bg-[var(--status-rejected)]/15 text-[var(--status-rejected)]` |

---

## 11. Tham chiếu nhanh cho Developer

```css
/* Brand colors */
var(--brand-navy)     /* Primary actions, headings */
var(--brand-cyan)     /* Links, active states, focus */
var(--brand-sky)      /* Light badges, hover bg */

/* Semantic UI tokens */
var(--primary)        /* Adaptive: Navy (light) → Cyan (dark) */
var(--background)     /* Page background: white (light) → navy (dark) */
var(--foreground)     /* Page headings, body text */
var(--card)           /* Card surface */
var(--border)         /* Borders, separators */
var(--muted)          /* Muted backgrounds (#F7F7F7 light) */
var(--muted-foreground) /* Descriptions, secondary text */

/* Status badges */
bg-[var(--status-pending)]/15 text-[var(--status-pending)]   /* Amber */
bg-[var(--status-approved)]/15 text-[var(--status-approved)] /* Green */
bg-[var(--status-rejected)]/15 text-[var(--status-rejected)] /* Red */
```
