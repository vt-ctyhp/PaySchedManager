# Categorize Imported (One-Time) Payments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user set an expense-type "category" on an individual payment record (especially imported one-time payments that match no schedule), and show that category in the payment history table.

**Architecture:** Add a nullable `expense_type_id` column to `payment_records`. A record's effective category resolves as `record.expenseTypeId ?? schedule?.expenseTypeId ?? null`. The record-edit dialog gains an Expense Type select (prop-drilled `expenseTypes` list, "Uncategorized" sentinel for null). The PUT endpoint and DB update already pass partial fields through unchanged, so no server change is needed. The Dashboard resolves the display name and the history table renders a new Category column.

**Tech Stack:** Drizzle ORM (push-based migrations via `drizzle-kit push`), drizzle-zod, React + TanStack Query, Radix `Select`, Express. No automated test harness exists in this repo — verification is `npm run check` (tsc) plus manual runtime checks.

**Spec:** `docs/superpowers/specs/2026-06-09-categorize-imported-payments-design.md`

**Note on verification:** This repo has no unit-test runner (no vitest/jest, zero `*.test.*` files). Per-task verification is therefore `npm run check` for types plus the manual steps in the final task — not red/green unit tests. Do not add a test framework; that is out of scope.

---

### Task 1: Add `expenseTypeId` column to `payment_records`

**Files:**
- Modify: `shared/schema.ts` (the `paymentRecords` table, around line 139-155)

- [ ] **Step 1: Add the nullable column**

In `shared/schema.ts`, inside the `paymentRecords = pgTable("payment_records", { ... })` definition, add an `expenseTypeId` column. Place it right after the `paymentScheduleId` line so related foreign-key-ish columns sit together:

