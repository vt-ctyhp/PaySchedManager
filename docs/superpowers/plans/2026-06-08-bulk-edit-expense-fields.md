# Bulk-edit Expense Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a table view to the Schedules tab that lets a user select many expenses (recurring + one-time) and bulk-set their category, internal company, and/or payment account in one action.

**Architecture:** Reuse the existing `payment_schedules` model and `EditPaymentDialog` patterns. A new `PATCH /api/payment-schedules/bulk` route loops the existing `storage.updatePaymentSchedule` (mirroring `/api/payment-records/bulk`). The frontend adds a cards|table toggle to the Schedules tab; in table mode, a new `ScheduleTable` provides id-keyed row selection and a sticky `BulkActionBar` applies the change through one React Query mutation with a confirmation dialog.

**Tech Stack:** TypeScript, Express, Drizzle + zod (`drizzle-zod`), React, `@tanstack/react-query`, Radix/shadcn UI (`Table`, `Checkbox`, `Select`, `ToggleGroup`, `AlertDialog`), `wouter`.

**Conventions for this repo:**
- No test runner exists. Verification per task = `npm run check` (tsc) must pass with no new errors; final task = runtime check via the dev server.
- Commits are deferred — do not commit unless the user asks.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `server/routes.ts` | Add `PATCH /api/payment-schedules/bulk` handler (validation + loop existing update). |
| `client/src/components/ScheduleTable.tsx` | **New.** Presentational table of enriched schedules with selection checkboxes, sortable headers, row actions. Owns the `EnrichedSchedule` and `ScheduleSortKey` types. |
| `client/src/components/BulkActionBar.tsx` | **New.** Sticky bar with three optional dropdowns (category/company/account) + Apply/Clear. Owns the `BulkScheduleUpdate` type. |
| `client/src/pages/Dashboard.tsx` | Wire it together: view toggle, selection + sort state, client-side sort, bulk mutation, confirmation dialog, render table + bar in table mode. |

---

### Task 1: Backend bulk-update endpoint

**Files:**
- Modify: `server/routes.ts` (payment-schedules section, ~line 436)

- [ ] **Step 1: Confirm `PaymentSchedule` is importable in routes.ts**

Run: `rg -n "from \"@shared/schema\"" server/routes.ts`
Look at the import list. If `PaymentSchedule` is not already imported, add it to that import statement (it is a type-only name; adding it to the existing `import { ... } from "@shared/schema"` is sufficient). `insertPaymentScheduleSchema` is already imported (used by the existing POST/PUT handlers).

- [ ] **Step 2: Add the route, immediately after the `POST /api/payment-schedules` handler (after its closing `});`, before `app.put("/api/payment-schedules/:id" ...)`)**

```ts
  app.patch("/api/payment-schedules/bulk", requireAuth, async (req, res) => {
    try {
      const { ids, update } = req.body ?? {};

      if (
        !Array.isArray(ids) ||
        ids.length === 0 ||
        !ids.every((id) => typeof id === "string")
      ) {
        return res
          .status(400)
          .json({ message: "ids must be a non-empty array of strings" });
      }

      const parsedUpdate = insertPaymentScheduleSchema
        .pick({ expenseTypeId: true, internalCompanyId: true, paymentAccountId: true })
        .partial()
        .parse(update ?? {});

      if (Object.keys(parsedUpdate).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const results = await Promise.all(
        ids.map((id: string) => storage.updatePaymentSchedule(id, parsedUpdate)),
      );
      const schedules = results.filter(
        (s): s is PaymentSchedule => Boolean(s),
      );

      res.json({ updated: schedules.length, schedules });
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Invalid data" });
    }
  });
```

Why `.patch` before `/:id`: the `:id` routes are GET/PUT/DELETE, so there is no method collision, but keeping the bulk route adjacent to the other schedule routes and ahead of `/:id` is clearest.

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: no errors (in particular no "Cannot find name 'PaymentSchedule'" and no zod `.pick` errors).

- [ ] **Step 4: (Deferred) commit** — skip; commits deferred until user asks.

---

### Task 2: `ScheduleTable` component

**Files:**
- Create: `client/src/components/ScheduleTable.tsx`

- [ ] **Step 1: Create the file with the full component**

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Pencil, Receipt, Trash2 } from "lucide-react";
import type {
  PaymentSchedule,
  InternalCompany,
  PaymentAccount,
  PaymentType,
  ExpenseType,
} from "@shared/schema";
import { formatCurrency, parseAmount, FREQUENCY_LABELS } from "@/lib/expense-analytics";

