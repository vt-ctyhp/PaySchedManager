# Categorize Imported (One-Time) Payments — Design

Date: 2026-06-09

## Problem

When editing a payment that was imported from RocketMoney, there is no way to
select a category (expense type). The user expects to categorize these payments.

## Root cause

Category lives only on **payment schedules**, not on **payment records**:

- `payment_schedules.expenseTypeId` exists (`shared/schema.ts`) — this is the "category".
- `payment_records` has **no** expense-type column. A record's category is derived
  from its linked schedule.

CSV import (`client/src/components/CSVImportDialog.tsx`) fuzzy-matches each
transaction to a schedule by vendor name:

- **Matched** → the created record links to the schedule (`paymentScheduleId` set,
  inherits `expenseId`); its category comes from `schedule.expenseTypeId`.
- **Unmatched** → `paymentScheduleId: null`, synthetic `expenseId = CSV-{vendor}-{date}`,
  no schedule, **no category** — i.e. an implicit "one-time" payment.

The record-edit dialog (`client/src/components/EditPaymentRecordDialog.tsx`) has
fields for amount, date, method, account, approver, and reason — but **no category
control**, and there is no backing column. So a one-time imported payment cannot be
categorized.

## Reconciliation model (confirmed against code)

Imported payments are meant to reconcile against scheduled payments. Matched =
reconciled (inherits the schedule's category). Unmatched = effectively a one-time
payment with nowhere to store a category.

## Decisions

1. Payment records get their **own optional category** (`expenseTypeId`),
   independent of schedules.
2. Resolution rule: a record's effective category is
   `record.expenseTypeId ?? schedule?.expenseTypeId ?? null` (null → "Uncategorized").
   A record-level value overrides the schedule for that single payment.
3. RocketMoney's CSV `category` column is **ignored** for now (auto-mapping is a
   separate follow-up). Imported payments arrive uncategorized; the user sets the
   category by editing.

## Changes

### 1. Schema — `shared/schema.ts`

Add a nullable column to `payment_records`:

```ts
expenseTypeId: varchar("expense_type_id"), // nullable; one-time payments carry their own category
```

`insertPaymentRecordSchema` picks it up automatically via `createInsertSchema`
(nullable → optional). Apply with `npm run db:push` (migrations are push-based;
no SQL file).

### 2. Resolution rule

Effective category = `record.expenseTypeId ?? schedule?.expenseTypeId ?? null`,
applied wherever a record's category is read for display.

### 3. Edit dialog — `client/src/components/EditPaymentRecordDialog.tsx`

- Add an Expense Type `<Select>` following the existing account/approver pattern,
  with an `"Uncategorized"` sentinel option representing `null`.
- Source the expense-type list by **prop-drilling** `expenseTypes` from the parent
  (matching how `paymentAccounts` and `approvers` are already passed), not a new query.
- Initialize from `payment.expenseTypeId`; include `expenseTypeId` (sentinel → null)
  in the PUT payload.

### 4. Server — `server/routes.ts` (PUT `/api/payment-records/:id`)

No change. It already runs `insertPaymentRecordSchema.partial().parse(payload)`, so
the new optional field flows through and is audited like the other fields.

### 5. Display — `client/src/components/PaymentHistoryTable.tsx` + Dashboard row mapping

- Add a **Category** column showing the resolved category name, else "Uncategorized".
- The Dashboard builds the `PaymentHistoryRow`s and already loads `expenseTypes` and
  schedules, so it resolves the display name there and passes it on the row
  (add a field to `PaymentHistoryRow`).

## Testing

- Edit a one-time (unmatched) imported payment → set category → persists and shows
  in the table.
- Edit a matched payment → defaults to the schedule's category; overriding changes
  only that record.
- Clear to "Uncategorized" on a matched payment → falls back to the schedule's
  category (null → fallback).

## Out of scope

- RocketMoney CSV category auto-mapping.
- Bulk-categorize across payment records.
- Any change to the import matching flow.
