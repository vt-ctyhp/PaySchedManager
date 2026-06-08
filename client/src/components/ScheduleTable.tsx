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
import {
  formatCurrency,
  parseAmount,
  FREQUENCY_LABELS,
} from "@/lib/expense-analytics";

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

const STATUS_VARIANT: Record<
  ScheduleStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
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
            <SortHead
              label="Amount"
              sortKey="amount"
              sort={sort}
              onSortChange={onSortChange}
              className="text-right"
            />
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