export type ScheduleStatus = "paid" | "due-soon" | "overdue" | "scheduled";

export type EnrichedSchedule = Omit<PaymentSchedule, "status"> & {
  status: ScheduleStatus;
  company?: InternalCompany;
  account?: PaymentAccount;
  paymentType?: PaymentType;
  expenseType?: ExpenseType;
};

export type ScheduleSortKey =
  | "vendor"
  | "company"
  | "amount"
  | "frequency"
  | "category";

interface ScheduleTableProps {
  rows: EnrichedSchedule[];
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  sort: { key: ScheduleSortKey; dir: "asc" | "desc" };
  onSortChange: (key: ScheduleSortKey) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onRecordPayment: (id: string) => void;
  canDelete: boolean;
}

const STATUS_LABEL: Record<ScheduleStatus, string> = {
  paid: "Paid",
  "due-soon": "Due soon",
  overdue: "Overdue",
  scheduled: "Scheduled",
};

const STATUS_VARIANT: Record<ScheduleStatus, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "outline",
  "due-soon": "secondary",
  overdue: "destructive",
  scheduled: "outline",
};

function SortHead({
  label,
  sortKey,
  sort,
  onSortChange,
  className,
}: {
  label: string;
  sortKey: ScheduleSortKey;
  sort: ScheduleTableProps["sort"];
  onSortChange: (key: ScheduleSortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <TableHead className={className}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => onSortChange(sortKey)}
        data-testid={`sort-${sortKey}`}
      >
        {label}
        <ArrowUpDown
          className={`h-3 w-3 ${active ? "text-foreground" : "text-muted-foreground/40"}`}
        />
      </button>
    </TableHead>
  );
}

