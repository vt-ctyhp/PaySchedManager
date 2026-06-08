# Bulk-edit expense fields in a Schedules table view

**Date:** 2026-06-08
**Status:** Approved (design)

## Problem

Expenses (both recurring and one-time) are managed one at a time. Re-tagging a
batch of mis-categorized expenses — e.g. after a CSV import drops many rows under
the wrong category — means opening `EditPaymentDialog` for each row. There is no
way to review the full expense list and change a field across many expenses at
once.

## Goal

Let a user review all payment schedules in a dense, sortable table inside the
existing **Schedules** tab, select any number of rows, and bulk-set their
**expense category**, **internal company**, and/or **payment account** in one
action — reusing existing patterns rather than introducing a parallel surface.

Out of scope: bulk-editing amount, vendor, frequency, due date, or active state;
bulk delete; creating new categories inline; audit logging (the existing
single-edit `PUT` does not log, and this stays consistent with it).

## Domain facts (from the codebase)

- Recurring and one-time expenses are **all rows in `payment_schedules`**
  (`shared/schema.ts:106`), distinguished by `frequency` (`"one-time"` vs
  `"bi-weekly" | "monthly" | "quarterly" | "yearly"`). There is no separate
  one-time table — "review recurring + one-time expenses" is just the full
  Schedules list.
- Category is `expenseTypeId`, a FK to the `expense_types` lookup table
  (`shared/schema.ts:117`). Company is `internalCompanyId`; account is
  `paymentAccountId`.
- The single-edit flow already exists: `EditPaymentDialog` with a category
  dropdown → `PUT /api/payment-schedules/:id` → `invalidateQueries(["/api/payment-schedules"])`.
- A proven bulk-selection UX already exists in the CSV import "Review" step
  (`client/src/components/CSVImportDialog.tsx`): `Set`-based row selection, a
  header select-all checkbox with an indeterminate state, Select All / Clear, and
  a "bulk assign" dropdown.
- A bulk write endpoint precedent exists: `POST /api/payment-records/bulk`
  (`server/routes.ts:533`) validates each item with zod and loops the existing
  per-item storage call via `Promise.all`.
- The Schedules tab (`client/src/pages/Dashboard.tsx`, `TabsContent value="schedules"`)
  currently renders a card grid (`PaymentScheduleCard`) driven by a filter
  `ToggleGroup` (All / Recurring / Due Soon / Overdue) plus a search `Input`.
  Cards receive `onEdit` / `onDelete` / `onRecordPayment` handlers and a
  `canDelete` flag, all already wired in `Dashboard`.

## Design

### 1. Schedules tab: cards | table toggle

- Add a small **cards | table** `ToggleGroup` (existing component + lucide
  `LayoutGrid` / `Table` icons) to the Schedules tab toolbar, beside the existing
  filter group and search input. New local state in `Dashboard`:
  `scheduleView: "cards" | "table"`, default `"cards"` (cards view is unchanged).
- The existing `searchQuery` and `scheduleFilter` drive **both** views; the table
  renders the same `filteredSchedules` array the cards already use.
- Selection, checkboxes, and the bulk-action bar exist **only in table mode**.
  Cards view is left exactly as-is.

### 2. `ScheduleTable.tsx` (new, `client/src/components/`)

A presentational table of the (already enriched) filtered schedules.

**Props**

```ts
interface ScheduleTableProps {
  rows: EnrichedSchedule[];          // the same objects Dashboard maps to cards
  selectedIds: Set<string>;          // schedule ids
  onToggleRow: (id: string) => void;
  onToggleAll: (checked: boolean) => void; // selects/clears the currently-shown rows
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSortChange: (key: SortKey) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onRecordPayment: (id: string) => void;
  canDelete: boolean;
}
```

`EnrichedSchedule` is the existing inline type produced by `enrichedSchedules` in
`Dashboard` (schedule + `company` / `account` / `paymentType` / `expenseType` /
computed `status`). It will be lifted to a named exported type so the table can
consume it. `SortKey` ∈ `vendor | company | amount | frequency | category`.

**Columns**: select checkbox · Expense ID · Vendor · Company · Amount ·
Frequency · Category · Status · row actions.

- Header checkbox uses the CSV pattern: `checked = true | false | "indeterminate"`
  based on how many of the **currently shown** rows are selected; toggling it
  calls `onToggleAll`.
- Each row has a checkbox bound to `selectedIds.has(row.id)`; selected rows get
  `bg-muted/50` (same affordance as the CSV table).
- Sortable headers (vendor, company, amount, frequency, category) call
  `onSortChange`; clicking the active column flips direction. Sort is
  client-side, applied by `Dashboard` before passing `rows`.
- Amount is right-aligned and formatted with `formatCurrency`; frequency uses
  `FREQUENCY_LABELS`; category shows `expenseType?.name ?? "Uncategorized"`;
  status reuses the same wording the cards/`getPaymentStatus` already produce.
- Row actions reuse the existing handlers (`onEdit`, `onDelete`,
  `onRecordPayment`, gated by `canDelete`) so table mode loses no per-row
  functionality. Inactive rows (`isActive === false`) are visually dimmed, as on
  the cards.

**Selection state lives in `Dashboard`** (`selectedIds: Set<string>`), keyed by
schedule `id` so selection survives search/filter/sort changes. A row that
scrolls out of the active filter stays selected; the bar's count reflects true
selection. `onToggleAll` operates on the currently-shown filtered rows only.