```ts
export const paymentRecords = pgTable("payment_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentScheduleId: varchar("payment_schedule_id"),
  expenseTypeId: varchar("expense_type_id"), // nullable; one-time payments carry their own category, overrides schedule
  expenseId: text("expense_id").notNull(),
  internalCompanyId: varchar("internal_company_id").notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paidBy: varchar("paid_by").notNull(), // User ID who made the payment (auto-filled from session)
  approvedBy: varchar("approved_by"), // User ID who approved the payment
  paymentMethod: text("payment_method").notNull(),
  paymentAccountId: varchar("payment_account_id"), // Foreign key to payment accounts
  confirmationFile: text("confirmation_file"),
  approvalScreenshot: text("approval_screenshot"),
  scheduledDueDate: timestamp("scheduled_due_date"),
  daysLate: integer("days_late").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

No change is needed to `insertPaymentRecordSchema` — `createInsertSchema` derives the new field automatically, and because the column is nullable it becomes optional in inserts/updates. `PaymentRecord` (`$inferSelect`) now includes `expenseTypeId: string | null`.

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: PASS (no type errors). The new field on `PaymentRecord` is now visible to the client via `@shared/schema`.

- [ ] **Step 3: Push the schema to the database**

Run: `npm run db:push`
Expected: drizzle-kit reports adding column `expense_type_id` to `payment_records` and applies it. If it prompts, accept the additive change (a nullable column with no default is non-destructive).

- [ ] **Step 4: Commit**

```bash
git add shared/schema.ts
git commit -m "Add nullable expense_type_id column to payment_records"
```

---

### Task 2: Add Expense Type select to the record-edit dialog

**Files:**
- Modify: `client/src/components/EditPaymentRecordDialog.tsx`

The dialog currently takes `paymentAccounts` and `approvers` as props and renders Select controls for them using sentinel values for "none". Follow that exact pattern for expense type.

- [ ] **Step 1: Import the `ExpenseType` type and extend props**

At the top type import (currently `import type { PaymentAccount, PaymentRecord } from "@shared/schema";`), add `ExpenseType`:

```ts
import type { ExpenseType, PaymentAccount, PaymentRecord } from "@shared/schema";
```

Add `expenseTypes` to the props interface (after `paymentAccounts`):

```ts
interface EditPaymentRecordDialogProps {
  payment: PaymentRecord;
  displayAmount: number;
  displayDate: Date;
  paymentAccounts: PaymentAccount[];
  expenseTypes: ExpenseType[];
  approvers: { id: string; username: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

And destructure it in the component signature (add `expenseTypes,` next to `paymentAccounts,`):

```ts
export default function EditPaymentRecordDialog({
  payment,
  displayAmount,
  displayDate,
  paymentAccounts,
  expenseTypes,
  approvers,
  open,
  onOpenChange,
}: EditPaymentRecordDialogProps) {
```

- [ ] **Step 2: Add the sentinel, helper, and state**

Next to the existing sentinels (`UNASSIGNED_ACCOUNT_VALUE`, `NONE_APPROVER_VALUE`), add:

```ts
  const UNCATEGORIZED_VALUE = "uncategorized";
```

Next to the existing `hasAccountOption` / `hasApproverOption` helpers, add:

```ts
  const hasExpenseTypeOption = (value: string | null | undefined) =>
    !!value && expenseTypes.some((type) => type.id === value);
```

Next to the existing state declarations (after `paymentAccountId`), add:

```ts
  const [expenseTypeId, setExpenseTypeId] = useState<string>(payment.expenseTypeId ?? UNCATEGORIZED_VALUE);
```

- [ ] **Step 3: Reset state when the dialog re-opens**

In the existing `useEffect(() => { if (open) { ... } }, [open, payment, displayAmount, displayDate])`, add a line alongside the other resets:

```ts
      setExpenseTypeId(payment.expenseTypeId ?? UNCATEGORIZED_VALUE);
```

- [ ] **Step 4: Include `expenseTypeId` in the PUT payload**

In the mutation's `payload` object (currently ends with `approvedBy: approvedBy === NONE_APPROVER_VALUE ? null : approvedBy,`), add:

```ts
        expenseTypeId: expenseTypeId === UNCATEGORIZED_VALUE ? null : expenseTypeId,
```

- [ ] **Step 5: Render the Expense Type select**

Insert a new field block immediately after the Payment Account `<div className="space-y-2">...</div>` block and before the "Approved By" block:

```tsx
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={expenseTypeId} onValueChange={setExpenseTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNCATEGORIZED_VALUE}>Uncategorized</SelectItem>
                {expenseTypeId !== UNCATEGORIZED_VALUE && expenseTypeId && !hasExpenseTypeOption(expenseTypeId) && (
                  <SelectItem value={expenseTypeId}>
                    Unknown category ({expenseTypeId})
                  </SelectItem>
                )}
                {expenseTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
```

- [ ] **Step 6: Typecheck**

Run: `npm run check`
Expected: FAIL — `PaymentHistoryTable` (the only caller) does not yet pass the required `expenseTypes` prop. This confirms the prop is wired as required; it is fixed in Task 3. (If you prefer a clean checkpoint, you may instead commit after Task 3 — but the dialog change is self-contained and correct.)

- [ ] **Step 7: Commit**

```bash
git add client/src/components/EditPaymentRecordDialog.tsx
git commit -m "Add Category (expense type) select to payment record edit dialog"
```

---

### Task 3: Thread `expenseTypes` + Category column through the history table

**Files:**
- Modify: `client/src/components/PaymentHistoryTable.tsx`

- [ ] **Step 1: Import `ExpenseType` and extend the row + props**

Update the schema type import (currently `import type { PaymentAccount, PaymentRecord as PaymentRecordModel } from "@shared/schema";`) to:

```ts
import type { ExpenseType, PaymentAccount, PaymentRecord as PaymentRecordModel } from "@shared/schema";
```

Add a `category` field to the `PaymentHistoryRow` interface (after `account?: string;`):

```ts
  category?: string | null;
```

Add `expenseTypes` to the props interface:

```ts
interface PaymentHistoryTableProps {
  payments: PaymentHistoryRow[];
  paymentAccounts: PaymentAccount[];
  expenseTypes: ExpenseType[];
  approvers: { id: string; username: string }[];
}
```

And destructure it in the component signature (add `expenseTypes,` next to `paymentAccounts,`):

```ts
export default function PaymentHistoryTable({
  payments,
  paymentAccounts,
  expenseTypes,
  approvers,
}: PaymentHistoryTableProps) {
```

- [ ] **Step 2: Add the Category column header**

In the `<TableHeader>` row, add a `Category` header. Insert it immediately after the `<TableHead>Account</TableHead>` line:

```tsx
              <TableHead>Account</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Confirmation</TableHead>
```

- [ ] **Step 3: Bump the empty-state colSpan**

The empty-state cell currently uses `colSpan={10}`. With the new column there are 11 columns. Change it:

```tsx
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  No payment records found
                </TableCell>
```

- [ ] **Step 4: Render the Category cell**

In the body row, immediately after the Account `<TableCell ...>{payment.account || "—"}</TableCell>` block, add:

```tsx
                  <TableCell data-testid={`text-category-${payment.id}`}>
                    {payment.category || "Uncategorized"}
                  </TableCell>
```

- [ ] **Step 5: Pass `expenseTypes` to the edit dialog**

In the `<EditPaymentRecordDialog ... />` JSX, add the `expenseTypes` prop (next to `paymentAccounts`):

```tsx
          payment={editingPayment.rawRecord}
          displayAmount={editingPayment.amount}
          displayDate={editingPayment.date}
          paymentAccounts={paymentAccounts}
          expenseTypes={expenseTypes}
          approvers={approvers}
```

- [ ] **Step 6: Typecheck**

Run: `npm run check`
Expected: FAIL — the Dashboard (`client/src/pages/Dashboard.tsx`) does not yet pass `expenseTypes` to `PaymentHistoryTable` and does not set `category` on rows. Fixed in Task 4.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/PaymentHistoryTable.tsx
git commit -m "Add Category column and expenseTypes prop to payment history table"
```

---

### Task 4: Resolve category in the Dashboard and pass `expenseTypes`

**Files:**
- Modify: `client/src/pages/Dashboard.tsx`

The `enrichedRecords` memo (starts ~line 366) already computes a `schedule` for each record and already has `getExpenseTypeById` (line 274) and `expenseTypes` (line 211) in scope.

- [ ] **Step 1: Resolve the effective category name on each row**

Inside the `records.map(record => { ... })` callback, after the `schedule` constant is computed (the block that assigns `const schedule = record.paymentScheduleId ? ... : ...;`), add:

```ts
      const effectiveExpenseTypeId = record.expenseTypeId ?? schedule?.expenseTypeId ?? null;
      const categoryName = effectiveExpenseTypeId
        ? getExpenseTypeById(effectiveExpenseTypeId)?.name ?? null
        : null;
```

- [ ] **Step 2: Add `category` to the returned row object**

In the object returned from the map (the one ending with `rawRecord: record,`), add:

```ts
        category: categoryName,
        rawRecord: record,
```

- [ ] **Step 3: Pass `expenseTypes` to the table**

Update the `<PaymentHistoryTable ... />` usage (around line 1283):

```tsx
            <PaymentHistoryTable
              payments={enrichedRecords}
              paymentAccounts={paymentAccounts}
              expenseTypes={expenseTypes}
              approvers={users}
            />
```

- [ ] **Step 4: Typecheck**

Run: `npm run check`
Expected: PASS. All props are now satisfied end-to-end and `category` is set on every row.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Dashboard.tsx
git commit -m "Resolve payment record category and pass expenseTypes to history table"
```

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npm run check`
Expected: PASS, no errors.

- [ ] **Step 2: Manual runtime verification**

Start the app (`npm run dev`) and, in the Payment History tab:

1. Edit a one-time (imported, unmatched) payment — it shows "Uncategorized" in the Category column. Open Edit, pick a category, enter a reason, Save. The row's Category updates to the chosen name.
2. Edit a payment that matched a schedule — the Category column shows the schedule's expense type by default. Override it in the dialog; only that row changes, the schedule is untouched.
3. On that overridden matched payment, edit again and set Category back to "Uncategorized", Save. The column falls back to the schedule's expense type (because `record.expenseTypeId` is now null and resolution falls through to the schedule).
4. Confirm the edit appears in the audit log (reason recorded), consistent with other field edits.

- [ ] **Step 3: Confirm clean tree**

```bash
git status
```
Expected: clean working tree; all changes committed across Tasks 1-4.

---

## Notes for the implementer

- Migrations are **push-based**: editing `shared/schema.ts` then running `npm run db:push` is the whole migration. There is no SQL file to write.
- The server PUT `/api/payment-records/:id` (`server/routes.ts`) and `updatePaymentRecord` (`server/storage.ts`) pass the parsed partial straight through (`insertPaymentRecordSchema.partial().parse(...)` then `.set(record)`), so `expenseTypeId` persists with **no server edit required**. Do not add one.
- The CSV import (`/api/payment-records/bulk`) intentionally does **not** send `expenseTypeId`; matched imports still display a category via the schedule fallback, and unmatched imports arrive "Uncategorized". This is by design — do not wire RocketMoney's CSV category here (out of scope).
- Resolution rule lives in exactly one place for display (Dashboard `enrichedRecords`). The dialog edits the raw `record.expenseTypeId` only.
