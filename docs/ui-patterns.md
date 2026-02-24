# UI Patterns - SGU HRM

## Scope
- Applies to internal HRM pages (`apps/web-hrm/src/app/(dashboard)/**`) and reusable components.
- Goal: consistent UX for CRUD-heavy admin modules (Salary, Leaves, Education, Recruitment, Organizations).

## 1. Form Pattern
- Always use: `Label` + required marker (`*`) + field control + helper/error text.
- Required validation should show field names that are missing.
- Numeric fields:
  - Use explicit unit/meaning in label.
  - Use `step` for decimal fields.
- Dates:
  - Default to today when business flow expects immediate effectiveness.
  - Allow override for retroactive decisions if business allows.

## 2. Modal Pattern
- Header:
  - `DialogTitle`: action + entity (`Them ngach`, `Cap nhat bac`).
  - `DialogDescription`: one-line impact/context.
- Footer button order:
  - Left: `Huy` (`variant="outline"`).
  - Right: primary submit button.
- Loading state:
  - Disable all submit/cancel actions when in-flight.
  - Button text changes (`Dang luu...`, `Dang xu ly...`).

## 3. Table Pattern
- Top area:
  - Title + description + optional total count.
  - Optional refresh button.
- Rows:
  - Show primary value + secondary metadata line where needed.
- Empty state:
  - One clear sentence, no technical text.
- Error state:
  - In-card alert block with concise recovery guidance.

## 4. Status Badge Pattern
- Use semantic status badges consistently:
  - `default`: active/effective.
  - `secondary`: inactive/expired.
  - Domain statuses (approved/rejected/pending) use color tokens by module.

## 5. Confirm Dialog Pattern
- Required for destructive/risky actions:
  - Deactivate salary rank/step.
  - Permanent deletion (if enabled).
- Structure:
  - Title: clear action (`Xac nhan vo hieu hoa`).
  - Description: impact and reversibility.
  - Buttons: `Huy` + destructive confirmation.

## 6. Permission-Aware UI Pattern
- If user lacks permission:
  - Render explicit access message in-page.
  - Do not render action controls.
- Route-level protection stays in auth/workspace guard; page-level protection still required for clarity.

## 7. Data Contract Pattern
- Client payloads should avoid editable derived fields.
- Derived values (example: salary coefficient) must be server-calculated.
- UI should render derived values as readonly and clearly marked as auto-derived.

## 8. Reuse Checklist
- Before building a new module screen:
  1. Reuse existing `Card/Table/Dialog/Button/Badge` patterns.
  2. Apply the same loading/error/empty state structure.
  3. Add confirmation flow for risky actions.
  4. Ensure permissions hide unauthorized actions and routes.