### 3. `BulkActionBar.tsx` (new, `client/src/components/`)

A sticky bar rendered by `Dashboard` in table mode when `selectedIds.size > 0`.

- Shows "**N selected**" and three **optional** `Select` dropdowns — **Set
  category** (`expenseTypes`), **Set company** (`companies`), **Set account**
  (`paymentAccounts`) — populated from the queries `Dashboard` already runs.
- **Clear** button resets selection. **Apply** is enabled only when at least one
  dropdown has a value, and applies only the fields that were set.
- **Apply** opens a confirmation `AlertDialog` (same component/pattern as the
  existing delete confirmation in `Dashboard`) summarizing the change, e.g.
  *"Update 12 expenses — Category → Software, Company → Acme LLC."* Confirm fires
  the bulk mutation.

**Props**

```ts
interface BulkActionBarProps {
  count: number;
  expenseTypes: ExpenseType[];
  companies: InternalCompany[];
  paymentAccounts: PaymentAccount[];
  onClear: () => void;
  onApply: (update: BulkScheduleUpdate) => void; // only set fields included
  isApplying: boolean;
}
type BulkScheduleUpdate = {
  expenseTypeId?: string;
  internalCompanyId?: string;
  paymentAccountId?: string;
};
```

The bar manages its own three pending-selection values and resets them after a
successful apply.

### 4. Backend: `PATCH /api/payment-schedules/bulk`

Add to `server/routes.ts` (placed with the other payment-schedule routes,
**before** the `/:id` routes so `"bulk"` is not captured as an `:id`).

- Auth: `requireAuth` — bulk category/company/account change is an edit, matching
  the existing single `PUT` permission. (Delete stays `requireAdmin`.)
- Body: `{ ids: string[], update: { expenseTypeId?, internalCompanyId?, paymentAccountId? } }`.
- Validation:
  - `ids` must be a non-empty array of strings → else 400.
  - `update` validated with a whitelist:
    `insertPaymentScheduleSchema.pick({ expenseTypeId: true, internalCompanyId: true, paymentAccountId: true }).partial()`.
    This guarantees only those three fields can ever be bulk-changed (guards
    against accidental broad edits) while staying easy to extend later.
  - Reject if the parsed `update` has **no** keys → 400 ("No fields to update").
- Apply: loop the **existing** `storage.updatePaymentSchedule(id, update)` over
  `ids` via `Promise.all` (mirrors `/api/payment-records/bulk`). `updatePaymentSchedule`
  returns `undefined` for a missing id rather than throwing, so unknown ids are
  skipped. **No new storage method and no change to the two storage
  implementations.**
- Response: `{ updated: number, schedules: PaymentSchedule[] }` where `schedules`
  is the defined results and `updated` is their count.

### 5. Client data flow

- New `useMutation` in `Dashboard`:
  - `mutationFn: (body: { ids: string[]; update: BulkScheduleUpdate }) => apiRequest("PATCH", "/api/payment-schedules/bulk", body)`
  - `onSuccess`: `invalidateQueries(["/api/payment-schedules"])`, toast
    *"Updated N expense(s)"*, clear `selectedIds`, close the confirm dialog.
  - `onError`: destructive toast, keep selection.
- `apiRequest` (`client/src/lib/queryClient.ts`) is already the standard helper
  used by the existing mutations; confirm it forwards the `PATCH` method (it
  passes `method` straight to `fetch`, so `PATCH` works without changes).

## Edge cases

- Empty selection → bar hidden; nothing to apply.
- Apply with no dropdown set → Apply disabled (client) and 400 (server) as a
  backstop.
- Selection persists across search / filter / sort because it is id-keyed; the
  count is always accurate. Switching cards↔table does not clear selection, but
  the bar only shows in table mode.
- Unknown / deleted ids are silently skipped server-side; the toast reports the
  count actually updated.
- Switching the filter to e.g. "Overdue" then "Select all" selects only the
  shown overdue rows (header checkbox operates on shown rows).

## Files touched

| File | Change |
| --- | --- |
| `client/src/components/ScheduleTable.tsx` | **New** — table view with checkboxes, sortable headers, row actions. |
| `client/src/components/BulkActionBar.tsx` | **New** — sticky bulk-edit bar with three optional dropdowns + confirm trigger. |
| `client/src/pages/Dashboard.tsx` | Add `scheduleView` toggle, `selectedIds` state, sort state, client-side sort, bulk `useMutation`, confirmation `AlertDialog`, render table + bar in table mode. Export the enriched-schedule row type. |
| `server/routes.ts` | **New** `PATCH /api/payment-schedules/bulk` handler, placed before the `/:id` routes. |

No schema migration, no storage-layer change.

## Verification

This repo has no test runner (`package.json` exposes only `dev`, `build`,
`check`, `start`, `db:push`). Verification:

1. `npm run check` (tsc) passes with no new type errors.
2. Run the app (`npm run dev`, port 5050 locally): on the Schedules tab, toggle
   to table view, select rows across different filters, set category + company +
   account, confirm, and verify the rows update and the breakdown charts reflect
   the new categories after invalidation.
3. Manual API check: `PATCH /api/payment-schedules/bulk` with an empty `update`
   or empty `ids` returns 400; a valid call returns `{ updated, schedules }`.