export default function ScheduleTable({
  rows,
  selectedIds,
  onToggleRow,
  onToggleAll,
  sort,
  onSortChange,
  onEdit,
  onDelete,
  onRecordPayment,
  canDelete,
}: ScheduleTableProps) {
  const selectedShown = rows.reduce(
    (n, r) => (selectedIds.has(r.id) ? n + 1 : n),
    0,
  );
  const headerState: boolean | "indeterminate" =
    rows.length === 0
      ? false
      : selectedShown === rows.length
        ? true
        : selectedShown === 0
          ? false
          : "indeterminate";

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-center">
              <Checkbox
                aria-label="Select all shown"
                checked={headerState}
                onCheckedChange={(checked) => onToggleAll(checked === true)}
                data-testid="checkbox-select-all"
              />
            </TableHead>
            <TableHead>Expense ID</TableHead>
            <SortHead label="Vendor" sortKey="vendor" sort={sort} onSortChange={onSortChange} />
            <SortHead label="Company" sortKey="company" sort={sort} onSortChange={onSortChange} />
            <SortHead label="Amount" sortKey="amount" sort={sort} onSortChange={onSortChange} className="text-right" />
            <SortHead label="Frequency" sortKey="frequency" sort={sort} onSortChange={onSortChange} />
            <SortHead label="Category" sortKey="category" sort={sort} onSortChange={onSortChange} />
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                No payment schedules found
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const selected = selectedIds.has(row.id);
              const inactive = row.isActive === false;
              return (
                <TableRow
                  key={row.id}
                  className={selected ? "bg-muted/50" : undefined}
                  data-state={selected ? "selected" : undefined}
                  data-testid={`row-schedule-${row.id}`}
                >
                  <TableCell className="text-center">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => onToggleRow(row.id)}
                      aria-label={`Select ${row.vendorName}`}
                      data-testid={`checkbox-row-${row.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.expenseId}
                  </TableCell>
                  <TableCell
                    className={`font-medium ${inactive ? "text-muted-foreground line-through" : ""}`}
                  >
                    {row.vendorName}
                  </TableCell>
                  <TableCell>{row.company?.name ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(parseAmount(row.amount))}
                  </TableCell>
                  <TableCell>{FREQUENCY_LABELS[row.frequency] ?? row.frequency}</TableCell>
                  <TableCell>{row.expenseType?.name ?? "Uncategorized"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.status]}>
                      {STATUS_LABEL[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onRecordPayment(row.id)}
                        aria-label="Record payment"
                        data-testid={`button-record-${row.id}`}
                      >
                        <Receipt className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onEdit(row.id)}
                        aria-label="Edit"
                        data-testid={`button-edit-${row.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onDelete(row.id)}
                          aria-label="Delete"
                          data-testid={`button-delete-${row.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: no errors. (If `formatCurrency`/`parseAmount`/`FREQUENCY_LABELS` are not exported from `@/lib/expense-analytics`, fix the import — they are used the same way in `Dashboard.tsx`, so they are exported.)

- [ ] **Step 3: (Deferred) commit** — skip.

---

### Task 3: `BulkActionBar` component

**Files:**
- Create: `client/src/components/BulkActionBar.tsx`

- [ ] **Step 1: Create the file with the full component**

```tsx
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type {
  ExpenseType,
  InternalCompany,
  PaymentAccount,
} from "@shared/schema";

export type BulkScheduleUpdate = {
  expenseTypeId?: string;
  internalCompanyId?: string;
  paymentAccountId?: string;
};

interface BulkActionBarProps {
  count: number;
  expenseTypes: ExpenseType[];
  companies: InternalCompany[];
  paymentAccounts: PaymentAccount[];
  onClear: () => void;
  onApply: (update: BulkScheduleUpdate) => void;
  isApplying: boolean;
}

export default function BulkActionBar({
  count,
  expenseTypes,
  companies,
  paymentAccounts,
  onClear,
  onApply,
  isApplying,
}: BulkActionBarProps) {
  const [expenseTypeId, setExpenseTypeId] = useState("");
  const [internalCompanyId, setInternalCompanyId] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");

  const hasChange = Boolean(
    expenseTypeId || internalCompanyId || paymentAccountId,
  );

  const apply = () => {
    if (!hasChange) return;
    const update: BulkScheduleUpdate = {};
    if (expenseTypeId) update.expenseTypeId = expenseTypeId;
    if (internalCompanyId) update.internalCompanyId = internalCompanyId;
    if (paymentAccountId) update.paymentAccountId = paymentAccountId;
    onApply(update);
  };

  const accountLabel = (a: PaymentAccount) =>
    a.lastFourDigits ? `${a.name} (*${a.lastFourDigits})` : a.name;

  return (
    <div
      className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-lg border bg-background p-3 shadow-lg"
      data-testid="bulk-action-bar"
    >
      <span className="text-sm font-medium whitespace-nowrap">
        {count} selected
      </span>
      <Separator orientation="vertical" className="h-6 hidden sm:block" />

      <Select value={expenseTypeId} onValueChange={setExpenseTypeId}>
        <SelectTrigger className="h-9 w-[180px]" data-testid="bulk-select-category">
          <SelectValue placeholder="Set category" />
        </SelectTrigger>
        <SelectContent>
          {expenseTypes.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={internalCompanyId} onValueChange={setInternalCompanyId}>
        <SelectTrigger className="h-9 w-[180px]" data-testid="bulk-select-company">
          <SelectValue placeholder="Set company" />
        </SelectTrigger>
        <SelectContent>
          {companies.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
        <SelectTrigger className="h-9 w-[200px]" data-testid="bulk-select-account">
          <SelectValue placeholder="Set account" />
        </SelectTrigger>
        <SelectContent>
          {paymentAccounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {accountLabel(a)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        onClick={apply}
        disabled={!hasChange || isApplying}
        data-testid="bulk-apply"
      >
        {isApplying ? "Applying..." : "Apply"}
      </Button>
      <Button variant="ghost" onClick={onClear} data-testid="bulk-clear">
        Clear
      </Button>
    </div>
  );
}
```

Note: the bar is only mounted by the parent when `count > 0`. When selection clears, the parent unmounts it, so its three local select values reset automatically before the next use.

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: no errors. (`PaymentAccount` has `name` and `lastFourDigits` — confirmed by `accountLabel` usage in `Dashboard.tsx`.)

- [ ] **Step 3: (Deferred) commit** — skip.

---

### Task 4: Wire into Dashboard

**Files:**
- Modify: `client/src/pages/Dashboard.tsx`

- [ ] **Step 1: Confirm `apiRequest`'s return shape**

Run: `rg -n "export async function apiRequest|export function apiRequest|return res|\.json\(\)" client/src/lib/queryClient.ts`
Determine whether `apiRequest` returns the raw `Response` or parsed JSON. The mutation in Step 6 reads `res.json()`; if `apiRequest` already returns parsed JSON, change `onSuccess` to use the value directly (`const data = res;`). The existing `EditPaymentDialog` uses `apiRequest("PUT", ...)` and ignores the result, so either shape compiles — this step only affects how the success toast reads the `updated` count.

- [ ] **Step 2: Add imports** near the other component imports (after the `CSVImportDialog` import, line ~19):

```tsx
import ScheduleTable, {
  type EnrichedSchedule,
  type ScheduleSortKey,
} from "@/components/ScheduleTable";
import BulkActionBar, {
  type BulkScheduleUpdate,
} from "@/components/BulkActionBar";
import { LayoutGrid, Table as TableIcon } from "lucide-react";
```

(`LayoutGrid` / `Table` are lucide icons; alias `Table` to `TableIcon` to avoid colliding with anything. If `Table` is not exported by the installed lucide version, use `List` instead and alias it `TableIcon`.)

- [ ] **Step 3: Add state** alongside the other `useState` calls (after `const [detail, setDetail] = useState(...)`, line ~129):

```tsx
  const [scheduleView, setScheduleView] = useState<"cards" | "table">("cards");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scheduleSort, setScheduleSort] = useState<{
    key: ScheduleSortKey;
    dir: "asc" | "desc";
  }>({ key: "vendor", dir: "asc" });
  const [bulkConfirm, setBulkConfirm] = useState<BulkScheduleUpdate | null>(null);
```

- [ ] **Step 4: Annotate `enrichedSchedules` and add sorted rows.** Change the `enrichedSchedules` memo's return so it is typed as `EnrichedSchedule[]` (the mapped object already has all required fields; add the annotation to lock the contract). Locate `const enrichedSchedules = useMemo(() => {` (line ~266) and give the memo an explicit type:

```tsx
  const enrichedSchedules: EnrichedSchedule[] = useMemo(() => {
    return schedules.map((schedule) => ({
      ...schedule,
      status: getPaymentStatus(schedule),
      company: getCompanyById(schedule.internalCompanyId),
      account: getAccountById(schedule.paymentAccountId),
      paymentType: getPaymentTypeById(schedule.paymentTypeId),
      expenseType: getExpenseTypeById(schedule.expenseTypeId),
    }));
  }, [schedules, getCompanyById, getAccountById, getExpenseTypeById, getPaymentStatus]);
```

Then, immediately after the existing `filteredSchedules` declaration (line ~290), add the sorted view used by the table:

```tsx
  const sortedScheduleRows = useMemo(() => {
    const rows = [...filteredSchedules];
    const { key, dir } = scheduleSort;
    const mult = dir === "asc" ? 1 : -1;
    const valueOf = (s: EnrichedSchedule): string | number => {
      switch (key) {
        case "amount":
          return parseAmount(s.amount);
        case "company":
          return s.company?.name ?? "";
        case "category":
          return s.expenseType?.name ?? "";
        case "frequency":
          return s.frequency;
        case "vendor":
        default:
          return s.vendorName;
      }
    };
    rows.sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * mult;
      }
      return String(av).localeCompare(String(bv)) * mult;
    });
    return rows;
  }, [filteredSchedules, scheduleSort]);
```

(`filteredSchedules` recomputes each render; this memo will too, which is fine at this app's scale.)

- [ ] **Step 5: Add selection + sort + edit handlers** near the other `useCallback`s (e.g. after `handleRecordForSchedule`, line ~573):

```tsx
  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAllShown = useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        sortedScheduleRows.forEach((r) => {
          if (checked) {
            next.add(r.id);
          } else {
            next.delete(r.id);
          }
        });
        return next;
      });
    },
    [sortedScheduleRows],
  );

  const changeSort = useCallback((key: ScheduleSortKey) => {
    setScheduleSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }, []);

  const handleEditScheduleById = useCallback(
    (id: string) => {
      const schedule = schedules.find((s) => s.id === id);
      if (schedule) {
        setEditingSchedule(schedule);
        setEditDialogOpen(true);
      }
    },
    [schedules],
  );

  const describeBulkUpdate = useCallback(
    (u: BulkScheduleUpdate): string[] => {
      const parts: string[] = [];
      if (u.expenseTypeId)
        parts.push(`Category → ${getExpenseTypeById(u.expenseTypeId)?.name ?? "—"}`);
      if (u.internalCompanyId)
        parts.push(`Company → ${getCompanyById(u.internalCompanyId)?.name ?? "—"}`);
      if (u.paymentAccountId)
        parts.push(`Account → ${accountLabel(u.paymentAccountId)}`);
      return parts;
    },
    [getExpenseTypeById, getCompanyById, accountLabel],
  );
```

- [ ] **Step 6: Add the bulk mutation** next to the existing `deleteMutation` (line ~204):

```tsx
  const bulkUpdateMutation = useMutation({
    mutationFn: (body: { ids: string[]; update: BulkScheduleUpdate }) =>
      apiRequest("PATCH", "/api/payment-schedules/bulk", body),
    onSuccess: async (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-schedules"] });
      let updated = selectedIds.size;
      try {
        const data = typeof res?.json === "function" ? await res.json() : res;
        if (data && typeof data.updated === "number") updated = data.updated;
      } catch {
        // keep fallback count
      }
      toast({ title: `Updated ${updated} expense${updated === 1 ? "" : "s"}` });
      setSelectedIds(new Set());
      setBulkConfirm(null);
    },
    onError: () => {
      toast({
        title: "Failed to update expenses",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });
```

(The `typeof res?.json === "function"` guard handles either `apiRequest` return shape found in Step 1, so no further change is needed regardless of the result.)

- [ ] **Step 7: Add the view toggle to the Schedules toolbar.** In the `TabsContent value="schedules"` block, inside the `<div className="flex items-center gap-4 flex-wrap">` toolbar (line ~1021), add the toggle after the search input `</div>` (still inside the toolbar flex container):

```tsx
              <ToggleGroup
                type="single"
                value={scheduleView}
                onValueChange={(value) =>
                  value && setScheduleView(value as "cards" | "table")
                }
                variant="outline"
                size="sm"
                className="ml-auto"
                data-testid="toggle-schedule-view"
              >
                <ToggleGroupItem value="cards" aria-label="Card view" data-testid="view-cards">
                  <LayoutGrid className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label="Table view" data-testid="view-table">
                  <TableIcon className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
```

- [ ] **Step 8: Render cards vs table.** Replace the existing schedules body — the block:

```tsx
            {filteredSchedules.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                ...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSchedules.map((schedule) => ( ...PaymentScheduleCard... ))}
              </div>
            )}
```

with this (keep the existing empty-state `<div>` and the existing card `.map(...)` JSX exactly as they are; only the branching around them changes):

```tsx
            {filteredSchedules.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No payment schedules found</p>
                <AddPaymentDialog
                  onOneTimeScheduleCreated={handleOneTimeScheduleCreated}
                  trigger={
                    <Button variant="outline" className="mt-4" data-testid="button-add-first">
                      Add Your First Payment
                    </Button>
                  }
                />
              </div>
            ) : scheduleView === "cards" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSchedules.map((schedule) => (
                  <PaymentScheduleCard
                    key={schedule.id}
                    id={schedule.id}
                    company={`${schedule.company?.abbreviation || ""} - ${schedule.vendorName}`}
                    expenseId={schedule.expenseId}
                    amount={parseFloat(schedule.amount)}
                    dueDate={new Date(schedule.nextDueDate)}
                    frequency={schedule.frequency as any}
                    status={schedule.status}
                    onEdit={handleEditScheduleById}
                    onDelete={(id) => setDeletingScheduleId(id)}
                    onRecordPayment={handleRecordForSchedule}
                    canDelete={canDelete}
                    inactive={schedule.isActive === false}
                  />
                ))}
              </div>
            ) : (
              <>
                <ScheduleTable
                  rows={sortedScheduleRows}
                  selectedIds={selectedIds}
                  onToggleRow={toggleRow}
                  onToggleAll={toggleAllShown}
                  sort={scheduleSort}
                  onSortChange={changeSort}
                  onEdit={handleEditScheduleById}
                  onDelete={(id) => setDeletingScheduleId(id)}
                  onRecordPayment={handleRecordForSchedule}
                  canDelete={canDelete}
                />
                {selectedIds.size > 0 && (
                  <BulkActionBar
                    count={selectedIds.size}
                    expenseTypes={expenseTypes}
                    companies={companies}
                    paymentAccounts={paymentAccounts}
                    onClear={() => setSelectedIds(new Set())}
                    onApply={(update) => setBulkConfirm(update)}
                    isApplying={bulkUpdateMutation.isPending}
                  />
                )}
              </>
            )}
