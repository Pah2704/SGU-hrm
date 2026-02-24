# Organizations Sort Order Policy

## Muc tieu

Tai lieu nay mo ta quy tac quan ly `sortOrder` cho don vi trong module Organizations.
Muc tieu la:

- Khong bat buoc admin phai tu nhap thu tu cho tung don vi.
- Van cho phep can thiep tay khi can sap xep dac thu.
- Giu on dinh UI tree va cac danh sach chon don vi.

## Quy tac chinh

1. He thong luon sap xep don vi theo:

- `level` tang dan
- `sortOrder` tang dan
- `name` tang dan

2. Khi tao moi don vi:

- Neu nguoi dung nhap `sortOrder`: dung gia tri do.
- Neu de trong `sortOrder`: he thong tu sinh theo cong thuc:
  - Lay `max(sortOrder)` cua cac don vi cung cap (`same parentId`).
  - Gan `sortOrder = max + 10`.

3. Khi cap nhat don vi:

- Neu nguoi dung nhap `sortOrder`: cap nhat theo gia tri nhap.
- Neu doi `parentId` ma khong nhap `sortOrder`: he thong tu dat don vi xuong cuoi danh sach cap moi bang quy tac `max + 10`.

## Tai sao buoc +10 (khong +1)

Dung buoc `+10` de de chen giua cac muc da co ma khong phai doi lai hang loat.

Vi du:

- Co san: `10, 20, 30`
- Can chen giua 10 va 20: dat `15` la du

Neu dung `+1`, viec chen giua thuong buoc phai renumber nhieu ban ghi.

## Pham vi ap dung

### Backend (API)

- `CreateUnitDto` va `UpdateUnitDto` van ho tro field `sortOrder`.
- `OrganizationsService` tu sinh `sortOrder` neu request khong gui gia tri.
- Lay tree va children deu order theo `sortOrder` truoc, `name` sau.

### Frontend (Web HRM)

- Form them/sua don vi van co input `Thu tu`.
- Input `Thu tu` co the de trong (placeholder: `De trong de tu sinh`).
- Dropdown don vi (vi du trong Employee form) sap xep theo `sortOrder` roi toi `name`.

## Ghi chu van hanh

- Neu khong co yeu cau dac biet, de trong `Thu tu` de he thong tu sinh.
- Chi can nhap tay `Thu tu` khi can dieu chinh vi tri hien thi.
- Gia tri `sortOrder` nen >= 0.

## Trang thai hien tai

Policy nay da duoc ap dung vao codebase.

- Web: pass `lint` va `build`
- API: pass `build`