```

(Replacing the card `onEdit` inline closure with `handleEditScheduleById` is equivalent behavior and shares one handler.)

- [ ] **Step 9: Add the bulk confirmation dialog** next to the existing delete `AlertDialog` (before the closing of the component, after the delete `</AlertDialog>`, line ~1190):

```tsx
      {/* Bulk update confirmation */}
      <AlertDialog
        open={!!bulkConfirm}
        onOpenChange={(open) =>
          !open && !bulkUpdateMutation.isPending && setBulkConfirm(null)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply changes to {selectedIds.size} expense{selectedIds.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkConfirm && describeBulkUpdate(bulkConfirm).join(" · ")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={bulkUpdateMutation.isPending}
              data-testid="bulk-confirm-cancel"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={() =>
                bulkConfirm &&
                bulkUpdateMutation.mutate({
                  ids: Array.from(selectedIds),
                  update: bulkConfirm,
                })
              }
              disabled={bulkUpdateMutation.isPending}
              data-testid="bulk-confirm-apply"
            >
              {bulkUpdateMutation.isPending ? "Applying..." : "Apply"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

- [ ] **Step 10: Type-check**

Run: `npm run check`
Expected: no errors. Common fixes:
- If `enrichedSchedules` annotation errors because `status` from the spread conflicts, confirm `EnrichedSchedule` uses `Omit<PaymentSchedule, "status">` (it does) — the mapped `status` is the union.
- If `PaymentScheduleCard`'s `status` prop type is narrower/wider, it already received `schedule.status` before this change, so no new error is expected.

- [ ] **Step 11: (Deferred) commit** — skip.

---

### Task 5: Runtime verification

**Files:** none (manual).

- [ ] **Step 1: Type-check the whole project**

Run: `npm run check`
Expected: passes with no errors.

- [ ] **Step 2: Start the app** (local convention: port 5050)

Run: `npm run dev`
Expected: server boots; open the dashboard and sign in.

- [ ] **Step 3: Exercise the feature**

On the Schedules tab:
1. Toggle to **table** view — verify all expenses render with columns and sortable headers (click Vendor/Amount/Category to sort).
2. Select a few rows via checkboxes; the header checkbox shows indeterminate, then "select all shown" selects the filtered set.
3. Change the filter (e.g. Recurring) and confirm previously-selected rows stay selected (id-keyed); the "N selected" count is accurate.
4. In the bulk bar, set **category** (and optionally company/account), click **Apply**, confirm in the dialog.
5. Verify a success toast with the count, rows reflect the new category, selection clears, and the Overview breakdown-by-type chart updates after refetch.

- [ ] **Step 4: API guardrails (optional, via browser devtools or curl with session cookie)**

`PATCH /api/payment-schedules/bulk` with `{ "ids": [], "update": { "expenseTypeId": "x" } }` → 400.
With `{ "ids": ["<real id>"], "update": {} }` → 400 ("No fields to update").
With `{ "ids": ["<real id>"], "update": { "expenseTypeId": "<real type id>" } }` → 200 `{ updated: 1, schedules: [...] }`.

---

## Self-Review

**Spec coverage:**
- Cards|table toggle, cards default → Task 4 Steps 3, 7, 8. ✓
- Table with checkboxes, sortable headers, row actions, inactive dimming → Task 2. ✓
- Selection id-keyed, persists across filter/sort, header selects shown rows → Task 4 Steps 5 (`toggleRow`, `toggleAllShown`), 8. ✓
- Sticky bulk bar, three optional dropdowns, Apply enabled only with ≥1 field → Task 3. ✓
- Confirmation dialog summarizing changes → Task 4 Steps 5 (`describeBulkUpdate`), 9. ✓
- `PATCH /api/payment-schedules/bulk`, requireAuth, zod whitelist, 400s, loop existing update, `{updated, schedules}` → Task 1. ✓
- Client mutation + invalidate + toast + clear selection → Task 4 Step 6. ✓
- No schema migration, no storage change → confirmed (Task 1 loops existing `updatePaymentSchedule`). ✓
- Edge cases (empty selection hides bar, no-field disabled+400, unknown ids skipped) → Task 3 (`hasChange`), Task 1 (filter), Task 4 Step 8 (`size > 0`). ✓

**Placeholder scan:** No TBD/TODO; every code step contains full code. ✓

**Type consistency:** `EnrichedSchedule`/`ScheduleSortKey` defined in `ScheduleTable.tsx` and imported in `Dashboard.tsx`; `BulkScheduleUpdate` defined in `BulkActionBar.tsx` and imported in `Dashboard.tsx`. `PATCH` body `{ ids, update }` matches server parsing. `toggleAllShown(checked: boolean)` matches `onToggleAll: (checked: boolean) => void`. Handler names (`toggleRow`, `toggleAllShown`, `changeSort`, `handleEditScheduleById`, `describeBulkUpdate`, `bulkUpdateMutation`) are used consistently. ✓
